# RevBid

**RevBid** este o platformă de tip *reverse bidding* (licitații inverse) pentru achiziții B2B. Spre deosebire de o licitație clasică, aici **prețurile scad**: cumpărătorii publică o cerere (o licitație), iar furnizorii concurează între ei trimițând oferte tot mai mici. La final, furnizorul cu cea mai bună ofertă câștigă colaborarea.

Platforma include dashboard-uri dedicate pentru cumpărători, furnizori și administratori, ofertare în timp real, notificări, emailuri, documente PDF de rezumat al tranzacției, recenzii reciproce, date de companie/fiscale și un flow complet post-licitație.

> Proiect academic — lucrare de licență. Interfața și mesajele sunt integral în limba română.

---

## Cuprins

- [Funcționalități](#funcționalități)
- [Stack tehnologic](#stack-tehnologic)
- [Structura proiectului](#structura-proiectului)
- [Cerințe preliminare](#cerințe-preliminare)
- [Instalare](#instalare)
- [Configurare (variabile de mediu)](#configurare-variabile-de-mediu)
- [Rulare locală](#rulare-locală)
- [Scripturi disponibile](#scripturi-disponibile)
- [Prezentare API](#prezentare-api)
- [Roluri și fluxuri](#roluri-și-fluxuri)
- [Observații](#observații)

---

## Funcționalități

- **Licitații inverse** — cumpărătorii publică cereri, furnizorii ofertează în jos, în timp real.
- **Drafturi de licitație** — licitațiile pot fi salvate incomplete ca draft și publicate ulterior, după completarea câmpurilor obligatorii.
- **Ofertare în timp real** — depunerea ofertelor și actualizarea prețului se fac prin WebSocket (Socket.IO).
- **Auto-extend** — prelungirea automată a deadline-ului dacă o ofertă vine în ultimele minute.
- **Închidere automată** — un job programat închide licitațiile expirate și declanșează flow-ul de finalizare.
- **Dashboard-uri pe rol** — vizualizări separate pentru cumpărător, furnizor și administrator.
- **Flow de aprobare (admin)** — editarea sau ștergerea licitațiilor active trece printr-un flow de cereri aprobate de administrator, cu vizualizare a diferențelor (vechi / nou).
- **Centru de notificări** — pagină dedicată cu listare paginată, filtre pe categorii, căutare, marcare citit/necitit și sincronizare cu clopoțelul din bară.
- **Notificări prin email** — emailuri tranzacționale pentru ofertare, finalizare licitație, confirmări și resetare parolă.
- **Documente PDF** — generarea unui „Rezumat de Tranzacție" în format PDF la finalizarea licitației.
- **Flow post-licitație** — confirmarea livrării de către furnizor și a primirii de către cumpărător, urmată de deblocarea recenziilor.
- **Recenzii reciproce** — cumpărătorul și furnizorul își pot lăsa recenzii (1–5 stele), cu sumar de rating în profilul public.
- **Date de companie / date fiscale** — secțiune dedicată pentru denumire legală, CUI/CIF, Registrul Comerțului și sediu social, folosite în documentele generate.
- **Mesagerie** — conversații private între utilizatori, cu suport pentru imagini, plus chat dedicat în pagina fiecărei licitații.
- **Hărți și grafice** — selectarea locației pe hartă și grafice de evoluție a prețului.
- **Autentificare** — cont cu email și parolă (cu verificare prin cod) sau Google OAuth, plus resetare parolă.
- **Încărcare de imagini** — fotografii pentru licitații și avatar, stocate extern.
- **Logging structurat** — sistem propriu de logare a evenimentelor (audit, securitate, erori) pe server.

---

## Stack tehnologic

Tehnologiile de mai jos au fost identificate direct din `package.json` și din codul sursă al proiectului.

### Frontend (`client/`)
- **React 19** cu **Vite** ca build tool și dev server
- **React Router 7** pentru rutare
- **Socket.IO client** pentru comunicare în timp real
- **Chart.js** + **react-chartjs-2** pentru grafice
- **Leaflet** + **react-leaflet** pentru hărți
- **axios** pentru cereri HTTP

### Backend (`server/`)
- **Node.js** cu **Express 5**
- **MongoDB** prin ODM-ul **Mongoose**
- **Socket.IO** pentru ofertare, notificări și chat în timp real
- **node-cron** pentru job-uri programate (închiderea automată a licitațiilor)

### Autentificare
- **JSON Web Tokens** (`jsonwebtoken`) pentru sesiuni API
- **bcryptjs** pentru hash-uirea parolelor
- **Passport** cu **passport-google-oauth20** pentru autentificare Google OAuth 2.0
- **express-session** pentru fluxul OAuth

### Servicii externe
- **Email:** `nodemailer` (configurat pentru serviciul Gmail)
- **Storage imagini:** **Cloudinary** (`cloudinary`, `multer`, `multer-storage-cloudinary`)
- **Generare PDF:** `pdfkit` (documentul de rezumat al tranzacției)

### Tooling
- **Package manager:** npm (proiectul include `package-lock.json`)
- **Linting:** ESLint (doar pentru client)

---

## Structura proiectului

```
RevBid/
├── client/                  # Aplicația frontend (React + Vite)
│   ├── public/
│   └── src/
│       ├── components/      # Componente reutilizabile (carduri, modale, navbar etc.)
│       ├── context/         # Context React (ex: autentificare)
│       ├── pages/           # Pagini / rute
│       │   └── dashboard/   # Dashboard-uri pe rol (buyer / supplier)
│       ├── utils/           # Utilitare frontend (formatare etc.)
│       ├── assets/
│       ├── config.js        # Configurarea adresei API
│       ├── App.jsx          # Definirea rutelor
│       └── main.jsx         # Punctul de intrare
│
└── server/                  # Aplicația backend (Express + MongoDB)
    ├── config/              # Configurare Cloudinary, mailer, Passport, șabloane email
    ├── jobs/                # Job-uri programate (auto-close licitații)
    ├── middleware/          # Auth, request ID, logging HTTP
    ├── models/              # Scheme Mongoose
    ├── routes/              # Rutele API
    ├── services/            # Logică de business (ex: notificări de finalizare)
    ├── sockets/             # Handlere Socket.IO (ofertare live)
    ├── utils/               # Logging, generare PDF, evenimente, utilitare
    └── index.js             # Punctul de intrare al serverului
```

### Modele de date principale (`server/models/`)

`User`, `Auction`, `Bid`, `AuctionRequest`, `AuctionCompletion`, `AuctionChat`, `Invoice`, `Review`, `Notification`, `Conversation`, `Message`, `Subscription`, `Counter`.

---

## Cerințe preliminare

- **Node.js** 18 sau o versiune mai recentă (Express 5 și Mongoose necesită un runtime modern)
- **npm** (instalat împreună cu Node.js)
- O instanță **MongoDB** accesibilă — locală sau în cloud (de exemplu MongoDB Atlas)
- Conturi pentru serviciile externe folosite, dacă vrei funcționalitatea completă:
  - **Cloudinary** — pentru încărcarea imaginilor
  - Un cont **de email** compatibil SMTP (configurarea actuală folosește serviciul Gmail)
  - **Google Cloud** — credențiale OAuth 2.0, pentru autentificarea cu Google

---

## Instalare

Clonează repository-ul, apoi instalează dependențele separat pentru server și pentru client:

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

---

## Configurare (variabile de mediu)

Variabilele sensibile **nu sunt incluse în repository** (fișierele `.env` sunt ignorate prin `.gitignore`). Configurarea se face prin fișiere `.env` create local.

> În acest proiect **nu există un fișier `.env.example`**. Se recomandă crearea unuia (`server/.env.example` și `client/.env.example`) care să conțină **doar numele cheilor, fără valori reale**, pentru a ușura configurarea de către alți dezvoltatori.

### Backend — `server/.env`

Creează fișierul `server/.env` cu următoarele chei (valorile sunt specifice mediului tău și nu trebuie comise în repository):

| Cheie | Descriere |
|---|---|
| `MONGO_URI` | Șirul de conexiune la baza de date MongoDB |
| `JWT_SECRET` | Secretul folosit pentru semnarea token-urilor JWT |
| `SESSION_SECRET` | Secretul pentru sesiunile Express (fluxul OAuth) |
| `PORT` | Portul pe care rulează serverul (implicit `5000`) |
| `CLIENT_URL` | Adresa aplicației frontend (ex: `http://localhost:5173`), folosită pentru CORS |
| `CLOUDINARY_CLOUD_NAME` | Numele cloud-ului Cloudinary |
| `CLOUDINARY_API_KEY` | Cheia API Cloudinary |
| `CLOUDINARY_API_SECRET` | Secretul API Cloudinary |
| `EMAIL_USER` | Utilizatorul contului de email pentru trimiterea mesajelor |
| `EMAIL_PASS` | Parola / parola de aplicație a contului de email |
| `EMAIL_FROM` | Adresa afișată ca expeditor al emailurilor |
| `GOOGLE_CLIENT_ID` | Client ID-ul aplicației Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Client Secret-ul aplicației Google OAuth |

Opțional, poți seta și `NODE_ENV` și `LOG_LEVEL` pentru a controla mediul și nivelul de logare.

### Frontend — `client/.env`

Adresa API-ului folosită de client este definită în `client/src/config.js`. Există de asemenea un fișier `client/.env` care poate conține:

| Cheie | Descriere |
|---|---|
| `VITE_API_URL` | Adresa de bază a API-ului backend |

> Verifică `client/src/config.js` pentru a confirma cum este preluată adresa API în configurarea ta locală și ajusteaz-o dacă rulezi serverul pe alt port sau pe altă mașină.

---

## Rulare locală

Asigură-te că ai o instanță MongoDB pornită și fișierele `.env` configurate, apoi pornește separat backend-ul și frontend-ul (în două terminale).

### 1. Backend

```bash
cd server
npm run dev      # rulează cu nodemon (reîncărcare automată)
# sau
npm start        # rulează cu node
```

Serverul pornește implicit pe `http://localhost:5000`.

### 2. Frontend

```bash
cd client
npm run dev
```

Aplicația web pornește implicit pe `http://localhost:5173` (portul implicit Vite).

Deschide adresa afișată în terminal pentru a accesa platforma.

---

## Scripturi disponibile

### Server (`server/package.json`)

| Comandă | Descriere |
|---|---|
| `npm start` | Pornește serverul cu `node` |
| `npm run dev` | Pornește serverul cu `nodemon` (reîncărcare la modificări) |

> Proiectul nu include momentan o suită de teste automate configurată.

### Client (`client/package.json`)

| Comandă | Descriere |
|---|---|
| `npm run dev` | Pornește dev server-ul Vite |
| `npm run build` | Construiește versiunea de producție |
| `npm run preview` | Previzualizează build-ul de producție |
| `npm run lint` | Rulează ESLint pe codul sursă |

---

## Prezentare API

Backend-ul expune un API REST sub prefixul `/api`, plus o conexiune Socket.IO pentru funcționalitățile în timp real. Grupurile principale de rute (vezi `server/index.js` și `server/routes/`):

| Prefix | Responsabilitate |
|---|---|
| `/api/auth` | Înregistrare, autentificare, verificare email, resetare parolă, Google OAuth, setări cont, date companie |
| `/api/auctions` | Creare, editare, publicare și listare licitații; drafturi; chat licitație |
| `/api/bids` | Ofertele furnizorilor |
| `/api/auction-requests` | Cereri de editare/ștergere și flow-ul de aprobare admin |
| `/api/upload` | Încărcarea imaginilor (Cloudinary) |
| `/api/invoices` | Documentele de rezumat al tranzacției (metadate și PDF) |
| `/api/notifications` | Centru de notificări — listare, filtre, marcare citit/necitit |
| `/api/messages` | Conversații și mesaje private |
| `/api/subscriptions` | Abonarea la licitații pentru notificări |
| `/api/support` | Mesaje către echipa de suport |
| `/api/admin` | Operațiuni de administrare |
| `/api` (reviews) | Recenzii și confirmări post-licitație |

Comunicarea în timp real (Socket.IO) acoperă depunerea ofertelor, actualizarea prețului, prelungirea deadline-ului, finalizarea licitației, chat-ul și livrarea notificărilor.

---

## Roluri și fluxuri

Platforma definește trei roluri de utilizator:

- **Cumpărător (buyer)** — creează licitații (inclusiv ca draft), gestionează cererile primite, alege oferta câștigătoare, confirmă primirea și lasă recenzii.
- **Furnizor (supplier)** — explorează licitațiile active, depune oferte competitive, confirmă livrarea și lasă recenzii.
- **Administrator (admin)** — are vizibilitate globală asupra licitațiilor, aprobă/respinge cererile de editare și ștergere și gestionează utilizatorii.

**Flow tipic al unei licitații:**

1. Cumpărătorul creează o licitație (o poate salva ca **draft** sau o poate **publica** direct).
2. După publicare, furnizorii depun oferte care scad prețul în timp real.
3. La atingerea deadline-ului, un job programat închide licitația și determină câștigătorul.
4. Se generează un **document de rezumat al tranzacției (PDF)** și se trimit notificări/emailuri.
5. Furnizorul confirmă **livrarea**, iar cumpărătorul confirmă **primirea**.
6. După ambele confirmări, se deblochează **recenziile reciproce**.

---

## Observații

- Fișierele `.env` și directorul `server/logs/` sunt excluse din repository prin `.gitignore` — nu comite niciodată chei, parole sau token-uri.
- Anumite funcționalități depind de servicii externe: fără credențiale **Cloudinary** încărcarea imaginilor nu va funcționa, fără configurare **de email** notificările prin email nu vor fi trimise, iar fără credențiale **Google OAuth** autentificarea cu Google nu va fi disponibilă. Restul platformei poate fi rulat și fără acestea.
- Generarea documentelor PDF folosește fonturi de sistem pentru afișarea corectă a diacriticelor; în funcție de sistemul de operare, fonturile detectate pot diferi (vezi `server/utils/invoiceDoc.js`).
- Pentru orice nelămurire legată de configurare, consultă codul sursă relevant — în special `server/index.js`, `server/config/` și `client/src/config.js`.
