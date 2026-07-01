# Licență RevBid — ghid de utilizare a proiectului LaTeX

Acest folder conține lucrarea de licență completă, scrisă pe structura template-ului oficial de diplomă, pe baza codului real din RevBid.

## Structura

```
licenta/
├── licenta-revbid.tex        # fișierul principal (preambul + pagini de titlu + \input capitole)
├── bibliography.bib          # bibliografia (35 de intrări, toate citate în text)
├── capitole/
│   ├── cap1-introducere.tex
│   ├── cap2-analiza-cerintelor.tex
│   ├── cap3-studiu-piata.tex
│   ├── cap4-solutia-propusa.tex
│   ├── cap5-implementare.tex
│   ├── cap6-evaluare.tex
│   ├── cap7-concluzii.tex
│   └── anexe.tex             # extrase de cod + galerie capturi + ghid rulare/măsurători
└── pics/                     # AICI pui toate imaginile (vezi lista de mai jos)
```

## Cum compilezi

**Overleaf (recomandat):** arhivează folderul `licenta/` ca .zip → New Project → Upload Project → setează `licenta-revbid.tex` ca fișier principal → compilator **pdfLaTeX**. Compilează de 2–3 ori (pentru cuprins + bibliografie).

**Local (MiKTeX/TeX Live):**
```
pdflatex licenta-revbid.tex
bibtex   licenta-revbid
pdflatex licenta-revbid.tex
pdflatex licenta-revbid.tex
```

Documentul **compilează și fără imagini** — fiecare figură lipsă apare ca o casetă roșie cu numele fișierului așteptat și descrierea conținutului. Toate elementele de completat sunt marcate **cu roșu în PDF** (`[TODO: ...]` / `[de completat]`), deci le găsești ușor înainte de predare.

## Pasul 0 — obligatoriu

1. Copiază din template-ul oficial **`pics/upb-logo.jpg`** și **`pics/cs-logo.pdf`** în `licenta/pics/`.
2. În `licenta-revbid.tex`, completează **numele coordonatorului** (`\Advisor`) și textul de la **Mulțumiri** (`\Thanks`) — sau comentează `\ThanksPage`.
3. Verifică titlul/subtitlul (`\ProjectTitleRO/EN`, `\ProjectSubtitleRO/EN`) — am pus o propunere, schimb-o dacă vrei altceva.

## Cum înlocuiești un placeholder de figură

În `.tex`, fiecare placeholder arată așa:
```latex
% \includegraphics[width=0.95\textwidth]{pics/nume-figura}   ← decomentezi linia din \placeholderfig
\placeholderfig{0.95}{nume-figura}{7cm}{descriere...}{Caption final}
```
Cel mai simplu: pui imaginea în `pics/` cu **exact numele indicat** (ex. `ss-notificari.png`), apoi înlocuiești apelul `\placeholderfig{...}` cu:
```latex
\begin{figure}[!ht]
\centering
\includegraphics[width=0.95\textwidth]{pics/nume-figura}
\caption{Caption-ul existent}
\label{fig:nume-figura}     % păstrează același label!
\end{figure}
```
(Label-ul = numele fișierului; referințele din text funcționează automat.)

## Inventarul complet al imaginilor de creat (24)

### Diagrame de desenat (draw.io / PlantUML) — 5
| Fișier | Capitol | Conținut |
|---|---|---|
| `diagrama-cazuri-utilizare.png` | 2 | UML use-case: 3 actori + cazurile majore |
| `arhitectura-generala.png` | 4 | Client React ↔ (REST + WebSocket) ↔ server Node (Express, Socket.IO, cron, servicii) ↔ MongoDB; extern: Cloudinary, SMTP, Google OAuth |
| `diagrama-bd.png` | 4 | Colecțiile + referințele (după Tabelul colecțiilor; indicațiile sunt în comentariul din .tex) |
| `stari-licitatie.png` | 4 | Automat: draft→active→closed/cancelled + banda post-licitație (invoice→confirmări→recenzii) |
| `flux-ofertare.png` | 4 | Diagramă de secvență place_bid, inclusiv cazul a 2 oferte simultane |

### Capturi de ecran din aplicație — 16
| Fișier | Unde | Ce surprinzi |
|---|---|---|
| `ss-detaliu-licitatie.png` | cap. 5 | licitație activă: preț curent, countdown, grafic preț, istoric oferte, formular ofertare |
| `ss-creare-licitatie.png` | cap. 5 | formularul de creare, butoanele Draft/Publică, ideal cu o eroare de validare vizibilă |
| `ss-notificari.png` | cap. 5 | centrul de notificări cu filtre/căutare/paginare |
| `ss-landing.png` | anexa B | landing page (poți refolosi `proiect/landing-page.png`) |
| `ss-autentificare.png` | anexa B | login cu butonul Google |
| `ss-dashboard-cumparator.png` | anexa B | dashboard buyer cu licitațiile proprii |
| `ss-dashboard-furnizor.png` | anexa B | dashboard supplier cu filtre |
| `ss-ofertele-mele.png` | anexa B | pagina My Bids |
| `ss-mesagerie.png` | anexa B | conversație privată (ideal cu imagine) |
| `ss-profil-public.png` | anexa B | profil cu rating + recenzii |
| `ss-setari-companie.png` | anexa B | secțiunea date fiscale |
| `ss-admin-utilizatori.png` | anexa B | admin: lista utilizatori + ban |
| `ss-admin-diff.png` | anexa B | admin: cerere de editare cu diff vechi/nou |
| `ss-pdf-rezumat.png` | anexa B | PDF-ul „Rezumat de tranzacție” generat |
| `ss-statistici-cumparator.png` | anexa B | dashboard statistici buyer |
| `ss-statistici-furnizor.png` | anexa B | dashboard statistici supplier |

> Sfat: rulează `node seed.js --clean` înainte — capturile arată mult mai bine cu date realiste. Browser la 1920×1080, zoom 100%.

### Capturi/grafice externe — 3
| Fișier | Unde | Cum îl obții |
|---|---|---|
| `npm-trends.png` | cap. 3 | npmtrends.com → compară `react` vs `vue` vs `@angular/core` vs `svelte`, 5 ani → captură |
| `grafic-latente.png` | cap. 6 | histogramă/box-plot din măsurătorile tale de latență (Excel/Sheets) |
| `ss-lighthouse.png` | cap. 6 | Chrome DevTools → Lighthouse → desktop, pe build-ul de producție |

## Date de măsurat și completat (capitolul 6)

Toate celulele apar roșu în PDF (`[de completat]`); comenzile exacte sunt în **Anexa C** a lucrării:

1. **Tabel performanță REST** — `autocannon -c 50 -d 30` pe 5 endpoint-uri (req/s, p50, p99) + 2–3 fraze de interpretare;
2. **Tabel latență ofertare** — 100 de oferte măsurate cu `performance.now()` în 2 browsere (emit→ack și emit→new_bid);
3. **Tabel Lighthouse** — scorurile pe 3 pagini + dimensiunea bundle-ului din `npm run build`;
4. **Tabel SUS** — mini-studiu cu 5–8 participanți (protocolul și formula sunt deja scrise în lucrare);
5. **Configurația mașinii de test** (CPU, RAM, OS, versiuni Node/MongoDB);
6. cap. 2 — opțional dar valoros: 1–2 paragrafe despre interviuri/feedback de la utilizatori reali (există marcaje TODO unde trebuie inserate).

## Ce verifici înainte de predare

- [ ] nu mai există text roșu în PDF (TODO-uri / valori de completat);
- [ ] toate casetele de figuri au fost înlocuite cu imagini reale;
- [ ] numele coordonatorului + anul pe pagina de titlu;
- [ ] re-rulează scenariile S01–S17 din capitolul 6 ca să confirmi rezultatele „Trecut”;
- [ ] compilare finală curată (2× pdflatex după bibtex), cuprins și referințe corecte.
