'use strict';

/**
 * RevBid — Populare statistici furnizor (mockup)
 * ─────────────────────────────────────────────────────────────
 * Țintă: supplier@test.com (Mihai Ionescu / Mihai IT SRL)
 *
 * Generează un istoric realist care alimentează pagina
 *   /dashboard/statistici (furnizor):
 *     • oferte trimise pe ~30 licitații unice
 *     • ~14 licitații câștigate (win rate ~45%)
 *     • close-losses (pierderi la diferență < 5%)
 *     • pierderi la diferență mare
 *     • licitații active în desfășurare
 *     • o licitație anulată
 *     • review-uri din partea cumpărătorilor (distribuție pe stele)
 *
 * Datele sunt eșalonate pe ultimele ~90 de zile, astfel încât
 * filtrele de perioadă (30d / 90d / tot istoricul) să afișeze date.
 *
 * Rulare:   node seed-supplier-stats.js
 * (scriptul curăță automat propriile date marcate înainte de re-rulare)
 */

require('dotenv').config();
const mongoose = require('mongoose');

const User    = require('./models/User');
const Auction = require('./models/Auction');
const Bid     = require('./models/Bid');
const Review  = require('./models/Review');

const MARKER          = 'seed-mihai-stats';   // tag de identificare a datelor generate
const SUPPLIER_EMAIL  = 'supplier@test.com';

/* ── Helpers ──────────────────────────────────────────────── */
const rnd       = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick      = arr        => arr[rnd(0, arr.length - 1)];
const daysAgo   = d          => new Date(Date.now() - d * 86400000);
const daysAhead = d          => new Date(Date.now() + d * 86400000);
const r2        = n          => Math.round(n);

/* ── Pool-uri de conținut realist (profil IT / servicii tehnice) ── */
const CATALOG = [
  { category: 'IT & Software', titles: [
    'Implementare ERP modul financiar-contabil',
    'Dezvoltare aplicație web internă de gestiune',
    'Migrare infrastructură on-premise în cloud Azure',
    'Mentenanță și suport software 12 luni',
    'Integrare API între CRM și platforma de facturare',
    'Modernizare website corporativ + CMS',
    'Licențiere și implementare soluție BI',
    'Dezvoltare aplicație mobilă iOS + Android',
  ], min: 28000, max: 140000 },
  { category: 'Securitate', titles: [
    'Audit securitate IT + penetration testing',
    'Implementare soluție SIEM și monitorizare',
    'Configurare firewall next-gen și VPN corporativ',
    'Servicii SOC managed 12 luni',
  ], min: 24000, max: 90000 },
  { category: 'Telecomunicații', titles: [
    'Cablare structurată rețea sediu nou',
    'Echipamente networking + switch-uri management',
    'Soluție VoIP centralizată 80 linii',
  ], min: 18000, max: 70000 },
  { category: 'Servicii', titles: [
    'Servicii consultanță transformare digitală',
    'Externalizare helpdesk IT nivel 1 și 2',
    'Training competențe digitale pentru angajați',
  ], min: 14000, max: 60000 },
  { category: 'Marketing & PR', titles: [
    'Platformă automatizare marketing + integrare',
    'Dezvoltare magazin online e-commerce',
  ], min: 16000, max: 75000 },
  { category: 'Mobilier & Echipamente', titles: [
    'Furnizare stații de lucru + monitoare 4K',
    'Echipamente sală de conferințe hibridă',
  ], min: 30000, max: 95000 },
];

const BID_MESSAGES = [
  'Soluția noastră include implementare completă, training și suport 12 luni.',
  'Avem experiență dovedită în proiecte similare, cu referințe verificabile.',
  'Preț competitiv cu livrare în termenul solicitat. Garanție extinsă inclusă.',
  'Echipă certificată, metodologie agilă, livrabile în sprint-uri clare.',
  'Oferim suport tehnic dedicat și SLA garantat prin contract.',
  'Includem mentenanță gratuită primele 6 luni post-implementare.',
  'Costul acoperă licențe, configurare și documentație tehnică completă.',
];

const REVIEW_COMMENTS = {
  5: [
    'Colaborare excelentă, livrare la timp și comunicare impecabilă. Recomand cu încredere!',
    'Profesioniști adevărați. Au depășit așteptările, calitate superioară.',
    'Proiect finalizat perfect, suport prompt. Vom colabora din nou cu siguranță.',
    'Echipă serioasă și foarte competentă. Totul a mers ca la carte.',
  ],
  4: [
    'Foarte mulțumiți de rezultat. Câteva întârzieri minore, dar calitate bună.',
    'Implementare solidă și comunicare bună. Recomand.',
    'Lucrare de calitate, raport preț-valoare corect.',
  ],
  3: [
    'Rezultat acceptabil, dar comunicarea putea fi mai bună pe parcurs.',
    'Și-au făcut treaba, însă au existat câteva ajustări necesare ulterior.',
  ],
};

/* ── Generator scenarii licitații ────────────────────────────
   Fiecare scenariu produce o licitație + setul ei de oferte. */
function makeAuctionSpec(kind, buyer, mihaiId, otherSuppliers, closeDayOrDeadline) {
  const cat   = pick(CATALOG);
  const title = pick(cat.titles);
  const startPrice = r2(rnd(cat.min, cat.max) / 1000) * 1000;

  const spec = {
    auction: {
      buyer:      buyer._id,
      title,
      description: `${title}. Solicităm ofertă completă cu specificații tehnice, termen de execuție și condiții de garanție. Bugetul de pornire este orientativ — așteptăm oferte competitive din partea furnizorilor calificați.`,
      category:   cat.category,
      quantity:   pick(['1 proiect complet', '1 contract / 12 luni', 'Conform caiet de sarcini', '1 implementare la cheie']),
      tags:       [MARKER, cat.category.toLowerCase().split(' ')[0]],
      startPrice,
      location:   { city: buyer.city || 'București', address: '' },
    },
    bids:        [],
    winnerIndex: null,   // index în spec.bids al ofertei câștigătoare
  };

  /* Construiește oferte concurente descrescător de la startPrice. */
  const nOthers = rnd(2, 3);
  const shuffled = [...otherSuppliers].sort(() => Math.random() - 0.5).slice(0, nOthers);
  let price = startPrice;
  const otherBids = shuffled.map((sup, i) => {
    const drop = 0.04 + Math.random() * 0.07;
    price = r2(price * (1 - drop));
    return { supplier: sup._id, amount: price };
  });
  const lowestOther = otherBids[otherBids.length - 1].amount;

  if (kind === 'won') {
    /* Mihai face oferta câștigătoare (cea mai mică). Uneori 2 oferte. */
    const finalMihai = r2(lowestOther * (0.95 + Math.random() * 0.035));
    const mihaiBids = [];
    if (Math.random() > 0.45) {
      // o ofertă inițială mai mare, apoi cea câștigătoare
      mihaiBids.push({ supplier: mihaiId, amount: r2(lowestOther * (1.02 + Math.random() * 0.05)) });
    }
    mihaiBids.push({ supplier: mihaiId, amount: finalMihai });

    spec.bids = [...otherBids, ...mihaiBids];
    spec.winnerIndex = spec.bids.length - 1;       // ultima ofertă Mihai
    spec.auction.status       = 'closed';
    spec.auction.currentPrice = finalMihai;
    spec.auction.publishedAt  = new Date(closeDayOrDeadline.getTime() - rnd(6, 16) * 86400000);
    spec.auction.createdAt    = spec.auction.publishedAt;
    spec.auction.deadline     = closeDayOrDeadline;
    spec.auction.endedNotifiedAt      = closeDayOrDeadline;
    spec.auction.endNotificationsSent = true;
    spec.auction.updatedAt    = closeDayOrDeadline;

  } else if (kind === 'closeLoss') {
    /* Un alt furnizor câștigă cu puțin sub Mihai (diferență < 5%). */
    const winnerAmt = lowestOther;
    const mihaiBest = r2(winnerAmt * (1.012 + Math.random() * 0.032)); // +1.2%..+4.4%
    spec.bids = [...otherBids, { supplier: mihaiId, amount: mihaiBest }];
    // câștigător = ultima ofertă "other" (cea mai mică)
    spec.winnerIndex = otherBids.length - 1;
    spec.auction.status       = 'closed';
    spec.auction.currentPrice = winnerAmt;
    spec.auction.publishedAt  = new Date(closeDayOrDeadline.getTime() - rnd(6, 16) * 86400000);
    spec.auction.createdAt    = spec.auction.publishedAt;
    spec.auction.deadline     = closeDayOrDeadline;
    spec.auction.endedNotifiedAt      = closeDayOrDeadline;
    spec.auction.endNotificationsSent = true;
    spec.auction.updatedAt    = closeDayOrDeadline;

  } else if (kind === 'bigLoss') {
    /* Pierdere la diferență mare (> 10%). */
    const winnerAmt = lowestOther;
    const mihaiBest = r2(winnerAmt * (1.12 + Math.random() * 0.15));
    spec.bids = [...otherBids, { supplier: mihaiId, amount: mihaiBest }];
    spec.winnerIndex = otherBids.length - 1;
    spec.auction.status       = 'closed';
    spec.auction.currentPrice = winnerAmt;
    spec.auction.publishedAt  = new Date(closeDayOrDeadline.getTime() - rnd(6, 16) * 86400000);
    spec.auction.createdAt    = spec.auction.publishedAt;
    spec.auction.deadline     = closeDayOrDeadline;
    spec.auction.endedNotifiedAt      = closeDayOrDeadline;
    spec.auction.endNotificationsSent = true;
    spec.auction.updatedAt    = closeDayOrDeadline;

  } else if (kind === 'active') {
    /* Licitație în desfășurare — Mihai a depus oferte, fără câștigător marcat. */
    const mihaiAmt = r2(lowestOther * (0.96 + Math.random() * 0.06));
    const mihaiBids = [{ supplier: mihaiId, amount: mihaiAmt }];
    spec.bids = [...otherBids, ...mihaiBids];
    spec.winnerIndex = null;  // nicio ofertă isWinning pe licitații active
    spec.auction.status       = 'active';
    spec.auction.currentPrice = Math.min(mihaiAmt, lowestOther);
    spec.auction.publishedAt  = daysAgo(rnd(1, 8));
    spec.auction.createdAt    = spec.auction.publishedAt;
    spec.auction.deadline     = closeDayOrDeadline; // în viitor

  } else if (kind === 'cancelled') {
    const mihaiAmt = r2(lowestOther * 0.97);
    spec.bids = [...otherBids, { supplier: mihaiId, amount: mihaiAmt }];
    spec.winnerIndex = null;
    spec.auction.status       = 'cancelled';
    spec.auction.currentPrice = spec.auction.startPrice;
    spec.auction.publishedAt  = daysAgo(rnd(20, 50));
    spec.auction.createdAt    = spec.auction.publishedAt;
    spec.auction.deadline     = daysAgo(rnd(2, 10));
    spec.auction.updatedAt    = daysAgo(rnd(1, 8));
  }

  /* Timestamp-uri pentru oferte — între publicare și închidere/acum. */
  const startT = spec.auction.publishedAt.getTime();
  const endT   = (spec.auction.endedNotifiedAt || spec.auction.deadline || new Date()).getTime();
  const span   = Math.max(endT - startT, 3600000);
  spec.bids.forEach((b, i) => {
    const t = startT + Math.floor(span * ((i + 1) / (spec.bids.length + 1)));
    b.createdAt = new Date(Math.min(t, Date.now()));
  });

  return spec;
}

/* ── MAIN ─────────────────────────────────────────────────── */
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB conectat');

  const mihai = await User.findOne({ email: SUPPLIER_EMAIL });
  if (!mihai) { console.error(`❌ Contul ${SUPPLIER_EMAIL} nu există.`); process.exit(1); }
  if (mihai.role !== 'supplier') { console.error('❌ Contul nu are rol de furnizor.'); process.exit(1); }

  const buyers = await User.find({ role: 'buyer' }).lean();
  const otherSuppliers = await User.find({ role: 'supplier', _id: { $ne: mihai._id } }).lean();
  if (buyers.length === 0 || otherSuppliers.length < 2) {
    console.error('❌ Sunt necesari cumpărători și cel puțin 2 alți furnizori. Rulează întâi `node seed.js`.');
    process.exit(1);
  }

  /* ── Curăță datele generate anterior de acest script ── */
  const oldAuctions = await Auction.find({ tags: MARKER }).select('_id').lean();
  const oldIds = oldAuctions.map(a => a._id);
  if (oldIds.length) {
    await Promise.all([
      Bid.deleteMany({ auction: { $in: oldIds } }),
      Review.deleteMany({ auction: { $in: oldIds } }),
      Auction.deleteMany({ _id: { $in: oldIds } }),
    ]);
    console.log(`🧹 Șterse ${oldIds.length} licitații generate anterior (+ oferte/review-uri)`);
  }

  /* ── Plan scenarii ──
     win:14, closeLoss:5, bigLoss:4, active:6, cancelled:1  → 30 licitații unice */
  const plan = [];

  /* WON — eșalonat: 6 în <30z, 5 în 30-90z, 3 >90z */
  const wonDays = [
    ...Array.from({ length: 6 }, () => daysAgo(rnd(2, 29))),
    ...Array.from({ length: 5 }, () => daysAgo(rnd(31, 88))),
    ...Array.from({ length: 3 }, () => daysAgo(rnd(95, 150))),
  ];
  wonDays.forEach(d => plan.push({ kind: 'won', when: d }));

  /* CLOSE LOSS — 2 în <30z, 2 în 30-90z, 1 >90z */
  const closeDays = [
    ...Array.from({ length: 2 }, () => daysAgo(rnd(3, 28))),
    ...Array.from({ length: 2 }, () => daysAgo(rnd(33, 85))),
    ...Array.from({ length: 1 }, () => daysAgo(rnd(95, 140))),
  ];
  closeDays.forEach(d => plan.push({ kind: 'closeLoss', when: d }));

  /* BIG LOSS — 1 în <30z, 2 în 30-90z, 1 >90z */
  const bigDays = [
    daysAgo(rnd(5, 27)),
    daysAgo(rnd(35, 80)), daysAgo(rnd(35, 80)),
    daysAgo(rnd(95, 130)),
  ];
  bigDays.forEach(d => plan.push({ kind: 'bigLoss', when: d }));

  /* ACTIVE — deadline în viitor */
  for (let i = 0; i < 6; i++) plan.push({ kind: 'active', when: daysAhead(rnd(2, 18)) });

  /* CANCELLED */
  plan.push({ kind: 'cancelled', when: null });

  /* ── Construiește specs ── */
  const specs = plan.map(p =>
    makeAuctionSpec(p.kind, pick(buyers), mihai._id, otherSuppliers, p.when || daysAgo(30))
  );

  /* ── Inserează licitațiile (fără winningBid încă) ── */
  const auctionDocs = await Auction.insertMany(specs.map(s => s.auction));
  console.log(`📋 ${auctionDocs.length} licitații inserate`);

  /* ── Construiește toate ofertele cu auctionId, urmărind câștigătorii ── */
  const allBids = [];
  const winnerPositions = []; // { auctionId, posInAllBids } pentru câștigători
  specs.forEach((spec, ai) => {
    const auctionId = auctionDocs[ai]._id;
    spec.bids.forEach((b, bi) => {
      const isWinning = spec.winnerIndex === bi;
      if (isWinning) winnerPositions.push({ auctionId, pos: allBids.length });
      allBids.push({
        auction:   auctionId,
        supplier:  b.supplier,
        amount:    b.amount,
        message:   pick(BID_MESSAGES),
        isWinning,
        createdAt: b.createdAt,
        updatedAt: b.createdAt,
      });
    });
  });

  const insertedBids = await Bid.insertMany(allBids);
  console.log(`💰 ${insertedBids.length} oferte inserate (${winnerPositions.length} câștigătoare)`);

  /* ── Setează winningBid pe licitațiile cu câștigător ── */
  await Promise.all(winnerPositions.map(wp =>
    Auction.findByIdAndUpdate(wp.auctionId, { winningBid: insertedBids[wp.pos]._id })
  ));

  /* ── Review-uri pentru Mihai (din partea cumpărătorilor licitațiilor câștigate) ── */
  const wonAuctionIdx = specs
    .map((s, i) => (s.auction.status === 'closed' && s.winnerIndex !== null
                    && s.bids[s.winnerIndex].supplier.equals(mihai._id)) ? i : -1)
    .filter(i => i >= 0);

  /* Distribuție stele țintă: 7×5★, 4×4★, 2×3★ = 13 review-uri */
  const starPlan = [5,5,5,5,5,5,5, 4,4,4,4, 3,3];
  const reviewsToCreate = [];
  const usedAuctions = new Set();
  let starI = 0;
  for (const idx of wonAuctionIdx) {
    if (starI >= starPlan.length) break;
    const auctionDoc = auctionDocs[idx];
    if (usedAuctions.has(auctionDoc._id.toString())) continue;
    usedAuctions.add(auctionDoc._id.toString());
    const star = starPlan[starI++];
    reviewsToCreate.push({
      auction:      auctionDoc._id,
      reviewer:     auctionDoc.buyer,
      reviewee:     mihai._id,
      reviewerRole: 'buyer',
      revieweeRole: 'supplier',
      rating:       star,
      comment:      pick(REVIEW_COMMENTS[star]),
      createdAt:    auctionDoc.endedNotifiedAt || daysAgo(rnd(1, 60)),
      updatedAt:    auctionDoc.endedNotifiedAt || daysAgo(rnd(1, 60)),
    });
  }
  const insertedReviews = await Review.insertMany(reviewsToCreate);
  console.log(`⭐ ${insertedReviews.length} review-uri inserate`);

  /* ── Recalculează rating-ul mediu și numărul de review-uri pe user ── */
  const allMihaiReviews = await Review.find({ reviewee: mihai._id, isHidden: false }).select('rating').lean();
  const reviewCount = allMihaiReviews.length;
  const avg = reviewCount > 0
    ? allMihaiReviews.reduce((s, r) => s + r.rating, 0) / reviewCount
    : 0;
  mihai.rating      = Math.round(avg * 10) / 10;
  mihai.reviewCount = reviewCount;
  await mihai.save();

  /* ── Sumar ── */
  const wonCount   = specs.filter(s => s.auction.status === 'closed' && s.winnerIndex !== null && s.bids[s.winnerIndex].supplier.equals(mihai._id)).length;
  const mihaiBids  = allBids.filter(b => b.supplier.equals(mihai._id)).length;

  console.log('\n🎉 Statistici populate pentru', SUPPLIER_EMAIL);
  console.log('──────────────────────────────────────');
  console.log(`  Licitații unice cu participare : ${specs.length}`);
  console.log(`  Oferte trimise de Mihai        : ${mihaiBids}`);
  console.log(`  Licitații câștigate            : ${wonCount}`);
  console.log(`  Win rate                       : ${(wonCount / specs.length * 100).toFixed(1)}%`);
  console.log(`  Close losses (<5%)             : 5`);
  console.log(`  Rating mediu                   : ${mihai.rating} (${mihai.reviewCount} review-uri)`);
  console.log('──────────────────────────────────────');
  console.log('  Login: supplier@test.com → /dashboard/statistici');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Eroare:', err);
  process.exit(1);
});
