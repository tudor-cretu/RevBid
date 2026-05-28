'use strict';

/**
 * RevBid — Statistici (analytics) endpoints.
 *
 *  GET /api/statistici/cumparator — accesibil DOAR buyerului autentificat
 *  GET /api/statistici/furnizor   — accesibil DOAR supplierului autentificat
 *
 * Query params (ambele endpoint-uri):
 *  ?period=30d | 90d | all   (default 30d pentru trend; totalurile sunt
 *                              întotdeauna calculate pe tot istoricul)
 *
 * Statisticile sunt calculate cu agregări MongoDB pe colecțiile reale,
 * fără valori mock. Logăm fiecare acces ca audit + orice eroare ca incident.
 */

const router         = require('express').Router();
const mongoose       = require('mongoose');
const authMiddleware = require('../middleware/auth');
const Auction        = require('../models/Auction');
const Bid            = require('../models/Bid');
const Review         = require('../models/Review');
const Invoice        = require('../models/Invoice');
const User           = require('../models/User');
const logger         = require('../utils/logger');
const EVENTS         = require('../utils/events');

const { ObjectId } = mongoose.Types;

/* ── Constante de business ─────────────────────────────────────── */
const CLOSE_LOSS_THRESHOLD_PERCENT = 5;  // diferență ≤ 5% → "close loss"
const CLOSE_LOSS_MAX_RESULTS       = 10; // câte exemple returnăm în UI
const TOP_CATEGORIES_LIMIT         = 5;
const TOP_SUPPLIERS_LIMIT          = 5;

/* ── Helpers ───────────────────────────────────────────────────── */

/** Parsează ?period= → întoarce data de start sau null (all-time). */
function parsePeriod(periodRaw) {
  const allowed = { '30d': 30, '90d': 90 };
  if (!periodRaw || periodRaw === 'all') return null;
  const days = allowed[String(periodRaw).toLowerCase()];
  if (!days) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Rotunjire la 2 zecimale. Folosit pentru sume RON / procente. */
function round2(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Calculează bugetul de referință pentru o licitație finalizată.
 *  Preferința: targetPrice (dacă există) > startPrice.
 *  startPrice = bugetul anunțat de buyer, deci o referință naturală
 *  pentru "cât te așteptai să cheltui". */
function budgetOf(auction) {
  if (auction.targetPrice && Number.isFinite(auction.targetPrice)) {
    return auction.targetPrice;
  }
  return auction.startPrice;
}

/** Middleware: doar rolul corect.  */
function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      logger.fromReq(req).security(EVENTS.ANALYTICS.UNAUTHORIZED,
        `Acces statistici ${role} refuzat — rol ${req.user?.role}`, {
          metadata: { requiredRole: role, actualRole: req.user?.role },
        });
      const roLabel = role === 'buyer' ? 'cumpărători' : (role === 'supplier' ? 'furnizori' : role);
      return res.status(403).json({
        message: `Acces interzis — statisticile sunt disponibile doar pentru ${roLabel}.`,
      });
    }
    next();
  };
}

/* ════════════════════════════════════════════════════════════════
   STATISTICI CUMPARATOR
   ════════════════════════════════════════════════════════════════ */
router.get('/cumparator', authMiddleware, requireRole('buyer'), async (req, res) => {
  try {
    const buyerId   = new ObjectId(req.user.id);
    const periodMin = parsePeriod(req.query.period || '30d');

    /* ── Toate licitațiile buyerului, populate cu winning bid ──
       Excludem drafturile (nu intră în calcule).                       */
    const auctions = await Auction.find({
      buyer:  buyerId,
      status: { $ne: 'draft' },
    }).lean();

    const auctionIds = auctions.map(a => a._id);

    /* ── Toate ofertele primite pe licitațiile buyerului ── */
    const allBids = await Bid.find({ auction: { $in: auctionIds } })
      .select('auction supplier amount isWinning createdAt')
      .lean();

    /* Index ofertelor pe licitație. */
    const bidsByAuction = new Map();
    for (const b of allBids) {
      const key = b.auction.toString();
      if (!bidsByAuction.has(key)) bidsByAuction.set(key, []);
      bidsByAuction.get(key).push(b);
    }

    /* ── Calcule cumulate (all-time) ── */
    let totalPublishedBudget = 0;
    let totalSaved           = 0;
    let savingsCount         = 0;
    let savingsPercentSum    = 0;
    let finalPriceSum        = 0;
    let budgetSumFinalized   = 0;
    let finalizedWithWinner  = 0;
    let firstBidTimes        = []; // în ms
    let bidCountReceived     = 0;
    let bidCountWithBids     = 0;

    /* ── Last 30 days (sau perioada cerută) ── */
    let last30AuctionsCreated   = 0;
    let last30AuctionsCompleted = 0;
    let last30BidsReceived      = 0;
    let last30Saved             = 0;
    let last30SavingsPercentSum = 0;
    let last30SavingsCount      = 0;

    /* ── Top categorii ── */
    const categoryStats = new Map(); // category → { count, bids, budget }

    /* ── Furnizori câștigători ── */
    const winnerStats = new Map(); // supplierId → { count, totalValue }

    /* ── Savings trend (pe ultimele 30 zile, group by zi) ── */
    const savingsByDay = new Map(); // 'YYYY-MM-DD' → { saved, finalized }

    for (const a of auctions) {
      const budget = budgetOf(a);

      /* Bugetul total publicat — toate licitațiile non-draft, active/closed. */
      if (a.status !== 'cancelled' && Number.isFinite(budget)) {
        totalPublishedBudget += budget;
      }

      /* Categoria — statistici. */
      const cat = (a.category || '').trim() || 'Necategorizat';
      if (!categoryStats.has(cat)) {
        categoryStats.set(cat, { auctionCount: 0, bidCount: 0, totalBudget: 0 });
      }
      const cs = categoryStats.get(cat);
      cs.auctionCount += 1;
      if (Number.isFinite(budget)) cs.totalBudget += budget;

      /* Oferte primite pe această licitație. */
      const bids = bidsByAuction.get(a._id.toString()) || [];
      cs.bidCount       += bids.length;
      bidCountReceived  += bids.length;
      if (bids.length > 0) bidCountWithBids += 1;

      /* Timp până la prima ofertă. */
      if (bids.length > 0) {
        const refStart = a.publishedAt || a.createdAt;
        const firstBid = bids.reduce(
          (min, b) => (!min || b.createdAt < min ? b.createdAt : min),
          null,
        );
        if (refStart && firstBid) {
          const diff = new Date(firstBid) - new Date(refStart);
          if (diff >= 0) firstBidTimes.push(diff);
        }
      }

      /* Licitație finalizată cu winner — calcule de economii. */
      const isFinalized = a.status === 'closed';
      if (isFinalized && Number.isFinite(budget) && Number.isFinite(a.currentPrice)) {
        finalizedWithWinner += 1;
        finalPriceSum       += a.currentPrice;
        budgetSumFinalized  += budget;

        const saved = budget - a.currentPrice;
        if (saved > 0) {
          totalSaved        += saved;
          savingsCount      += 1;
          savingsPercentSum += (saved / budget) * 100;
        }

        /* Per zi pentru trend chart (când a fost finalizată). */
        if (a.endedNotifiedAt || a.updatedAt) {
          const closedAt = a.endedNotifiedAt || a.updatedAt;
          const day = new Date(closedAt).toISOString().slice(0, 10);
          if (!savingsByDay.has(day)) {
            savingsByDay.set(day, { saved: 0, finalized: 0 });
          }
          savingsByDay.get(day).saved     += Math.max(0, saved);
          savingsByDay.get(day).finalized += 1;
        }

        /* Furnizor câștigător. */
        if (a.winningBid) {
          const winBid = bids.find(b => b._id.toString() === a.winningBid.toString())
                      || bids.find(b => b.isWinning && b.supplier);
          if (winBid?.supplier) {
            const sid = winBid.supplier.toString();
            if (!winnerStats.has(sid)) {
              winnerStats.set(sid, { collaborations: 0, totalValue: 0 });
            }
            const ws = winnerStats.get(sid);
            ws.collaborations += 1;
            ws.totalValue     += a.currentPrice;
          }
        }
      }

      /* ── Last 30 days ── */
      if (periodMin) {
        if (new Date(a.createdAt) >= periodMin) last30AuctionsCreated += 1;
        if (isFinalized && (a.endedNotifiedAt || a.updatedAt)
            && new Date(a.endedNotifiedAt || a.updatedAt) >= periodMin) {
          last30AuctionsCompleted += 1;
          if (Number.isFinite(budget) && Number.isFinite(a.currentPrice)) {
            const saved = budget - a.currentPrice;
            if (saved > 0) {
              last30Saved             += saved;
              last30SavingsCount      += 1;
              last30SavingsPercentSum += (saved / budget) * 100;
            }
          }
        }
        last30BidsReceived += bids.filter(b => new Date(b.createdAt) >= periodMin).length;
      }
    }

    /* ── Rating mediu al furnizorilor preferați ── */
    const supplierIds = [...winnerStats.keys()].map(id => new ObjectId(id));
    let supplierInfo = new Map();
    if (supplierIds.length > 0) {
      const suppliers = await User.find({ _id: { $in: supplierIds } })
        .select('firstName lastName companyName rating reviewCount avatar')
        .lean();
      for (const s of suppliers) {
        supplierInfo.set(s._id.toString(), s);
      }
    }

    /* ── Build favorite suppliers list ── */
    const favoriteSuppliers = [...winnerStats.entries()]
      .map(([sid, stats]) => {
        const u = supplierInfo.get(sid);
        return {
          supplierId:     sid,
          name:           u
            ? (u.companyName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Furnizor')
            : 'Furnizor',
          collaborations: stats.collaborations,
          totalValue:     round2(stats.totalValue),
          averageRating:  u?.rating ?? null,
          reviewCount:    u?.reviewCount ?? 0,
          avatar:         u?.avatar || null,
        };
      })
      .sort((a, b) =>
        (b.collaborations - a.collaborations) || (b.totalValue - a.totalValue)
      )
      .slice(0, TOP_SUPPLIERS_LIMIT);

    /* ── Build top categories ── */
    const topCategories = [...categoryStats.entries()]
      .map(([category, s]) => ({
        category,
        auctionCount: s.auctionCount,
        bidCount:     s.bidCount,
        totalBudget:  round2(s.totalBudget),
      }))
      .sort((a, b) => b.auctionCount - a.auctionCount || b.bidCount - a.bidCount)
      .slice(0, TOP_CATEGORIES_LIMIT);

    /* ── Savings trend — ultima perioadă, group by zi ──
       Emitem DOAR zilele cu economii efective (saved > 0). Zilele goale
       umplu graficul cu zerouri și diluează vizualizarea, deci le omitem.
       Frontend-ul desenează o linie continuă între punctele rămase.        */
    let savingsTrend = [];
    if (periodMin) {
      const minStartMs = periodMin.getTime();
      savingsTrend = [...savingsByDay.entries()]
        .filter(([key, v]) => v.saved > 0 && new Date(key).getTime() >= minStartMs)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => ({
          date:           key,
          saved:          round2(v.saved),
          finalizedCount: v.finalized,
        }));
    }

    /* ── Agregări finale ── */
    const avgSavingsPercent     = savingsCount > 0 ? savingsPercentSum / savingsCount : 0;
    const averageFinalPrice     = finalizedWithWinner > 0 ? finalPriceSum / finalizedWithWinner : 0;
    const averageBudget         = finalizedWithWinner > 0 ? budgetSumFinalized / finalizedWithWinner : 0;
    const averageBidsPerAuction = auctions.length > 0 ? bidCountReceived / auctions.length : 0;
    const avgFirstBidMs         = firstBidTimes.length > 0
      ? firstBidTimes.reduce((s, x) => s + x, 0) / firstBidTimes.length
      : 0;

    const last30SavingsPercent = last30SavingsCount > 0
      ? last30SavingsPercentSum / last30SavingsCount
      : 0;

    logger.fromReq(req).audit(EVENTS.ANALYTICS.BUYER_FETCH,
      `Buyer analytics fetched`, {
        entityType: 'user',
        entityId:   req.user.id,
        metadata:   {
          auctionsCount: auctions.length,
          finalizedWithWinner,
          period: req.query.period || '30d',
        },
      });

    res.json({
      summary: {
        totalAuctionsPublished:    auctions.length,
        totalSaved:                round2(totalSaved),
        averageSavingsPercent:     round2(avgSavingsPercent),
        totalPublishedBudget:      round2(totalPublishedBudget),
        averageFinalPrice:         round2(averageFinalPrice),
        averageBudget:             round2(averageBudget),
        averageBidsPerAuction:     round2(averageBidsPerAuction),
        averageTimeToFirstBidMinutes: round2(avgFirstBidMs / 60000),
        finalizedWithWinner,
        bidCountReceived,
        auctionsWithBids:          bidCountWithBids,
      },
      last30Days: {
        auctionsCreated:   last30AuctionsCreated,
        auctionsCompleted: last30AuctionsCompleted,
        bidsReceived:      last30BidsReceived,
        savedAmount:       round2(last30Saved),
        savedPercent:      round2(last30SavingsPercent),
      },
      topCategories,
      favoriteSuppliers,
      savingsTrend,
    });

  } catch (err) {
    logger.logReqError(req, EVENTS.ANALYTICS.CALC_ERROR, err);
    res.status(500).json({ message: 'Eroare la calculul statisticilor' });
  }
});

/* ════════════════════════════════════════════════════════════════
   STATISTICI FURNIZOR
   ════════════════════════════════════════════════════════════════ */
router.get('/furnizor', authMiddleware, requireRole('supplier'), async (req, res) => {
  try {
    const supplierId = new ObjectId(req.user.id);
    const periodMin  = parsePeriod(req.query.period || '30d');

    /* ── Toate ofertele supplierului ── */
    const myBids = await Bid.find({ supplier: supplierId })
      .select('auction amount isWinning createdAt')
      .lean();

    if (myBids.length === 0) {
      /* Empty state — răspundem rapid fără agregări inutile. */
      logger.fromReq(req).audit(EVENTS.ANALYTICS.SUPPLIER_FETCH,
        `Supplier analytics fetched (empty)`, {
          entityType: 'user', entityId: req.user.id,
        });
      return res.json({
        summary: {
          totalBidsSubmitted: 0,
          uniqueAuctionsParticipated: 0,
          auctionsWon: 0,
          winRate: 0,
          totalWonValue: 0,
          averageWonValue: 0,
          averageRating: null,
          reviewCount: 0,
          closeLossCount: 0,
        },
        last30Days: {
          bidsSubmitted: 0,
          auctionsWon: 0,
          wonValue: 0,
          winRate: 0,
          closeLossCount: 0,
        },
        topCategories: [],
        closeLosses: [],
        bidStatusDistribution: [
          { status: 'winning',   count: 0 },
          { status: 'lost',      count: 0 },
          { status: 'pending',   count: 0 },
        ],
      });
    }

    /* Ofertele mele indexate pe licitație. */
    const auctionIdSet = new Set();
    const myBidsByAuction = new Map();
    for (const b of myBids) {
      const k = b.auction.toString();
      auctionIdSet.add(k);
      if (!myBidsByAuction.has(k)) myBidsByAuction.set(k, []);
      myBidsByAuction.get(k).push(b);
    }

    const auctionIds = [...auctionIdSet].map(id => new ObjectId(id));

    /* ── Licitațiile la care a participat — date complete ── */
    const auctions = await Auction.find({
      _id:    { $in: auctionIds },
      status: { $ne: 'draft' },
    }).select('title category status startPrice targetPrice currentPrice deadline winningBid endedNotifiedAt updatedAt createdAt')
      .lean();

    /* ── Ofertele câștigătoare pe acele licitații (pentru a calcula
       close losses și valoarea câștigătoare) ── */
    const winningBids = await Bid.find({
      auction:   { $in: auctionIds },
      isWinning: true,
    }).select('auction supplier amount').lean();

    const winnerByAuction = new Map();
    for (const wb of winningBids) {
      winnerByAuction.set(wb.auction.toString(), wb);
    }

    /* ── Calcule ── */
    let totalBidsSubmitted   = myBids.length;
    let uniqueAuctions       = auctionIdSet.size;
    let auctionsWon          = 0;
    let totalWonValue        = 0;

    let last30Bids           = 0;
    let last30Won            = 0;
    let last30WonValue       = 0;
    let last30CloseLosses    = 0;

    const closeLosses = [];

    /* Distribuție status oferte (pe ultima ofertă a supplierului per licitație). */
    let statusWinning  = 0;
    let statusLost     = 0;
    let statusActive   = 0;
    let statusCancelled = 0;

    /* Categorii: bids submitted, wins, win rate, won value. */
    const catStats = new Map();

    for (const a of auctions) {
      const aid = a._id.toString();
      const myBidsHere   = myBidsByAuction.get(aid) || [];
      /* Cea mai bună ofertă a supplierului = cea mai mică (reverse bidding). */
      const myBest = myBidsHere.reduce(
        (best, b) => (!best || b.amount < best.amount ? b : best),
        null,
      );

      const winner   = winnerByAuction.get(aid);
      const iWon     = winner && winner.supplier?.toString() === req.user.id;
      const finalized = a.status === 'closed';

      const cat = (a.category || '').trim() || 'Necategorizat';
      if (!catStats.has(cat)) {
        catStats.set(cat, { bidsSubmitted: 0, auctionsWon: 0, participated: 0, wonValue: 0 });
      }
      const cs = catStats.get(cat);
      cs.bidsSubmitted += myBidsHere.length;
      cs.participated  += 1;

      if (iWon) {
        auctionsWon  += 1;
        totalWonValue += winner.amount;
        cs.auctionsWon += 1;
        cs.wonValue    += winner.amount;

        if (a.status === 'closed') statusWinning += 1;
        else                       statusActive  += 1;
      } else if (a.status === 'active') {
        /* Încă deschisă — calificată ca "pending" pentru distribuție status. */
        if (myBest && winner && myBest.amount === winner.amount) statusWinning += 1;
        else                                                     statusActive  += 1;
      } else if (a.status === 'cancelled') {
        statusCancelled += 1;
      } else if (finalized) {
        statusLost += 1;

        /* Close loss — diferență ≤ 5% față de oferta câștigătoare. */
        if (myBest && winner && winner.amount > 0) {
          const diffAmt     = myBest.amount - winner.amount;
          const diffPercent = (diffAmt / winner.amount) * 100;
          if (diffAmt >= 0 && diffPercent <= CLOSE_LOSS_THRESHOLD_PERCENT) {
            closeLosses.push({
              auctionId:        aid,
              auctionTitle:     a.title || 'Licitație',
              category:         cat,
              myBid:            round2(myBest.amount),
              winningBid:       round2(winner.amount),
              differenceAmount: round2(diffAmt),
              differencePercent: round2(diffPercent),
              endedAt:          a.endedNotifiedAt || a.updatedAt,
            });
          }
        }
      }

      /* Last-period agregări. */
      if (periodMin) {
        const closedAt = a.endedNotifiedAt || a.updatedAt;
        last30Bids += myBidsHere.filter(b => new Date(b.createdAt) >= periodMin).length;

        if (iWon && finalized && closedAt && new Date(closedAt) >= periodMin) {
          last30Won      += 1;
          last30WonValue += winner.amount;
        }
        /* Numărăm close losses din ultima perioadă. */
        if (!iWon && finalized && closedAt && new Date(closedAt) >= periodMin
            && myBest && winner && winner.amount > 0) {
          const diffPercent = ((myBest.amount - winner.amount) / winner.amount) * 100;
          if (diffPercent >= 0 && diffPercent <= CLOSE_LOSS_THRESHOLD_PERCENT) {
            last30CloseLosses += 1;
          }
        }
      }
    }

    /* Sortare close losses descrescător după dată; păstrăm top N. */
    closeLosses.sort((a, b) => new Date(b.endedAt || 0) - new Date(a.endedAt || 0));
    const closeLossesTrimmed = closeLosses.slice(0, CLOSE_LOSS_MAX_RESULTS);

    /* Win rate. */
    const winRate = uniqueAuctions > 0 ? (auctionsWon / uniqueAuctions) * 100 : 0;
    const last30WinRate = (last30Won + last30CloseLosses + (last30Bids > 0 ? 1 : 0)) > 0 && last30Won + last30CloseLosses > 0
      ? (last30Won / Math.max(1, last30Won + last30CloseLosses)) * 100
      : 0;

    /* Rating mediu — direct din userul curent (cache). */
    const me = await User.findById(supplierId).select('rating reviewCount').lean();

    /* Distribuție review-uri pe stele. */
    const ratingDist = await Review.aggregate([
      { $match: { reviewee: supplierId, isHidden: false } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]);
    const ratingDistribution = [1, 2, 3, 4, 5].map(star => ({
      star,
      count: ratingDist.find(r => r._id === star)?.count || 0,
    }));

    /* Top categorii (sortat după wins, apoi participări). */
    const topCategories = [...catStats.entries()]
      .map(([category, s]) => ({
        category,
        bidsSubmitted: s.bidsSubmitted,
        auctionsWon:   s.auctionsWon,
        participated:  s.participated,
        winRate:       s.participated > 0 ? round2((s.auctionsWon / s.participated) * 100) : 0,
        wonValue:      round2(s.wonValue),
      }))
      .sort((a, b) => b.auctionsWon - a.auctionsWon || b.participated - a.participated)
      .slice(0, TOP_CATEGORIES_LIMIT);

    const bidStatusDistribution = [
      { status: 'winning',   count: statusWinning },
      { status: 'active',    count: statusActive },
      { status: 'lost',      count: statusLost },
      { status: 'cancelled', count: statusCancelled },
    ];

    logger.fromReq(req).audit(EVENTS.ANALYTICS.SUPPLIER_FETCH,
      `Supplier analytics fetched`, {
        entityType: 'user',
        entityId:   req.user.id,
        metadata: {
          totalBids:   totalBidsSubmitted,
          auctionsWon,
          period: req.query.period || '30d',
        },
      });

    res.json({
      summary: {
        totalBidsSubmitted,
        uniqueAuctionsParticipated: uniqueAuctions,
        auctionsWon,
        winRate:           round2(winRate),
        totalWonValue:     round2(totalWonValue),
        averageWonValue:   auctionsWon > 0 ? round2(totalWonValue / auctionsWon) : 0,
        averageRating:     me?.rating ?? null,
        reviewCount:       me?.reviewCount ?? 0,
        closeLossCount:    closeLosses.length,
      },
      last30Days: {
        bidsSubmitted:  last30Bids,
        auctionsWon:    last30Won,
        wonValue:       round2(last30WonValue),
        winRate:        round2(last30WinRate),
        closeLossCount: last30CloseLosses,
      },
      topCategories,
      closeLosses: closeLossesTrimmed,
      bidStatusDistribution,
      ratingDistribution,
    });

  } catch (err) {
    logger.logReqError(req, EVENTS.ANALYTICS.CALC_ERROR, err);
    res.status(500).json({ message: 'Eroare la calculul statisticilor' });
  }
});

module.exports = router;
