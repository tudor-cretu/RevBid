'use strict';

/**
 * RevBid — Script populare date de test (mockup)
 * ────────────────────────────────────────────────
 * Creează:
 *   • 8 cumpărători + 12 furnizori (toți cu parola: parola123)
 *   • 55 licitații realiste (active / closed / cancelled / draft)
 *   • Oferte simulate pe licitațiile active și închise
 *
 * Rulare:  node seed.js
 * Curățare înainte: node seed.js --clean   (șterge tot + reseedează)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const User    = require('./models/User');
const Auction = require('./models/Auction');
const Bid     = require('./models/Bid');

/* ── Helpers ──────────────────────────────────────────────── */
const rnd   = (min, max)    => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = arr            => arr[rnd(0, arr.length - 1)];
const daysFromNow = d        => new Date(Date.now() + d * 86400000);
const daysAgo     = d        => new Date(Date.now() - d * 86400000);

/* ── Parolă comună tuturor seed-userilor ─────────────────── */
const PASSWORD = 'parola123';

/* ══════════════════════════════════════════════════════════
   BUYERS (8)
   ══════════════════════════════════════════════════════════ */
const BUYERS_DATA = [
  {
    firstName: 'Alexandru', lastName: 'Ionescu',
    email: 'alex.ionescu@techvision.ro', companyName: 'TechVision SRL',
    city: 'București',
    company: { legalName: 'TechVision SRL', taxId: 'RO12345678', tradeRegisterNumber: 'J40/1234/2018',
      address: { county: 'Ilfov', city: 'București', street: 'Bd. Unirii', number: '14', postalCode: '030167' } },
  },
  {
    firstName: 'Maria', lastName: 'Popa',
    email: 'maria.popa@constructpro.ro', companyName: 'Construct Pro SA',
    city: 'Cluj-Napoca',
    company: { legalName: 'Construct Pro SA', taxId: 'RO23456789', tradeRegisterNumber: 'J12/456/2015',
      address: { county: 'Cluj', city: 'Cluj-Napoca', street: 'Str. Memorandumului', number: '5', postalCode: '400114' } },
  },
  {
    firstName: 'Bogdan', lastName: 'Dumitrescu',
    email: 'bogdan.d@horecaelite.ro', companyName: 'HoReCa Elite SRL',
    city: 'Timișoara',
    company: { legalName: 'HoReCa Elite SRL', taxId: 'RO34567890', tradeRegisterNumber: 'J35/789/2019',
      address: { county: 'Timiș', city: 'Timișoara', street: 'Str. Circumvalațiunii', number: '22', postalCode: '300210' } },
  },
  {
    firstName: 'Elena', lastName: 'Munteanu',
    email: 'elena.m@logitrans.ro', companyName: 'LogiTrans SRL',
    city: 'Constanța',
    company: { legalName: 'LogiTrans SRL', taxId: 'RO45678901', tradeRegisterNumber: 'J13/321/2016',
      address: { county: 'Constanța', city: 'Constanța', street: 'Bd. Tomis', number: '88', postalCode: '900663' } },
  },
  {
    firstName: 'Cristian', lastName: 'Florescu',
    email: 'cristian.f@medcenter.ro', companyName: 'MedCenter SRL',
    city: 'Iași',
    company: { legalName: 'MedCenter SRL', taxId: 'RO56789012', tradeRegisterNumber: 'J22/654/2017',
      address: { county: 'Iași', city: 'Iași', street: 'Str. Anastasie Panu', number: '31', postalCode: '700020' } },
  },
  {
    firstName: 'Ioana', lastName: 'Stanescu',
    email: 'ioana.s@eduprime.ro', companyName: 'EduPrime SRL',
    city: 'Brașov',
    company: { legalName: 'EduPrime SRL', taxId: 'RO67890123', tradeRegisterNumber: 'J08/987/2020',
      address: { county: 'Brașov', city: 'Brașov', street: 'Str. Republicii', number: '60', postalCode: '500030' } },
  },
  {
    firstName: 'Radu', lastName: 'Constantin',
    email: 'radu.c@retailmart.ro', companyName: 'RetailMart SRL',
    city: 'Sibiu',
    company: { legalName: 'RetailMart SRL', taxId: 'RO78901234', tradeRegisterNumber: 'J32/147/2014',
      address: { county: 'Sibiu', city: 'Sibiu', street: 'Bd. Victoriei', number: '3', postalCode: '550024' } },
  },
  {
    firstName: 'Andreea', lastName: 'Gheorghe',
    email: 'andreea.g@agrofresh.ro', companyName: 'AgroFresh SRL',
    city: 'Craiova',
    company: { legalName: 'AgroFresh SRL', taxId: 'RO89012345', tradeRegisterNumber: 'J16/258/2013',
      address: { county: 'Dolj', city: 'Craiova', street: 'Str. Unirii', number: '9', postalCode: '200585' } },
  },
];

/* ══════════════════════════════════════════════════════════
   SUPPLIERS (12)
   ══════════════════════════════════════════════════════════ */
const SUPPLIERS_DATA = [
  {
    firstName: 'Mihai', lastName: 'Petrescu',
    email: 'mihai.p@infosys-solutions.ro', companyName: 'InfoSys Solutions SRL',
    city: 'București', rating: 4.8, reviewCount: 34,
  },
  {
    firstName: 'Alina', lastName: 'Radu',
    email: 'alina.r@softdev-pro.ro', companyName: 'SoftDev Pro SRL',
    city: 'Cluj-Napoca', rating: 4.6, reviewCount: 28,
  },
  {
    firstName: 'Florin', lastName: 'Marinescu',
    email: 'florin.m@buildmaster.ro', companyName: 'BuildMaster SRL',
    city: 'Timișoara', rating: 4.9, reviewCount: 51,
  },
  {
    firstName: 'Catalina', lastName: 'Dragomir',
    email: 'catalina.d@electrotech.ro', companyName: 'ElectroTech SRL',
    city: 'Brașov', rating: 4.3, reviewCount: 19,
  },
  {
    firstName: 'Vlad', lastName: 'Niculescu',
    email: 'vlad.n@cleanpro.ro', companyName: 'CleanPro Services SRL',
    city: 'București', rating: 4.7, reviewCount: 42,
  },
  {
    firstName: 'Diana', lastName: 'Balan',
    email: 'diana.b@printdesign.ro', companyName: 'PrintDesign SRL',
    city: 'Iași', rating: 4.5, reviewCount: 23,
  },
  {
    firstName: 'Octavian', lastName: 'Lupescu',
    email: 'octavian.l@foodsupply.ro', companyName: 'FoodSupply SRL',
    city: 'Craiova', rating: 4.2, reviewCount: 16,
  },
  {
    firstName: 'Simona', lastName: 'Mihai',
    email: 'simona.m@transcargo.ro', companyName: 'TransCargo SRL',
    city: 'Constanța', rating: 4.6, reviewCount: 38,
  },
  {
    firstName: 'Gabriel', lastName: 'Ionita',
    email: 'gabriel.i@furniturepro.ro', companyName: 'FurniturePro SRL',
    city: 'Sibiu', rating: 4.4, reviewCount: 27,
  },
  {
    firstName: 'Roxana', lastName: 'Serban',
    email: 'roxana.s@greenenergy.ro', companyName: 'GreenEnergy SRL',
    city: 'Oradea', rating: 4.7, reviewCount: 31,
  },
  {
    firstName: 'Daniel', lastName: 'Paunescu',
    email: 'daniel.p@secureit.ro', companyName: 'SecureIT SRL',
    city: 'Cluj-Napoca', rating: 4.5, reviewCount: 20,
  },
  {
    firstName: 'Laura', lastName: 'Vasilescu',
    email: 'laura.v@officeequip.ro', companyName: 'OfficeEquip SRL',
    city: 'București', rating: 4.3, reviewCount: 15,
  },
];

/* ══════════════════════════════════════════════════════════
   TEMPLATE-URI LICITAȚII
   ══════════════════════════════════════════════════════════ */
function makeAuctions(buyers, now) {
  const [b0, b1, b2, b3, b4, b5, b6, b7] = buyers;

  return [
    /* ─────────── ACTIVE (25) ─────────── */
    {
      buyer: b0._id, status: 'active',
      title: 'Licențe Microsoft 365 Business Standard — 50 utilizatori',
      description: 'Achiziție licențe Microsoft 365 Business Standard pentru 50 de utilizatori, pe o perioadă de 12 luni. Include Exchange Online, Teams, SharePoint și pachetul Office complet. Livrare prin cheie de activare electronică. Facturare anuală, suport tehnic inclus.',
      category: 'IT & Software', quantity: '50 licențe / 12 luni',
      tags: ['microsoft', 'office365', 'licențe', 'cloud'],
      startPrice: 18500, currentPrice: 15200,
      deadline: daysFromNow(6),
      location: { lat: 44.4268, lng: 26.1025, address: 'Bd. Unirii 14', city: 'București' },
      publishedAt: daysAgo(5),
    },
    {
      buyer: b1._id, status: 'active',
      title: 'Lucrări renovare sediu administrativ etaj 2',
      description: 'Renovare completă etaj 2 al sediului administrativ: demolări pereți nestructurali, regipsare, zugrăvit, parchet laminat 300 mp, tâmplărie interioară PVC (12 uși), iluminat LED. Deviz detaliat solicitat. Termen execuție: 45 zile calendaristice.',
      category: 'Construcții & Renovări', quantity: '300 mp suprafață utilă',
      tags: ['renovare', 'construcții', 'birouri', 'parchet'],
      startPrice: 95000, currentPrice: 78000,
      deadline: daysFromNow(10),
      location: { lat: 46.7712, lng: 23.6236, address: 'Str. Memorandumului 5', city: 'Cluj-Napoca' },
      publishedAt: daysAgo(8),
    },
    {
      buyer: b2._id, status: 'active',
      title: 'Servicii catering evenimente corporative — contract anual',
      description: 'Contract catering pentru aproximativ 20 evenimente/an (conferințe, team-building, mese de afaceri). Meniu mixt: bufet suedez + serviciu la masă. Capacitate 30-200 persoane/eveniment. Deconturi și factură după fiecare eveniment. Referințe obligatorii.',
      category: 'Alimentar & Catering', quantity: '~20 evenimente / an',
      tags: ['catering', 'evenimente', 'corporate', 'bufet'],
      startPrice: 120000, currentPrice: 98500,
      deadline: daysFromNow(4),
      location: { lat: 45.7489, lng: 21.2087, address: 'Str. Circumvalațiunii 22', city: 'Timișoara' },
      publishedAt: daysAgo(10),
    },
    {
      buyer: b3._id, status: 'active',
      title: 'Transport marfă refrigerată București–Constanța, 3x/săptămână',
      description: 'Contract transport produse refrigerate (0-4°C) pe ruta București–Constanța, frecvență 3 curse/săptămână, camion minim 10t. Documentație ATP obligatorie, GPS tracking în timp real, emitere CMR. Contract 6 luni cu opțiune prelungire.',
      category: 'Logistică & Transport', quantity: '3 curse/săptămână × 26 săptămâni',
      tags: ['transport', 'refrigerat', 'logistică', 'constanța'],
      startPrice: 42000, currentPrice: 36800,
      deadline: daysFromNow(3),
      location: { lat: 44.1598, lng: 28.6348, address: 'Bd. Tomis 88', city: 'Constanța' },
      publishedAt: daysAgo(6),
    },
    {
      buyer: b4._id, status: 'active',
      title: 'Sistem informatic managementul pacienților (HIS)',
      description: 'Achiziție și implementare sistem HIS (Hospital Information System) pentru clinică privată, 8 specialități, 15 cabinete. Module: programări online, fișă electronică pacient, facturare CNAS, rapoarte statistice, integrare analize laborator. Training inclus.',
      category: 'IT & Software', quantity: '1 sistem / 15 licențe utilizator',
      tags: ['HIS', 'medical', 'software', 'clinică'],
      startPrice: 85000, currentPrice: 72000,
      deadline: daysFromNow(14),
      location: { lat: 47.1585, lng: 27.6014, address: 'Str. Anastasie Panu 31', city: 'Iași' },
      publishedAt: daysAgo(3),
    },
    {
      buyer: b5._id, status: 'active',
      title: 'Mobilier școlar — 30 săli de clasă complete',
      description: 'Furnizare mobilier școlar pentru 30 săli de clasă: bănci individuale reglabile înălțime (750 buc), scaune ergonomice (750 buc), catedre (30 buc), dulapuri depozitare (60 buc). Material: PAL melaminat alb/gri, certificat REACH. Montaj inclus.',
      category: 'Mobilier & Echipamente', quantity: '750 bănci + 750 scaune + accesorii',
      tags: ['mobilier', 'școlar', 'bănci', 'ergonomic'],
      startPrice: 210000, currentPrice: 182000,
      deadline: daysFromNow(20),
      location: { lat: 45.6427, lng: 25.5887, address: 'Str. Republicii 60', city: 'Brașov' },
      publishedAt: daysAgo(2),
    },
    {
      buyer: b6._id, status: 'active',
      title: 'Servicii pază și securitate — 3 obiective comerciale',
      description: 'Contract servicii pază pentru 3 puncte de lucru (magazine) în Sibiu, program non-stop. Agent uman + monitorizare video. Licență ISU și IGPR obligatorie. Raport de incident zilnic, patrule verificare perimetru. Contract 12 luni.',
      category: 'Servicii', quantity: '3 obiective × 24h × 365 zile',
      tags: ['pază', 'securitate', 'monitorizare', 'retail'],
      startPrice: 68000, currentPrice: 61500,
      deadline: daysFromNow(7),
      location: { lat: 45.7983, lng: 24.1256, address: 'Bd. Victoriei 3', city: 'Sibiu' },
      publishedAt: daysAgo(4),
    },
    {
      buyer: b7._id, status: 'active',
      title: 'Fertilizanți NPK 15-15-15 pentru sezon primăvară',
      description: 'Achiziție fertilizanți granulați NPK 15-15-15, ambalaj saci 50kg. Calitate certificată, buletine de analiză obligatorii. Livrare în 3 tranșe: martie, aprilie, mai. Descărcare la sediu depozit Craiova. Plată la 30 zile factură.',
      category: 'Agricultură', quantity: '80.000 kg (1.600 saci × 50 kg)',
      tags: ['fertilizanți', 'NPK', 'agricultură', 'îngrășăminte'],
      startPrice: 96000, currentPrice: 84000,
      deadline: daysFromNow(9),
      location: { lat: 44.3302, lng: 23.7949, address: 'Str. Unirii 9', city: 'Craiova' },
      publishedAt: daysAgo(7),
    },
    {
      buyer: b0._id, status: 'active',
      title: 'Audit și pentest infrastructură IT — certificare ISO 27001',
      description: 'Servicii de audit securitate IT și penetration testing complet pentru pregătire certificare ISO 27001. Cuprinde: audit politici, vulnerability assessment, pentest rețea intern/extern, raport detaliat cu recomandări prioritizate, suport remediere 60 zile.',
      category: 'IT & Software', quantity: '1 proiect complet',
      tags: ['pentest', 'securitate', 'ISO27001', 'audit'],
      startPrice: 32000, currentPrice: 28500,
      deadline: daysFromNow(12),
      location: { lat: 44.4268, lng: 26.1025, address: 'Bd. Unirii 14', city: 'București' },
      publishedAt: daysAgo(4),
    },
    {
      buyer: b1._id, status: 'active',
      title: 'Instalare sistem fotovoltaic 50 kWp pe acoperișul halei',
      description: 'Furnizare și montaj sistem fotovoltaic 50 kWp pe hală industrială: panouri monocristaline, invertor trifazat, sistem de monitorizare online, racordare la rețea (prosumator), avize și proiect tehnic incluse. Garanție sistem 10 ani.',
      category: 'Energie & Mediu', quantity: '50 kWp / ~200 panouri',
      tags: ['fotovoltaic', 'solar', 'energie', 'verde'],
      startPrice: 148000, currentPrice: 126000,
      deadline: daysFromNow(18),
      location: { lat: 46.7712, lng: 23.6236, address: 'Str. Memorandumului 5', city: 'Cluj-Napoca' },
      publishedAt: daysAgo(3),
    },
    {
      buyer: b2._id, status: 'active',
      title: 'Servicii curățenie profesională restaurante — contract lunar',
      description: 'Curățenie profesională pentru 5 restaurante din rețea, 7 zile/săptămână, inclusiv dezinfecție HACCP conformă, curățenie hote și bucătărie, geamuri, spații exterioare. Produse certificare CE incluse. Raport lunar de conformitate.',
      category: 'Servicii', quantity: '5 restaurante × 7 zile/săptămână',
      tags: ['curățenie', 'HACCP', 'restaurante', 'profesional'],
      startPrice: 28000, currentPrice: 23500,
      deadline: daysFromNow(5),
      location: { lat: 45.7489, lng: 21.2087, address: 'Str. Circumvalațiunii 22', city: 'Timișoara' },
      publishedAt: daysAgo(6),
    },
    {
      buyer: b3._id, status: 'active',
      title: 'Software TMS (Transport Management System)',
      description: 'Implementare soluție TMS pentru gestionarea flotei de 45 vehicule: planificare rute, optimizare combustibil, urmărire GPS, gestionare documente CMR, rapoarte KPI. SaaS sau licență perpetuă. Training echipă 5 utilizatori, suport 12 luni.',
      category: 'IT & Software', quantity: '1 sistem / 45 vehicule',
      tags: ['TMS', 'flotă', 'transport', 'GPS'],
      startPrice: 54000, currentPrice: 47000,
      deadline: daysFromNow(11),
      location: { lat: 44.1598, lng: 28.6348, address: 'Bd. Tomis 88', city: 'Constanța' },
      publishedAt: daysAgo(5),
    },
    {
      buyer: b4._id, status: 'active',
      title: 'Echipamente medicale sterilizare — autoclav clasă B',
      description: 'Achiziție 2 autoclave medicale clasa B, capacitate 22L, certificare CE și MD (Medical Device). Include instalare, validare IQ/OQ/PQ, training personal medical, contract service 2 ani. Livrare în 30 zile de la comandă.',
      category: 'Echipamente Medicale', quantity: '2 autoclave 22L clasa B',
      tags: ['autoclave', 'sterilizare', 'medical', 'CE'],
      startPrice: 38000, currentPrice: 33200,
      deadline: daysFromNow(8),
      location: { lat: 47.1585, lng: 27.6014, address: 'Str. Anastasie Panu 31', city: 'Iași' },
      publishedAt: daysAgo(9),
    },
    {
      buyer: b5._id, status: 'active',
      title: 'Platformă e-learning personalizată pentru cursuri online',
      description: 'Dezvoltare platformă e-learning white-label: creator cursuri video, teste interactive, certificare automată, rapoarte progres, integrare SSO, aplicație mobilă iOS+Android. Minim 500 utilizatori concurenți. Livrare în 4 luni, suport 24 luni.',
      category: 'IT & Software', quantity: '1 platformă / 5.000 studenți',
      tags: ['e-learning', 'educație', 'platformă', 'LMS'],
      startPrice: 110000, currentPrice: 92000,
      deadline: daysFromNow(16),
      location: { lat: 45.6427, lng: 25.5887, address: 'Str. Republicii 60', city: 'Brașov' },
      publishedAt: daysAgo(2),
    },
    {
      buyer: b6._id, status: 'active',
      title: 'Rafturi metalice depozitare magazin — sistem modular',
      description: 'Furnizare rafturi metalice modulare pentru suprafață depozit 1.200 mp. Greutate/raft: 500 kg/nivel, 5 niveluri, înălțime totală 5m. Include console, grinzi, plăci OSB, montaj și ancorare. Livrare în 15 zile de la comandă.',
      category: 'Mobilier & Echipamente', quantity: '1.200 mp depozit / ~80 module',
      tags: ['rafturi', 'depozit', 'metalic', 'modular'],
      startPrice: 76000, currentPrice: 64500,
      deadline: daysFromNow(7),
      location: { lat: 45.7983, lng: 24.1256, address: 'Bd. Victoriei 3', city: 'Sibiu' },
      publishedAt: daysAgo(5),
    },
    {
      buyer: b7._id, status: 'active',
      title: 'Irigații prin picurare — livadă 50 ha',
      description: 'Proiectare și instalare sistem irigații prin picurare pentru livadă de meri și peri, 50 ha. Include: stație pompare, filtrare, contorizare, automatizare pe zone, conductă principală HDPE, rampe picurare cu emitanți anti-obturare. Garanție execuție 3 ani.',
      category: 'Agricultură', quantity: '50 hectare livadă',
      tags: ['irigații', 'picurare', 'livadă', 'agricultură'],
      startPrice: 185000, currentPrice: 162000,
      deadline: daysFromNow(22),
      location: { lat: 44.3302, lng: 23.7949, address: 'Str. Unirii 9', city: 'Craiova' },
      publishedAt: daysAgo(1),
    },
    {
      buyer: b0._id, status: 'active',
      title: 'Campanie marketing digital — Google Ads + Meta Ads',
      description: 'Gestionare campanii performance marketing pentru trimestrul 3: Google Ads (Search + Display + YouTube), Meta Ads (Facebook + Instagram). Buget media 30.000 RON/lună. Raportare săptămânală, optimizare continuă, target ROAS 400%. Experiență dovedită B2B SaaS.',
      category: 'Marketing & PR', quantity: '3 luni / buget media 90.000 RON',
      tags: ['google-ads', 'meta-ads', 'digital', 'performance'],
      startPrice: 18000, currentPrice: 15800,
      deadline: daysFromNow(4),
      location: { lat: 44.4268, lng: 26.1025, address: 'Bd. Unirii 14', city: 'București' },
      publishedAt: daysAgo(7),
    },
    {
      buyer: b1._id, status: 'active',
      title: 'Servicii contabilitate și salarizare externalizate',
      description: 'Servicii contabilitate completă + salarizare pentru firmă construcții cu 85 angajați: evidență contabilă, bilanțuri trimestriale, declarații ANAF, dosare salarizare, adeverințe, ITM. Expertiză REVISAL obligatorie. Contract anual.',
      category: 'Servicii Financiare', quantity: '85 angajați / 12 luni',
      tags: ['contabilitate', 'salarizare', 'ANAF', 'externalizare'],
      startPrice: 36000, currentPrice: 31200,
      deadline: daysFromNow(13),
      location: { lat: 46.7712, lng: 23.6236, address: 'Str. Memorandumului 5', city: 'Cluj-Napoca' },
      publishedAt: daysAgo(4),
    },
    {
      buyer: b2._id, status: 'active',
      title: 'Uniforme de lucru personalizate pentru personal',
      description: 'Furnizare uniforme personalizate cu logo broderie pentru 120 angajați: bluze (2 buc/angajat), pantaloni (2 buc/angajat), șorțuri, bonete. Material bumbac 65%+poliester 35%, rezistente la spălări frecvente. Termen livrare: 21 zile.',
      category: 'Textile & Confecții', quantity: '240 bluze + 240 pantaloni + accesorii',
      tags: ['uniforme', 'personalizate', 'broderie', 'HoReCa'],
      startPrice: 22000, currentPrice: 19500,
      deadline: daysFromNow(6),
      location: { lat: 45.7489, lng: 21.2087, address: 'Str. Circumvalațiunii 22', city: 'Timișoara' },
      publishedAt: daysAgo(3),
    },
    {
      buyer: b3._id, status: 'active',
      title: 'Echipamente depozit: stivuitor electric 3t + rolete',
      description: 'Achiziție stivuitor electric 3 tone capacitate, înălțime ridicare 4,5 m, baterie Li-Ion, ore lucru 8h/ciclu. Suplimentar: 2 rolete electrice 1,5t. Livrare, punere în funcțiune, training operator, revizie inclusă 12 luni.',
      category: 'Mobilier & Echipamente', quantity: '1 stivuitor 3t + 2 rolete 1,5t',
      tags: ['stivuitor', 'depozit', 'electric', 'logistică'],
      startPrice: 92000, currentPrice: 80000,
      deadline: daysFromNow(15),
      location: { lat: 44.1598, lng: 28.6348, address: 'Bd. Tomis 88', city: 'Constanța' },
      publishedAt: daysAgo(2),
    },
    {
      buyer: b4._id, status: 'active',
      title: 'Servicii de traducere medicală — română/engleză/franceză',
      description: 'Contract servicii traducere documente medicale (protocoale, certificate, rezumate externare, formulare GDPR). Traducători cu specializare medicală, apostilă la cerere. Timp de răspuns: 24h documente standard, 4h urgențe. Contract 12 luni.',
      category: 'Servicii', quantity: '~500 pagini/lună × 12 luni',
      tags: ['traducere', 'medical', 'EN-FR-RO', 'documente'],
      startPrice: 14400, currentPrice: 12800,
      deadline: daysFromNow(9),
      location: { lat: 47.1585, lng: 27.6014, address: 'Str. Anastasie Panu 31', city: 'Iași' },
      publishedAt: daysAgo(6),
    },
    {
      buyer: b5._id, status: 'active',
      title: 'Training competențe digitale pentru 200 profesori',
      description: 'Program formare profesori în competențe digitale: utilizare G Suite for Education, creare conținut multimedia, instrumente evaluare online, securitate date. Format blended (50% online, 50% față-în-față). Certificat acreditat MEC. Durată: 40 ore/participant.',
      category: 'Training & HR', quantity: '200 profesori × 40 ore',
      tags: ['training', 'digital', 'profesori', 'educație'],
      startPrice: 48000, currentPrice: 42500,
      deadline: daysFromNow(25),
      location: { lat: 45.6427, lng: 25.5887, address: 'Str. Republicii 60', city: 'Brașov' },
      publishedAt: daysAgo(1),
    },
    {
      buyer: b6._id, status: 'active',
      title: 'Casa de marcat fiscalizată + software POS — 8 case',
      description: 'Furnizare, fiscalizare și instalare 8 case de marcat electronice cu jurnal electronic AMEF, conform OUG 28/1999 actualizată. Include software POS cu gestiune stoc, conectare la contabilitate, formare casieri. Garanție 2 ani, service rapid.',
      category: 'IT & Software', quantity: '8 case de marcat + licențe POS',
      tags: ['casa-de-marcat', 'AMEF', 'POS', 'retail'],
      startPrice: 24000, currentPrice: 21000,
      deadline: daysFromNow(8),
      location: { lat: 45.7983, lng: 24.1256, address: 'Bd. Victoriei 3', city: 'Sibiu' },
      publishedAt: daysAgo(5),
    },
    {
      buyer: b7._id, status: 'active',
      title: 'Depozitare frigorifică produse agricole sezon vara',
      description: 'Închiriere spații frigorifice pentru depozitare legume și fructe (0-8°C), capacitate minim 500 tone, perioadă 1 iulie — 30 septembrie. Acces 24/7, rampe descărcare TIR, monitorizare temperatură, asigurare marfă inclusă opțional. Localizare: județul Dolj.',
      category: 'Logistică & Transport', quantity: '500 tone × 90 zile',
      tags: ['frigorific', 'depozitare', 'legume', 'sezon'],
      startPrice: 72000, currentPrice: 64000,
      deadline: daysFromNow(11),
      location: { lat: 44.3302, lng: 23.7949, address: 'Str. Unirii 9', city: 'Craiova' },
      publishedAt: daysAgo(4),
    },

    /* ─────────── CLOSED (20) ─────────── */
    {
      buyer: b0._id, status: 'closed',
      title: 'Laptopuri business Dell/HP/Lenovo — 30 bucăți',
      description: 'Achiziție 30 laptopuri business: procesor Intel i5/i7 gen 12+, RAM 16GB, SSD 512GB, ecran 14" FHD IPS, baterie 8h+, Windows 11 Pro preinstalat. Garanție 3 ani on-site. Livrare în 10 zile.',
      category: 'IT & Software', quantity: '30 laptopuri',
      tags: ['laptopuri', 'Dell', 'HP', 'IT'],
      startPrice: 135000, currentPrice: 108000,
      deadline: daysAgo(5),
      location: { lat: 44.4268, lng: 26.1025, address: 'Bd. Unirii 14', city: 'București' },
      publishedAt: daysAgo(20),
    },
    {
      buyer: b1._id, status: 'closed',
      title: 'Betonieră șantier + pompa beton — echipamente',
      description: 'Închiriere betonieră 500L + pompă beton cu braț 28m pentru șantier rezidențial, perioadă 6 luni. Include operator calificat, revizii periodice, carburant la prețul pieței. Disponibilitate 6 zile/săptămână.',
      category: 'Construcții & Renovări', quantity: '6 luni / 6 zile pe săptămână',
      tags: ['betonieră', 'pompă', 'construcții', 'utilaje'],
      startPrice: 54000, currentPrice: 43200,
      deadline: daysAgo(3),
      location: { lat: 46.7712, lng: 23.6236, address: 'Str. Memorandumului 5', city: 'Cluj-Napoca' },
      publishedAt: daysAgo(18),
    },
    {
      buyer: b2._id, status: 'closed',
      title: 'Produse de curățenie și igienă — stoc trimestrial',
      description: 'Aprovizionare produse curățenie și igienă pentru 5 restaurante: detergenți HORECA, dezinfectanți avizați, hârtie igienică, săpun lichid, șervețele, mănuși. Livrare săptămânală la fiecare locație. Contract 3 luni cu opțiune prelungire.',
      category: 'Servicii', quantity: 'Stoc trimestrial 5 locații',
      tags: ['curățenie', 'igienă', 'HORECA', 'consumabile'],
      startPrice: 18000, currentPrice: 13500,
      deadline: daysAgo(7),
      location: { lat: 45.7489, lng: 21.2087, address: 'Str. Circumvalațiunii 22', city: 'Timișoara' },
      publishedAt: daysAgo(22),
    },
    {
      buyer: b3._id, status: 'closed',
      title: 'Anvelope camion 315/80 R22.5 — stoc 100 buc',
      description: 'Achiziție 100 anvelope pentru parc auto de camioane: 315/80 R22.5 pentru direcție și tracțiune, indice de sarcină 156/150, viteză L, clasa E/A/72 (etichetă EU). Mărci acceptate: Michelin, Continental, Bridgestone. Livrare în 5 zile.',
      category: 'Auto & Transport', quantity: '100 anvelope 315/80 R22.5',
      tags: ['anvelope', 'camion', 'transport', 'stoc'],
      startPrice: 48000, currentPrice: 39200,
      deadline: daysAgo(4),
      location: { lat: 44.1598, lng: 28.6348, address: 'Bd. Tomis 88', city: 'Constanța' },
      publishedAt: daysAgo(15),
    },
    {
      buyer: b4._id, status: 'closed',
      title: 'Mobilier medical cabinet stomatologic — echipare completă',
      description: 'Furnizare și montaj mobilier cabinet stomatologic: unit dentar (fotoliu + reflector + turbine), cabinet mobilier de depozitare inox, chiuvetă medic, scaun asistentă. Certificat CE pentru dispozitive medicale. Garanție 5 ani.',
      category: 'Echipamente Medicale', quantity: '1 cabinet complet',
      tags: ['stomatologie', 'unit', 'cabinet', 'echipare'],
      startPrice: 65000, currentPrice: 52000,
      deadline: daysAgo(10),
      location: { lat: 47.1585, lng: 27.6014, address: 'Str. Anastasie Panu 31', city: 'Iași' },
      publishedAt: daysAgo(25),
    },
    {
      buyer: b5._id, status: 'closed',
      title: 'Imprimare caiete + manuale școlare personalizate',
      description: 'Tipar caiete A5 + manuale școlare în format A4 color pentru anul școlar. Specificații: 50.000 caiete 48 file offsett 80g, 5.000 manuale 200 pag policromie copertă cartonată 300g. Livrare în tranșe la depozit central.',
      category: 'Print & Tipografie', quantity: '50.000 caiete + 5.000 manuale',
      tags: ['tipar', 'caiete', 'manuale', 'tipografie'],
      startPrice: 92000, currentPrice: 74000,
      deadline: daysAgo(6),
      location: { lat: 45.6427, lng: 25.5887, address: 'Str. Republicii 60', city: 'Brașov' },
      publishedAt: daysAgo(20),
    },
    {
      buyer: b6._id, status: 'closed',
      title: 'Sistem CCTV 32 camere IP 4K — depozit + magazin',
      description: 'Furnizare și instalare sistem supraveghere video: 32 camere IP 4K (interior + exterior), NVR 32 canale 8TB, ecran 55" vizualizare, acces remote mobil, alertă detecție mișcare. Proiect tehnic, autorizații PSI, punere în funcțiune incluse.',
      category: 'Securitate', quantity: '32 camere IP 4K + NVR + montaj',
      tags: ['CCTV', 'supraveghere', 'securitate', '4K'],
      startPrice: 45000, currentPrice: 36800,
      deadline: daysAgo(8),
      location: { lat: 45.7983, lng: 24.1256, address: 'Bd. Victoriei 3', city: 'Sibiu' },
      publishedAt: daysAgo(23),
    },
    {
      buyer: b7._id, status: 'closed',
      title: 'Semințe certificată floarea-soarelui hibrid — sezon',
      description: 'Achiziție semințe hibride de floarea-soarelui pentru 300 ha: toleranță la Orobanche rasele A-G, FAO 95-105 zile, potențial recoltă 3,5+ t/ha. Ambalaj 150.000 semințe/sac, tratament fungicid și insecticid inclus. Certificate ITCSMS.',
      category: 'Agricultură', quantity: '300 hectare / 2.000 saci',
      tags: ['semințe', 'floarea-soarelui', 'hibrid', 'certificat'],
      startPrice: 84000, currentPrice: 68000,
      deadline: daysAgo(12),
      location: { lat: 44.3302, lng: 23.7949, address: 'Str. Unirii 9', city: 'Craiova' },
      publishedAt: daysAgo(28),
    },
    {
      buyer: b0._id, status: 'closed',
      title: 'Server rack Dell PowerEdge + UPS 3kVA',
      description: 'Achiziție server 2U rack: 2× Intel Xeon Silver 4310, 256GB RAM ECC, 4× SSD SAS 3.84TB RAID-5, 2 surse redundante. Plus UPS online 3kVA baterie extinsă 30 min. Instalare, configurare RAID + virtualizare VMware incluse.',
      category: 'IT & Software', quantity: '1 server 2U + 1 UPS 3kVA',
      tags: ['server', 'Dell', 'rack', 'UPS'],
      startPrice: 78000, currentPrice: 62500,
      deadline: daysAgo(9),
      location: { lat: 44.4268, lng: 26.1025, address: 'Bd. Unirii 14', city: 'București' },
      publishedAt: daysAgo(24),
    },
    {
      buyer: b1._id, status: 'closed',
      title: 'Geamuri termopan Rehau — bloc 4 scări',
      description: 'Furnizare și montaj ferestre + uși balcon termopan Rehau sau echivalent: 180 ferestre PVC 5 camere, sticlă tripan, argon, geam securizat interior. Include demontare geamuri vechi, evacuare deșeuri, spațiere termoizolantă. Termen 60 zile.',
      category: 'Construcții & Renovări', quantity: '180 ferestre + 40 uși balcon',
      tags: ['termopan', 'Rehau', 'ferestre', 'PVC'],
      startPrice: 162000, currentPrice: 132000,
      deadline: daysAgo(2),
      location: { lat: 46.7712, lng: 23.6236, address: 'Str. Memorandumului 5', city: 'Cluj-Napoca' },
      publishedAt: daysAgo(17),
    },
    {
      buyer: b2._id, status: 'closed',
      title: 'Platformă rezervări online pentru lanț de restaurante',
      description: 'Dezvoltare aplicație web + mobilă pentru rezervări mese: calendar disponibilitate per locație, confirmare automată SMS/email, waitlist, integrare Google Maps, panou admin statistici. Responsive, PWA. Suport 12 luni inclus.',
      category: 'IT & Software', quantity: '1 platformă / 5 locații',
      tags: ['rezervări', 'restaurant', 'app', 'web'],
      startPrice: 42000, currentPrice: 34500,
      deadline: daysAgo(14),
      location: { lat: 45.7489, lng: 21.2087, address: 'Str. Circumvalațiunii 22', city: 'Timișoara' },
      publishedAt: daysAgo(29),
    },
    {
      buyer: b3._id, status: 'closed',
      title: 'Servicii reparații și întreținere flotă 45 camioane',
      description: 'Contract mentenanță preventivă și curativă flotă 45 camioane: revizii la interval, inspecții tehnice ITP, reparații mecatronice, anvelope, frâne. Autorizare RAR obligatorie. Timp intervenție maxim 4h. Piesele de schimb la prețul de catalog — 10%.',
      category: 'Auto & Transport', quantity: '45 camioane / 12 luni',
      tags: ['service', 'camioane', 'flotă', 'mentenanță'],
      startPrice: 108000, currentPrice: 88000,
      deadline: daysAgo(1),
      location: { lat: 44.1598, lng: 28.6348, address: 'Bd. Tomis 88', city: 'Constanța' },
      publishedAt: daysAgo(16),
    },
    {
      buyer: b4._id, status: 'closed',
      title: 'Consumabile medicale — seringi, mănuși, comprese',
      description: 'Aprovizionare trimestrială consumabile medicale sterile: seringi 2ml/5ml/10ml (câte 10.000), mănuși nitril M/L (30.000 perechi), comprese sterile 10×10 (5.000 pachete), leucoplast, perfuzoare. Avizare ANM obligatorie.',
      category: 'Echipamente Medicale', quantity: 'Stoc trimestrial conform caiet sarcini',
      tags: ['consumabile', 'medical', 'sterile', 'seringi'],
      startPrice: 32000, currentPrice: 26500,
      deadline: daysAgo(5),
      location: { lat: 47.1585, lng: 27.6014, address: 'Str. Anastasie Panu 31', city: 'Iași' },
      publishedAt: daysAgo(20),
    },
    {
      buyer: b5._id, status: 'closed',
      title: 'Tabla interactivă și proiector clasă — 25 săli',
      description: 'Dotare 25 săli de clasă cu table interactive 86" 4K + proiectoare laser 5000 lumeni: sistem Android integrat, wireless casting, touch multi-point, suport de tavan reglabil. Instalare, configurare rețea și training profesori incluse.',
      category: 'Mobilier & Echipamente', quantity: '25 table interactive + 25 proiectoare',
      tags: ['tablă', 'interactivă', 'educație', 'proiector'],
      startPrice: 175000, currentPrice: 142000,
      deadline: daysAgo(7),
      location: { lat: 45.6427, lng: 25.5887, address: 'Str. Republicii 60', city: 'Brașov' },
      publishedAt: daysAgo(22),
    },
    {
      buyer: b6._id, status: 'closed',
      title: 'Design și execuție standuri expoziție — târg retail',
      description: 'Proiectare și construcție standuri expoziționale pentru 3 târguri naționale: stand 36mp modulat, grafică full-color, mobilier expunere, iluminat LED integrat, depozitare. Transport și montaj/demontaj incluse. Refolosire structură la toate târgurile.',
      category: 'Marketing & PR', quantity: '3 târguri × stand 36 mp',
      tags: ['stand', 'expoziție', 'târg', 'marketing'],
      startPrice: 54000, currentPrice: 44500,
      deadline: daysAgo(11),
      location: { lat: 45.7983, lng: 24.1256, address: 'Bd. Victoriei 3', city: 'Sibiu' },
      publishedAt: daysAgo(26),
    },
    {
      buyer: b7._id, status: 'closed',
      title: 'Pesticide omologate fungicide + erbicide — sezon',
      description: 'Achiziție pesticide sezon agricol: fungicide triazol 200L, erbicide post-emergent selective 500L, insecticide 150L. Avize EFSA și MADR obligatorii. Livrare înainte de 1 aprilie. Garanție calitate + fișe tehnice și siguranță.',
      category: 'Agricultură', quantity: '850L diverse pesticide certificate',
      tags: ['pesticide', 'fungicide', 'erbicide', 'certificat'],
      startPrice: 58000, currentPrice: 47500,
      deadline: daysAgo(3),
      location: { lat: 44.3302, lng: 23.7949, address: 'Str. Unirii 9', city: 'Craiova' },
      publishedAt: daysAgo(18),
    },
    {
      buyer: b0._id, status: 'closed',
      title: 'Servicii recrutare și headhunting — 5 pozitii senior IT',
      description: 'Servicii recrutare specializată pentru 5 poziții senior: 2 Software Engineer (Java/Python), 1 DevOps Senior, 1 Product Manager, 1 CTO adjunct. Success fee 12% salariu brut anual, garanție înlocuire 6 luni. Prezentare CV-uri calificate în 15 zile.',
      category: 'Training & HR', quantity: '5 poziții senior IT',
      tags: ['recrutare', 'headhunting', 'IT', 'senior'],
      startPrice: 52000, currentPrice: 42000,
      deadline: daysAgo(6),
      location: { lat: 44.4268, lng: 26.1025, address: 'Bd. Unirii 14', city: 'București' },
      publishedAt: daysAgo(21),
    },
    {
      buyer: b1._id, status: 'closed',
      title: 'Instalații electrice complete — hală industrială 2000 mp',
      description: 'Proiectare și execuție instalații electrice hală industrială 2000 mp: tablou general + distributie, cablaj trifazat, prize industriale 63A, iluminat industrial LED 200lux, priză pământ, paratrăsnet, avize ANRE. Proiect tehnic inclus.',
      category: 'Construcții & Renovări', quantity: '2.000 mp hală industrială',
      tags: ['electrice', 'hală', 'industriale', 'ANRE'],
      startPrice: 86000, currentPrice: 70000,
      deadline: daysAgo(4),
      location: { lat: 46.7712, lng: 23.6236, address: 'Str. Memorandumului 5', city: 'Cluj-Napoca' },
      publishedAt: daysAgo(19),
    },
    {
      buyer: b2._id, status: 'closed',
      title: 'Cafea boabe specialty + echipamente espresso baruri',
      description: 'Furnizare cafea boabe specialty (80+ SCA) în sistem leasing echipamente: 5 espressoare semi-auto Nuova Simonelli sau echivalent, 5 râșnițe on-demand, mentenanță lunară. Cafea 100% arabica, dosar tehnic + training baristi.',
      category: 'Alimentar & Catering', quantity: '5 locații / minim 150 kg cafea/lună',
      tags: ['cafea', 'espressor', 'specialty', 'baruri'],
      startPrice: 38000, currentPrice: 31000,
      deadline: daysAgo(8),
      location: { lat: 45.7489, lng: 21.2087, address: 'Str. Circumvalațiunii 22', city: 'Timișoara' },
      publishedAt: daysAgo(23),
    },
    {
      buyer: b3._id, status: 'closed',
      title: 'GPS tracking flotă + sistem telematică avansată',
      description: 'Instalare GPS tracking pe 45 vehicule: unitate OBD-II cu 3G/4G, platformă web + aplicație mobil, rapoarte consum combustibil, vitezometrie, alerte geofencing, CAN-bus date tehnice motor. Abonament 12 luni inclus.',
      category: 'IT & Software', quantity: '45 unități GPS + 12 luni abonament',
      tags: ['GPS', 'telematică', 'flotă', 'tracking'],
      startPrice: 36000, currentPrice: 29500,
      deadline: daysAgo(2),
      location: { lat: 44.1598, lng: 28.6348, address: 'Bd. Tomis 88', city: 'Constanța' },
      publishedAt: daysAgo(17),
    },

    /* ─────────── CANCELLED (5) ─────────── */
    {
      buyer: b4._id, status: 'cancelled',
      title: 'Aparat RMN 1.5T — instalare cabinet radiologie',
      description: 'Achiziție aparat RMN 1.5 Tesla pentru cabinet radiologie privat. Producători acceptați: Siemens, GE, Philips. Sală ecranată, sistem răcire apă incluse. Autorizare CNCAN, training radiologi. Livrare în 90 zile.',
      category: 'Echipamente Medicale', quantity: '1 aparat RMN 1.5T',
      tags: ['RMN', 'radiologie', 'medical', 'Siemens'],
      startPrice: 850000, currentPrice: 850000,
      deadline: daysAgo(15),
      location: { lat: 47.1585, lng: 27.6014, address: 'Str. Anastasie Panu 31', city: 'Iași' },
      publishedAt: daysAgo(30),
    },
    {
      buyer: b5._id, status: 'cancelled',
      title: 'Autobuze electrice 12m pentru transport elevi',
      description: 'Achiziție 3 autobuze electrice 12m capacitate 50 locuri, autonomie minimă 250km, stație încărcare rapidă 150kW inclus. Omologare RAR, acces fond UE (dacă aplicabil). Livrare în 6 luni.',
      category: 'Auto & Transport', quantity: '3 autobuze electrice 12m',
      tags: ['autobuz', 'electric', 'transport', 'elevi'],
      startPrice: 1200000, currentPrice: 1200000,
      deadline: daysAgo(20),
      location: { lat: 45.6427, lng: 25.5887, address: 'Str. Republicii 60', city: 'Brașov' },
      publishedAt: daysAgo(35),
    },
    {
      buyer: b6._id, status: 'cancelled',
      title: 'Rebranding complet — logo, identitate vizuală, manual brand',
      description: 'Servicii rebranding: cercetare & strategie brand, creare logo nou, paleta cromatică, tipografie, manual identitate vizuală complet (print + digital). Prezentare 3 variante concept, maxim 3 runde revizii. Livrare fișiere editabile.',
      category: 'Marketing & PR', quantity: '1 manual brand complet',
      tags: ['rebranding', 'logo', 'identitate', 'vizuală'],
      startPrice: 24000, currentPrice: 24000,
      deadline: daysAgo(18),
      location: { lat: 45.7983, lng: 24.1256, address: 'Bd. Victoriei 3', city: 'Sibiu' },
      publishedAt: daysAgo(33),
    },
    {
      buyer: b7._id, status: 'cancelled',
      title: 'Combină agricolă — 300 CP, cap de rapiță inclus',
      description: 'Achiziție combină agricolă: motor 300 CP, buncăr 11.000 litri, cap grâu 7.6m + cap rapiță 7.5m. Producători: Claas, John Deere, Case IH, New Holland. Garanție 2 ani, service autorizat județ Dolj.',
      category: 'Agricultură', quantity: '1 combină agricolă 300 CP',
      tags: ['combină', 'agricolă', 'John Deere', 'utilaje'],
      startPrice: 680000, currentPrice: 680000,
      deadline: daysAgo(25),
      location: { lat: 44.3302, lng: 23.7949, address: 'Str. Unirii 9', city: 'Craiova' },
      publishedAt: daysAgo(40),
    },
    {
      buyer: b0._id, status: 'cancelled',
      title: 'Data center propriu — construcție camera server 40 mp',
      description: 'Proiectare și execuție cameră server dedicată: pardoseală tehnică, climatizare de precizie redundantă, UPS 20kVA dublu, generatoare diesel, sistem halon stingere incendiu, control acces biometric.',
      category: 'IT & Software', quantity: '1 sală server 40 mp',
      tags: ['data-center', 'server', 'climatizare', 'UPS'],
      startPrice: 420000, currentPrice: 420000,
      deadline: daysAgo(22),
      location: { lat: 44.4268, lng: 26.1025, address: 'Bd. Unirii 14', city: 'București' },
      publishedAt: daysAgo(37),
    },

    /* ─────────── DRAFT (5) ─────────── */
    {
      buyer: b0._id, status: 'draft',
      title: 'Abonamente telefonie mobilă corporate — 60 linii',
      description: 'Contract abonamente telefonie mobilă pentru 60 angajați: minute nelimitate naționale, 50 GB date/linie, roaming UE inclus, terminale la alegere. Durata 24 luni.',
      category: 'Telecomunicații', quantity: '60 linii / 24 luni',
      tags: ['telefonie', 'corporate', 'abonamente', 'mobil'],
      startPrice: 43200,
      location: { lat: 44.4268, lng: 26.1025, address: 'Bd. Unirii 14', city: 'București' },
    },
    {
      buyer: b3._id, status: 'draft',
      title: 'Servicii fotografie și video pentru catalog produse',
      description: 'Ședință foto + video profesional pentru catalog produse: 200 produse fotografiate pe fond alb, 10 clipuri video 30s produse erou, editare + retușare, livrare fișiere RAW + JPEG + MP4.',
      category: 'Marketing & PR', quantity: '200 produse foto + 10 video',
      tags: ['fotografie', 'video', 'catalog', 'produs'],
      startPrice: 12000,
      location: { lat: 44.1598, lng: 28.6348, address: 'Bd. Tomis 88', city: 'Constanța' },
    },
    {
      buyer: b5._id, status: 'draft',
      title: '',
      description: '',
      category: '',
      quantity: '',
      tags: [],
      startPrice: null,
    },
    {
      buyer: b6._id, status: 'draft',
      title: 'Echipamente fitness sală angajați',
      description: 'Dotare sală fitness internă pentru 150 angajați: 5 benzi alergare, 3 biciclete spinning, aparat multifuncțional, greutăți libere, saltele yoga. Garanție 2 ani, montaj inclus.',
      category: 'Mobilier & Echipamente', quantity: 'Dotare completă sală 80 mp',
      tags: ['fitness', 'gym', 'angajați', 'wellness'],
      startPrice: 45000,
      location: { lat: 45.7983, lng: 24.1256, address: 'Bd. Victoriei 3', city: 'Sibiu' },
    },
    {
      buyer: b7._id, status: 'draft',
      title: 'Siloz metalic capacitate 2.000 tone cereale',
      description: 'Construire siloz metalic cilindric 2.000 tone, fundație beton, ventilare forțată, sondă temperatură, transport hidraulic intern. Autorizație construire incluse în ofertă.',
      category: 'Agricultură', quantity: '1 siloz 2.000 tone',
      tags: ['siloz', 'cereale', 'depozitare', 'agricultură'],
      startPrice: 320000,
      location: { lat: 44.3302, lng: 23.7949, address: 'Str. Unirii 9', city: 'Craiova' },
    },
  ];
}

/* ══════════════════════════════════════════════════════════
   BID MESSAGES (pool realist)
   ══════════════════════════════════════════════════════════ */
const BID_MESSAGES = [
  'Oferim prețul cel mai competitiv de pe piață, cu livrare garantată în termenul solicitat.',
  'Avem experiență de 8 ani în domeniu și referințe disponibile la cerere.',
  'Prețul include transport, instalare și garanție extinsă. Factură fiscală cu TVA.',
  'Putem livra în 7 zile lucrătoare. Certificări ISO 9001:2015 disponibile.',
  'Oferta noastră include suport tehnic gratuit 12 luni și manual în română.',
  'Reducere suplimentară de 5% pentru plata în avans. Facturare rapidă.',
  'Parteneri autorizați pentru această categorie de produse. Garanție fabricant.',
  'Echipa noastră este disponibilă 24/7 pentru urgențe. SLA garantat prin contract.',
  'Produse cu certificat CE și declarație de conformitate inclusă în livrare.',
  'Livrare just-in-time conform programului cumpărătorului. Flexibilitate totală.',
];

/* ══════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════ */
async function seed() {
  const clean = process.argv.includes('--clean');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB conectat');

  if (clean) {
    await Promise.all([
      User.deleteMany({ email: { $regex: /@(techvision|constructpro|horecaelite|logitrans|medcenter|eduprime|retailmart|agrofresh|infosys-solutions|softdev-pro|buildmaster|electrotech|cleanpro|printdesign|foodsupply|transcargo|furniturepro|greenenergy|secureit|officeequip)\.ro$/ } }),
      Auction.deleteMany({ title: { $exists: true } }),
    ]);
    // Șterg și bids-urile asociate
    await Bid.deleteMany({});
    console.log('🧹 Date vechi șterse');
  }

  /* ── 1. Hash parolă ──────────────────────────────────── */
  const hash = await bcrypt.hash(PASSWORD, 10);

  /* ── 2. Creează buyers ──────────────────────────────── */
  const buyerDocs = await User.insertMany(
    BUYERS_DATA.map(b => ({
      ...b,
      role: 'buyer',
      passwordHash: hash,
      isVerified: true,
      rating: parseFloat((4 + Math.random()).toFixed(1)),
      reviewCount: rnd(5, 30),
    }))
  );
  console.log(`👤 ${buyerDocs.length} cumpărători creați`);

  /* ── 3. Creează suppliers ───────────────────────────── */
  const supplierDocs = await User.insertMany(
    SUPPLIERS_DATA.map(s => ({
      ...s,
      role: 'supplier',
      passwordHash: hash,
      isVerified: true,
    }))
  );
  console.log(`🏢 ${supplierDocs.length} furnizori creați`);

  /* ── 4. Creează licitații ───────────────────────────── */
  const now = new Date();
  const auctionTemplates = makeAuctions(buyerDocs, now);

  // Setează publishedAt pentru non-draft
  const auctionDocs = await Auction.insertMany(
    auctionTemplates.map(t => ({
      ...t,
      publishedAt: t.status !== 'draft' ? (t.publishedAt || daysAgo(rnd(1, 10))) : null,
      currentPrice: t.currentPrice || t.startPrice,
      endNotificationsSent: t.status === 'closed',
    }))
  );
  console.log(`📋 ${auctionDocs.length} licitații create`);

  /* ── 5. Creează oferte ─────────────────────────────── */
  const bidsToInsert = [];
  const auctionUpdates = [];

  for (const auction of auctionDocs) {
    if (auction.status === 'draft' || auction.status === 'cancelled') continue;
    if (!auction.startPrice) continue;

    // Active: 60% șansă să aibă oferte, Closed: sigur au oferte
    const shouldHaveBids = auction.status === 'closed' || Math.random() > 0.4;
    if (!shouldHaveBids) continue;

    const bidCount = auction.status === 'closed' ? rnd(3, 6) : rnd(1, 4);
    const suppliers = [...supplierDocs].sort(() => Math.random() - 0.5).slice(0, bidCount);

    let price = auction.startPrice;
    const auctionBids = [];

    for (let i = 0; i < suppliers.length; i++) {
      // Fiecare ofertă e mai mică cu 3-12% față de precedenta
      const dropPct = 0.03 + Math.random() * 0.09;
      price = Math.round(price * (1 - dropPct));

      const bidDoc = {
        auction:   auction._id,
        supplier:  suppliers[i]._id,
        amount:    price,
        message:   pick(BID_MESSAGES),
        isWinning: false,
        createdAt: auction.status === 'closed'
          ? new Date(auction.publishedAt.getTime() + (i + 1) * 3600000 * rnd(2, 12))
          : new Date(auction.publishedAt.getTime() + (i + 1) * 3600000 * rnd(1, 8)),
      };
      auctionBids.push(bidDoc);
    }

    // Oferta câștigătoare = cea cu prețul cel mai mic
    const winningIdx = auctionBids.reduce((minIdx, b, i, arr) => b.amount < arr[minIdx].amount ? i : minIdx, 0);
    if (auction.status === 'closed') {
      auctionBids[winningIdx].isWinning = true;
    }

    bidsToInsert.push(...auctionBids);

    // Update auction
    auctionUpdates.push({
      id: auction._id,
      currentPrice: auctionBids[winningIdx].amount,
      winningBidIdx: auction.status === 'closed' ? winningIdx : null,
      bids: auctionBids,
    });
  }

  // Insert bids
  const insertedBids = await Bid.insertMany(bidsToInsert.map(b => ({
    auction:   b.auction,
    supplier:  b.supplier,
    amount:    b.amount,
    message:   b.message,
    isWinning: b.isWinning,
    createdAt: b.createdAt,
    updatedAt: b.createdAt,
  })));
  console.log(`💰 ${insertedBids.length} oferte create`);

  // Update currentPrice și winningBid pe fiecare licitație
  // Reconstruim maparea bid index → ObjectId
  let bidOffset = 0;
  for (const upd of auctionUpdates) {
    const count = upd.bids.length;
    const insertedSlice = insertedBids.slice(bidOffset, bidOffset + count);
    bidOffset += count;

    const updateData = { currentPrice: upd.currentPrice };
    if (upd.winningBidIdx !== null && insertedSlice[upd.winningBidIdx]) {
      updateData.winningBid = insertedSlice[upd.winningBidIdx]._id;
    }
    await Auction.findByIdAndUpdate(upd.id, updateData);
  }

  console.log('\n🎉 Seed complet!');
  console.log('──────────────────────────────');
  console.log(`📧 Toți userii au parola: ${PASSWORD}`);
  console.log('\nCumpărători (buyers):');
  buyerDocs.forEach(u => console.log(`  • ${u.email}  (${u.companyName}, ${u.city})`));
  console.log('\nFurnizori (suppliers):');
  supplierDocs.forEach(u => console.log(`  • ${u.email}  (${u.companyName}, ${u.city})`));
  console.log('──────────────────────────────');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Eroare seed:', err);
  process.exit(1);
});
