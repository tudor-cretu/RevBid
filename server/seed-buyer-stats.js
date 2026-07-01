'use strict';

/**
 * RevBid — Populare statistici cumpărător (mockup)
 * ─────────────────────────────────────────────────────────────
 * Țintă: buyer@test.com (Eugen Klaus)
 *
 * Generează un istoric realist care alimentează BuyerAnalytics:
 *   • 20 licitații închise (cu economii reale, furnizori câștigători)
 *   • 3 licitații anulate
 *   • 2 drafturi parțiale
 *   • Bids simulate pe fiecare licitație (3-5 furnizori)
 *   • Economii eșalonate pe 90+ zile → toate filtrele (30d/90d/all)
 *   • 5 furnizori preferați cu 2-4 colaborări fiecare
 *
 * Rulare:   node seed-buyer-stats.js
 * Curăță și re-generează: node seed-buyer-stats.js  (idempotent)
 */

require('dotenv').config();
const mongoose = require('mongoose');

const User    = require('./models/User');
const Auction = require('./models/Auction');
const Bid     = require('./models/Bid');

const MARKER       = 'seed-eugen-stats';
const BUYER_EMAIL  = 'buyer@test.com';

/* ── Helpers ──────────────────────────────────────────────── */
const rnd      = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick     = arr        => arr[rnd(0, arr.length - 1)];
const daysAgo  = d          => new Date(Date.now() - d * 86400000);
const daysAhead = d         => new Date(Date.now() + d * 86400000);
const r1k      = n          => Math.round(n / 500) * 500;

/* ── Catalog licitații realiste (profil companie medie) ─── */
const CATALOG = [
  {
    category: 'IT & Software',
    items: [
      { title: 'Implementare sistem ERP pentru producție',
        desc:  'Achiziție și implementare ERP pentru urmărirea producției, gestiunea stocurilor și planificarea resurselor. Module: producție, aprovizionare, vânzări, contabilitate. Training echipă 10 utilizatori inclus.',
        qty:   '1 sistem / 10 licențe utilizator', min: 85000, max: 180000 },
      { title: 'Servicii hosting cloud și backup gestionat',
        desc:  'Servicii hosting cloud dedicat pentru 3 servere virtuale + backup automat zilnic, monitorizare 24/7, SLA 99.9%, raport lunar. Contract 12 luni.',
        qty:   '3 servere virtuale / 12 luni', min: 22000, max: 55000 },
      { title: 'Aplicație web pentru managementul documentelor',
        desc:  'Dezvoltare platformă DMS cu OCR, semnătură electronică, fluxuri de aprobare, integrare cu Active Directory. Livrare în 4 luni.',
        qty:   '1 platformă / 50 utilizatori', min: 48000, max: 110000 },
      { title: 'Licențe antivirus endpoint pentru 200 stații',
        desc:  'Licențe antivirus enterprise cu protecție endpoint, EDR, management centralizat, politici GPO. Perioadă 2 ani.',
        qty:   '200 licențe / 24 luni', min: 18000, max: 42000 },
    ],
  },
  {
    category: 'Construcții & Renovări',
    items: [
      { title: 'Reabilitare termică faţadă clădire birouri',
        desc:  'Izolare termică exterioară (vată minerală 15cm) + tencuială decorativă + termopane noi pentru clădire P+3. Avize și proiect incluse.',
        qty:   '1200 mp faţadă', min: 120000, max: 260000 },
      { title: 'Amenajare parcare exterioară 50 locuri',
        desc:  'Realizare parcare asfaltată 50 locuri: terasament, fundație balast, strat bitum, marcaje, borduri, iluminat LED, sistem control acces.',
        qty:   '50 locuri parcare', min: 65000, max: 130000 },
      { title: 'Instalații HVAC sediu administrativ 600 mp',
        desc:  'Proiectare și instalare sistem HVAC pentru sediu 600mp: centrale VRV, ventiloconvectoare, ventilație mecanică, automatizare BMS.',
        qty:   '600 mp / sistem complet', min: 90000, max: 195000 },
    ],
  },
  {
    category: 'Servicii',
    items: [
      { title: 'Externalizare servicii IT helpdesk — 12 luni',
        desc:  'Suport tehnic helpdesk nivel 1-2 pentru 150 utilizatori: ticketing, SLA 4h, intervenție remote și on-site, raportare lunară.',
        qty:   '150 utilizatori / 12 luni', min: 36000, max: 84000 },
      { title: 'Audit energetic și certificat performanță',
        desc:  'Audit energetic complet pentru clădire industrială 2500mp + certificat energetic + recomandări eficiență, raport conform legislației.',
        qty:   '1 audit complet / 2500 mp', min: 14000, max: 30000 },
      { title: 'Servicii curierat B2B — contract anual',
        desc:  'Contract curierat pentru 8 puncte de lucru: ridicare zilnică, livrare națională next-day, internațional 3-5 zile, tracking real-time.',
        qty:   '8 puncte lucru / 12 luni / ~500 colete/lună', min: 28000, max: 65000 },
      { title: 'Servicii juridice — consultanță contracte comerciale',
        desc:  'Retainer lunar servicii juridice: redactare/revizuire contracte comerciale, due diligence, consultanță GDPR, reprezentare negocieri.',
        qty:   '20 ore/lună × 12 luni', min: 48000, max: 96000 },
    ],
  },
  {
    category: 'Mobilier & Echipamente',
    items: [
      { title: 'Dotare birou open-space 60 locuri de muncă',
        desc:  'Furnizare și montaj mobilier open-space: birouri reglabile electric (60), scaune ergonomice (60), cabiete cu sertar, panouri fonoabsorbante.',
        qty:   '60 stații de lucru complete', min: 90000, max: 200000 },
      { title: 'Echipamente bucătărie industrială restaurant',
        desc:  'Dotare bucătărie restaurant 80 locuri: linie gătit inox, frigidere profesionale, combinator, mașini spălat vase, hote, rasteluri.',
        qty:   'Dotare completă bucătărie 40 mp', min: 75000, max: 160000 },
      { title: 'Copiatoare multifuncționale color A3 — 8 buc',
        desc:  'Furnizare 8 copiatoare multifuncționale A3 color: 45ppm, scanare rețea, imprimare față-verso, duplex, leasing sau cumpărare. Contract service inclus.',
        qty:   '8 copiatoare MFP A3', min: 40000, max: 88000 },
    ],
  },
  {
    category: 'Marketing & PR',
    items: [
      { title: 'Producție video corporate + spoturi publicitare',
        desc:  'Realizare film corporativ 3-5 min + 3 spoturi TV 30" pentru campanie brand: scenariu, filmare, editare, color grading, muzică licențiată.',
        qty:   '1 film + 3 spoturi', min: 32000, max: 75000 },
      { title: 'Strategie și execuție social media — 12 luni',
        desc:  'Management complet conturi sociale (Facebook, Instagram, LinkedIn, TikTok): strategie, content plan, 20 postări/lună, advertising, raportare.',
        qty:   '4 platforme / 12 luni / 240 postări', min: 36000, max: 72000 },
    ],
  },
  {
    category: 'Logistică & Transport',
    items: [
      { title: 'Închiriere depozit logistic 2000 mp — 12 luni',
        desc:  'Spațiu depozitare 2000mp, înălțime 8m, rampe descărcare TIR, sistem antiincendiu, pază 24/7, birou administrație inclus, zona metropolitană.',
        qty:   '2000 mp / 12 luni', min: 120000, max: 240000 },
      { title: 'Transport distribuție locală — contract anual',
        desc:  'Servicii transport distribuție zilnică în 5 județe: 3 autoutilitare dedicate, sisteme GPS, delegat distribuție, raport zilnic livrări.',
        qty:   '3 autoutilitare / 250 zile lucrătoare', min: 55000, max: 110000 },
    ],
  },
];

const BID_MESSAGES = [
  'Ofertă completă cu specificații tehnice, termen garantat și suport inclus.',
  'Experiență dovedită în proiecte similare. Referințe disponibile la cerere.',
  'Prețul include toate materialele, manopera și garanția de 24 luni.',
  'Echipă certificată, livrare în termenul solicitat, factură cu TVA.',
  'Soluție turnkey, fără costuri ascunse. SLA garantat prin contract.',
  'Garanție extinsă, service rapid, piese de schimb pe stoc permanent.',
  'Ofertă validă 30 zile. Disponibili pentru vizită și prezentare detaliată.',
];

/* ── Construiește spec-ul unei licitații închise ─────────── */
function makeClosedSpec(buyer, item, category, closeDay, winners, otherSuppliers) {
  const startPrice = r1k(rnd(item.min, item.max));
  /* Economie 12-24% față de startPrice */
  const savingPct  = 0.12 + Math.random() * 0.12;
  const finalPrice = r1k(startPrice * (1 - savingPct));

  /* Alege câștigătorul din pool-ul "preferați" */
  const winner = pick(winners);

  /* 2-4 alți furnizori care au ofertat mai mult decât câștigătorul */
  const nOthers = rnd(2, 4);
  const pool     = otherSuppliers.filter(s => !s._id.equals(winner._id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, nOthers);

  const otherBids = shuffled.map((sup, i) => ({
    supplier: sup._id,
    amount:   r1k(finalPrice * (1.06 + i * 0.03 + Math.random() * 0.05)),
  }));

  const winnerBid = { supplier: winner._id, amount: finalPrice };
  const allBids   = [...otherBids, winnerBid];

  /* Timestamps */
  const publishedAt = new Date(closeDay.getTime() - rnd(8, 20) * 86400000);
  allBids.forEach((b, i) => {
    const span = closeDay.getTime() - publishedAt.getTime();
    b.createdAt = new Date(publishedAt.getTime() + Math.floor(span * (i + 1) / (allBids.length + 1)));
  });

  return {
    auction: {
      buyer:       buyer._id,
      title:       item.title,
      description: item.desc,
      category,
      quantity:    item.qty,
      tags:        [MARKER, category.toLowerCase().split(' ')[0]],
      startPrice,
      currentPrice: finalPrice,
      status:      'closed',
      publishedAt,
      createdAt:   publishedAt,
      deadline:    closeDay,
      endedNotifiedAt:      closeDay,
      endNotificationsSent: true,
      updatedAt:   closeDay,
      location:    { city: buyer.city || 'București', address: '' },
    },
    bids:        allBids,
    winnerBidIdx: allBids.length - 1,  // ultimul = câștigătorul
  };
}

/* ── MAIN ─────────────────────────────────────────────────── */
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB conectat');

  const buyer = await User.findOne({ email: BUYER_EMAIL });
  if (!buyer) { console.error(`❌ Contul ${BUYER_EMAIL} nu există.`); process.exit(1); }
  if (buyer.role !== 'buyer') { console.error('❌ Contul nu e buyer.'); process.exit(1); }

  const allSuppliers = await User.find({ role: 'supplier' }).lean();
  if (allSuppliers.length < 5) {
    console.error('❌ Sunt necesari cel puțin 5 furnizori. Rulează întâi `node seed.js`.');
    process.exit(1);
  }

  /* ── Curăță datele generate anterior ── */
  const oldAuctions = await Auction.find({ tags: MARKER }).select('_id').lean();
  const oldIds = oldAuctions.map(a => a._id);
  if (oldIds.length) {
    await Promise.all([
      Bid.deleteMany({ auction: { $in: oldIds } }),
      Auction.deleteMany({ _id: { $in: oldIds } }),
    ]);
    console.log(`🧹 Șterse ${oldIds.length} licitații anterioare + ofertele lor`);
  }

  /* ── 5 furnizori "preferați" — câștigă de mai multe ori ── */
  const shuffled = [...allSuppliers].sort(() => Math.random() - 0.5);
  const winners    = shuffled.slice(0, 5);
  const otherSups  = shuffled.slice(5);

  /* ── Plan 20 licitații închise ──────────────────────────────
     Distribuție:
       8 în ultimele 30 zile  (pentru filtrul 30d)
       7 între 31-90 zile     (apar în 90d și all)
       5 între 91-150 zile    (apar doar în all)          */
  const closedPlan = [
    /* Last 30d */
    ...Array.from({ length: 8 }, () => ({ closeDay: daysAgo(rnd(2, 28)) })),
    /* 31-90d */
    ...Array.from({ length: 7 }, () => ({ closeDay: daysAgo(rnd(32, 88)) })),
    /* >90d */
    ...Array.from({ length: 5 }, () => ({ closeDay: daysAgo(rnd(95, 148)) })),
  ];

  /* Alocă categorii și iteme din catalog */
  const allItems = CATALOG.flatMap(c => c.items.map(i => ({ ...i, category: c.category })));
  const shuffledItems = [...allItems].sort(() => Math.random() - 0.5);
  while (shuffledItems.length < closedPlan.length) {
    shuffledItems.push(...[...allItems].sort(() => Math.random() - 0.5));
  }

  /* Construiește specs */
  const closedSpecs = closedPlan.map((p, i) =>
    makeClosedSpec(buyer, shuffledItems[i], shuffledItems[i].category, p.closeDay, winners, otherSups)
  );

  /* ── 3 licitații anulate ── */
  const cancelledSpecs = Array.from({ length: 3 }, (_, i) => {
    const item = pick(allItems);
    const sp   = r1k(rnd(item.min, item.max));
    const pub  = daysAgo(rnd(20, 60));
    return {
      auction: {
        buyer:       buyer._id,
        title:       item.title,
        description: item.desc,
        category:    item.category,
        quantity:    item.qty,
        tags:        [MARKER, item.category.toLowerCase().split(' ')[0]],
        startPrice:  sp,
        currentPrice: sp,
        status:      'cancelled',
        publishedAt: pub,
        createdAt:   pub,
        deadline:    daysAgo(rnd(2, 15)),
        updatedAt:   daysAgo(rnd(1, 10)),
        location:    { city: buyer.city || 'București', address: '' },
      },
      bids:        [],
      winnerBidIdx: null,
    };
  });

  /* ── 2 draft-uri ── */
  const draftItems = [
    { category: 'IT & Software',
      title: 'Implementare soluție CRM pentru echipa de vânzări',
      desc:  'CRM cloud pentru 25 utilizatori: pipeline, ofertare, integrare email/calendar, rapoarte sales.',
      qty:   '25 utilizatori / 12 luni', min: 28000, max: 65000 },
    { category: 'Servicii',
      title: 'Servicii traducere și interpretariat pentru conferințe',
      desc:  'Traducere simultană EN-RO-FR pentru 5 conferințe anuale. Interpreți cu experiență tehnică.',
      qty:   '5 conferințe × 2 zile', min: 12000, max: 30000 },
  ];
  const draftSpecs = draftItems.map(item => ({
    auction: {
      buyer:       buyer._id,
      title:       item.title,
      description: item.desc,
      category:    item.category,
      quantity:    item.qty,
      tags:        [MARKER],
      startPrice:  r1k(rnd(item.min, item.max)),
      status:      'draft',
      createdAt:   daysAgo(rnd(1, 7)),
      location:    { city: buyer.city || 'București', address: '' },
    },
    bids:        [],
    winnerBidIdx: null,
  }));

  /* ── Inserează toate licitațiile ── */
  const allSpecs   = [...closedSpecs, ...cancelledSpecs, ...draftSpecs];
  const auctionDocs = await Auction.insertMany(allSpecs.map(s => s.auction));
  console.log(`📋 ${auctionDocs.length} licitații inserate (${closedSpecs.length} closed · ${cancelledSpecs.length} cancelled · ${draftSpecs.length} draft)`);

  /* ── Construiește ofertele ── */
  const allBidDocs      = [];
  const winnerPositions = [];  // { auctionIdx, posInAllBids }

  allSpecs.forEach((spec, ai) => {
    if (!spec.bids.length) return;
    spec.bids.forEach((b, bi) => {
      const isWinning = spec.winnerBidIdx === bi;
      if (isWinning) winnerPositions.push({ auctionIdx: ai, pos: allBidDocs.length });
      allBidDocs.push({
        auction:   auctionDocs[ai]._id,
        supplier:  b.supplier,
        amount:    b.amount,
        message:   pick(BID_MESSAGES),
        isWinning,
        createdAt: b.createdAt,
        updatedAt: b.createdAt,
      });
    });
  });

  const insertedBids = await Bid.insertMany(allBidDocs);
  console.log(`💰 ${insertedBids.length} oferte inserate (${winnerPositions.length} câștigătoare)`);

  /* ── Setează winningBid pe fiecare licitație închisă ── */
  await Promise.all(winnerPositions.map(wp =>
    Auction.findByIdAndUpdate(auctionDocs[wp.auctionIdx]._id, {
      winningBid: insertedBids[wp.pos]._id,
    })
  ));

  /* ── Statistici finale ── */
  const totalSaved = closedSpecs.reduce((s, sp) => s + (sp.auction.startPrice - sp.auction.currentPrice), 0);
  const avgSaving  = closedSpecs.reduce((s, sp) =>
    s + ((sp.auction.startPrice - sp.auction.currentPrice) / sp.auction.startPrice * 100), 0
  ) / closedSpecs.length;

  /* Count wins per furnizor preferat */
  const winCounts = {};
  closedSpecs.forEach(sp => {
    const winBid = sp.bids[sp.winnerBidIdx];
    if (winBid) {
      const sid = winBid.supplier.toString();
      winCounts[sid] = (winCounts[sid] || 0) + 1;
    }
  });

  /* Categorii */
  const catCounts = {};
  closedSpecs.forEach(sp => {
    catCounts[sp.auction.category] = (catCounts[sp.auction.category] || 0) + 1;
  });

  console.log('\n🎉 Statistici populate pentru', BUYER_EMAIL);
  console.log('─────────────────────────────────────────────');
  console.log(`  Licitații closed          : ${closedSpecs.length}`);
  console.log(`  Total economisit          : ${Math.round(totalSaved).toLocaleString('ro-RO')} RON`);
  console.log(`  Economie medie            : ${avgSaving.toFixed(1)}%`);
  console.log(`  Oferte primite            : ${insertedBids.length}`);
  console.log(`  Furnizori preferați (top5): ${winners.map(w => w.companyName || w.firstName).join(' · ')}`);
  console.log(`  Câștiguri per furnizor    : ${Object.entries(winCounts).map(([,v]) => v).join('/')}`);
  console.log(`  Categorii active          : ${Object.keys(catCounts).join(' · ')}`);
  console.log('─────────────────────────────────────────────');
  console.log('  Login: buyer@test.com → /dashboard/statistici');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Eroare:', err);
  process.exit(1);
});
