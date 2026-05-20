import { useEffect, useRef } from 'react';

const fmt = n => (n === null || n === undefined ? '—' : Number(n).toLocaleString('ro-RO'));

const VARIANTS = {
  won: {
    accent: '#17B26A', tint: '#DCFCE7', icon: '🏆',
    title: 'Felicitări! Ai câștigat licitația!',
    msg:   'Oferta ta a fost cea mai bună. Deschide licitația pentru pașii următori.',
    primary: 'Vezi detaliile', primaryAction: 'close',
  },
  lost: {
    accent: '#033667', tint: '#EAF4F7', icon: '🤝',
    title: 'Licitația s-a încheiat',
    msg:   'Oferta ta nu a fost selectată de această dată. Sunt licitații noi în fiecare zi.',
    primary: 'Vezi alte licitații', primaryAction: 'explore',
  },
  buyer: {
    accent: '#00A99D', tint: '#D8F3F1', icon: '🏁',
    title: 'Licitația ta s-a încheiat',
    msg:   'Mai jos găsești rezultatul final al licitației tale.',
    primary: 'Vezi ofertele', primaryAction: 'close',
  },
  watcher: {
    accent: '#0871C4', tint: '#E0F0FF', icon: '👀',
    title: 'Licitația urmărită s-a încheiat',
    msg:   'O licitație pe care o urmăreai s-a finalizat.',
    primary: 'Explorează licitații', primaryAction: 'explore',
  },
  generic: {
    accent: '#033667', tint: '#EAF4F7', icon: '🔔',
    title: 'Licitația s-a încheiat',
    msg:   'Această licitație nu mai acceptă oferte.',
    primary: 'Am înțeles', primaryAction: 'close',
  },
};

export default function AuctionEndModal({
  variant = 'generic', finalPrice = null, winnerName, bidCount = 0, myBid = null,
  hasInvoice = false, downloadingInvoice = false, onDownloadInvoice, onMessage,
  onClose, onExplore,
}) {
  const cfg = VARIANTS[variant] || VARIANTS.generic;
  const primaryRef = useRef(null);
  const showDeal   = variant === 'won' || variant === 'buyer';

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handlePrimary = () => {
    if (cfg.primaryAction === 'explore') onExplore();
    else onClose();
  };

  /* Conținut contextual */
  const hasResult = finalPrice !== null && finalPrice !== undefined;
  let hero = null;
  const rows = [];

  if (variant === 'won' && hasResult) {
    hero = { label: 'Oferta ta câștigătoare', value: `${fmt(finalPrice)} RON`, color: '#17B26A' };
  } else if (variant === 'buyer') {
    if (hasResult) {
      hero = { label: 'Ofertă câștigătoare', value: `${fmt(finalPrice)} RON`, color: '#00A99D' };
      if (winnerName) rows.push(['Furnizor câștigător', winnerName]);
      rows.push(['Total oferte primite', String(bidCount)]);
    } else {
      hero = { label: 'Rezultat', value: 'Fără oferte primite', color: '#6B7C86' };
    }
  } else if (variant === 'lost') {
    if (myBid !== null && myBid !== undefined) rows.push(['Oferta ta', `${fmt(myBid)} RON`]);
    if (hasResult) rows.push(['Ofertă câștigătoare', `${fmt(finalPrice)} RON`]);
  } else if (hasResult) {
    rows.push(['Preț final', `${fmt(finalPrice)} RON`]);
  }

  return (
    <div className="aem-overlay" onClick={onClose}>
      <div
        className="aem-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aem-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="aem-bar" style={{ background: cfg.accent }} />
        <button className="aem-close" onClick={onClose} aria-label="Închide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="aem-icon" style={{ background: cfg.tint }}>{cfg.icon}</div>
        <h2 id="aem-title" className="aem-title">{cfg.title}</h2>
        <p className="aem-msg">{cfg.msg}</p>

        {hero && (
          <div className="aem-hero" style={{ background: cfg.tint }}>
            <span className="aem-hero-label">{hero.label}</span>
            <span className="aem-hero-value" style={{ color: hero.color }}>{hero.value}</span>
          </div>
        )}

        {rows.length > 0 && (
          <div className="aem-rows">
            {rows.map(([k, v]) => (
              <div key={k} className="aem-row">
                <span className="aem-row-key">{k}</span>
                <span className="aem-row-val">{v}</span>
              </div>
            ))}
          </div>
        )}

        <div className="aem-actions">
          {showDeal && hasInvoice && onDownloadInvoice && (
            <button className="aem-btn-soft" onClick={onDownloadInvoice} disabled={downloadingInvoice}>
              {downloadingInvoice ? 'Se descarcă…' : '⬇ Descarcă rezumatul (PDF)'}
            </button>
          )}
          {showDeal && onMessage && (
            <button className="aem-btn-soft" onClick={onMessage}>
              💬 Trimite mesaj {variant === 'won' ? 'cumpărătorului' : 'furnizorului'}
            </button>
          )}
          <button
            ref={primaryRef}
            className="aem-btn-primary"
            style={{ background: cfg.accent }}
            onClick={handlePrimary}
          >
            {cfg.primary}
          </button>
          {cfg.primaryAction !== 'close' && (
            <button className="aem-btn-ghost" onClick={onClose}>Închide</button>
          )}
        </div>
      </div>

      <style>{aemCSS}</style>
    </div>
  );
}

const aemCSS = `
.aem-overlay {
  position: fixed; inset: 0; z-index: 3000;
  background: rgba(3,54,103,0.5); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center; padding: 1rem;
  animation: fadeIn .2s ease;
}
.aem-card {
  position: relative; background: #fff;
  border-radius: var(--radius-xl); width: 100%; max-width: 420px;
  padding: 2rem 1.75rem 1.75rem; text-align: center;
  box-shadow: var(--shadow-xl); overflow: hidden;
  animation: fadeInUp .28s ease;
}
.aem-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; }
.aem-close {
  position: absolute; top: 14px; right: 14px;
  background: none; border: none; cursor: pointer; color: var(--text-muted);
  display: flex; padding: 5px; border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.aem-close:hover { background: var(--ice-blue); color: var(--text-body); }
.aem-icon {
  width: 64px; height: 64px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; margin: 6px auto 14px;
}
.aem-title { font-size: 1.25rem; font-weight: 800; color: var(--primary-navy); margin: 0 0 8px; letter-spacing: -0.02em; }
.aem-msg { font-size: 0.875rem; color: var(--text-muted); line-height: 1.55; margin: 0 0 16px; }
.aem-hero {
  border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 12px;
  display: flex; flex-direction: column; gap: 2px;
}
.aem-hero-label { font-size: 0.625rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.aem-hero-value { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; }
.aem-rows { display: flex; flex-direction: column; margin-bottom: 14px; }
.aem-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 2px; border-bottom: 1px solid var(--border-light); font-size: 0.8125rem;
}
.aem-row:last-child { border-bottom: none; }
.aem-row-key { color: var(--text-muted); }
.aem-row-val { font-weight: 700; color: var(--text-heading); }
.aem-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.aem-btn-primary {
  width: 100%; padding: 11px 18px; border: none; border-radius: var(--radius-md);
  color: #fff; font-size: 0.875rem; font-weight: 700; cursor: pointer;
  font-family: var(--font-sans); transition: filter var(--transition-fast), transform var(--transition-fast);
}
.aem-btn-primary:hover { filter: brightness(1.07); }
.aem-btn-primary:active { transform: translateY(1px); }
.aem-btn-ghost {
  width: 100%; padding: 9px 18px; border: 1px solid var(--border);
  border-radius: var(--radius-md); background: transparent;
  color: var(--text-muted); font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  font-family: var(--font-sans); transition: all var(--transition-fast);
}
.aem-btn-ghost:hover { background: var(--ice-blue); color: var(--text-body); }
.aem-btn-soft {
  width: 100%; padding: 10px 18px; border: 1px solid var(--border);
  border-radius: var(--radius-md); background: var(--ice-blue);
  color: var(--primary-navy); font-size: 0.8125rem; font-weight: 700; cursor: pointer;
  font-family: var(--font-sans); transition: all var(--transition-fast);
}
.aem-btn-soft:hover:not(:disabled) { border-color: var(--bid-teal); color: var(--bid-teal); }
.aem-btn-soft:disabled { opacity: 0.6; cursor: not-allowed; }
@media (max-width: 480px) {
  .aem-card { padding: 1.75rem 1.25rem 1.5rem; }
}
`;
