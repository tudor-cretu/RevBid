import Logo, { LogoMark } from './Logo';

const COPY = {
  login: {
    headline: <>Lasă furnizorii să <span className="ab-hl">concureze</span> pentru tine.</>,
    sub: 'Autentifică-te și gestionează licitațiile inverse — furnizorii licitează în jos, tu alegi cea mai bună ofertă.',
  },
  register: {
    headline: <>Începe să <span className="ab-hl">economisești</span> din prima licitație.</>,
    sub: 'Creează un cont gratuit și intră pe marketplace-ul B2B unde prețurile scad, nu cresc.',
  },
};

const BENEFITS = [
  {
    title: 'Prețurile scad, nu cresc',
    text:  'Furnizorii licitează în jos — tu plătești mai puțin.',
    icon:  <><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></>,
  },
  {
    title: 'Furnizori verificați',
    text:  'Profil, rating și istoric pentru fiecare partener.',
    icon:  <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></>,
  },
  {
    title: 'Oferte în timp real',
    text:  'Vezi prețul scăzând live, secundă cu secundă.',
    icon:  <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>,
  },
];

export default function AuthBrandPanel({ mode = 'login' }) {
  const copy = COPY[mode] || COPY.login;

  return (
    <aside className="auth-brand">
      {/* Decor */}
      <div className="ab-glow ab-glow-1" />
      <div className="ab-glow ab-glow-2" />
      <div className="ab-grid-pattern" />
      <div className="ab-bg-mark"><LogoMark size={440} variant="light" /></div>

      <div className="ab-content">
        <Logo size="md" variant="light" />

        <div className="ab-hero">
          <span className="ab-eyebrow">
            <span className="ab-eyebrow-dot" />
            Marketplace B2B de licitații inverse
          </span>
          <h1 className="ab-headline">{copy.headline}</h1>
          <p className="ab-sub">{copy.sub}</p>
        </div>

        {/* Preview produs */}
        <div className="ab-preview">
          <div className="ab-mock">
            <div className="ab-mock-head">
              <span className="ab-live"><span className="ab-live-dot" />LICITAȚIE LIVE</span>
              <span className="ab-mock-timer">02:14:30</span>
            </div>
            <p className="ab-mock-title">Laptop business i7 · 16GB RAM — 25 buc.</p>

            <div className="ab-mock-price">
              <div>
                <span className="ab-mock-price-lbl">Preț curent</span>
                <span className="ab-mock-price-val">4.300 RON</span>
              </div>
              <span className="ab-mock-drop">▼ 18%</span>
            </div>

            {/* Sparkline descendent */}
            <svg className="ab-spark" viewBox="0 0 248 60" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="abSparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#00A99D" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00A99D" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 10 L41 22 L83 17 L124 32 L166 29 L207 43 L248 47 L248 60 L0 60 Z" fill="url(#abSparkFill)" />
              <path d="M0 10 L41 22 L83 17 L124 32 L166 29 L207 43 L248 47" fill="none" stroke="#2BD4C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="248" cy="47" r="3.5" fill="#2BD4C7" />
            </svg>

            <div className="ab-mock-bids">
              <div className="ab-mock-bid win">
                <span>🏆 TechSupply SRL</span>
                <span>4.300 RON</span>
              </div>
              <div className="ab-mock-bid">
                <span>DataPro Solutions</span>
                <span>4.480 RON</span>
              </div>
            </div>
          </div>

          {/* Floating cards */}
          <div className="ab-float ab-float-1">
            <span className="ab-float-ico" style={{ background: '#DCFCE7', color: '#17B26A' }}>👥</span>
            <div>
              <p className="ab-float-val">12</p>
              <p className="ab-float-lbl">furnizori activi</p>
            </div>
          </div>
          <div className="ab-float ab-float-2">
            <span className="ab-float-ico" style={{ background: '#D8F3F1', color: '#00A99D' }}>📉</span>
            <div>
              <p className="ab-float-val">18%</p>
              <p className="ab-float-lbl">economii medii</p>
            </div>
          </div>
        </div>

        {/* Beneficii */}
        <div className="ab-benefits">
          {BENEFITS.map(b => (
            <div key={b.title} className="ab-benefit">
              <span className="ab-benefit-ico">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {b.icon}
                </svg>
              </span>
              <div>
                <p className="ab-benefit-title">{b.title}</p>
                <p className="ab-benefit-text">{b.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Trust metrics */}
        <div className="ab-trust">
          <div className="ab-trust-item"><b>500+</b><span>licitații finalizate</span></div>
          <span className="ab-trust-sep" />
          <div className="ab-trust-item"><b>23%</b><span>economie medie</span></div>
          <span className="ab-trust-sep" />
          <div className="ab-trust-item"><b>200+</b><span>furnizori verificați</span></div>
        </div>
      </div>
    </aside>
  );
}
