import { useNavigate } from 'react-router-dom';

const fmt = n => (n === null || n === undefined ? '—' : Number(n).toLocaleString('ro-RO'));

export default function AuctionCard({ auction }) {
  const navigate   = useNavigate();
  const timeLeft   = getTimeLeft(auction.deadline);
  const isExpired  = timeLeft === 'Expirat';
  const isUrgent   = !isExpired && isWithin24h(auction.deadline);

  const statusMap = {
    active:    { cls: 'badge-solid-teal',  label: 'Activă' },
    closed:    { cls: 'badge-solid-gray',  label: 'Închisă' },
    cancelled: { cls: 'badge-solid-red',   label: 'Anulată' },
    draft:     { cls: 'badge-solid-amber', label: 'Draft' },
  };
  const st = statusMap[auction.status] || statusMap.closed;

  const bidCount  = auction.bidCount ?? 0;
  const hasBids   = bidCount > 0;
  const startPrice = auction.startPrice ?? auction.currentPrice;
  const savings   = startPrice && auction.currentPrice < startPrice
    ? Math.round(((startPrice - auction.currentPrice) / startPrice) * 100)
    : 0;

  const goDetail = e => { e?.stopPropagation(); navigate(`/auction/${auction._id}`); };

  return (
    <div className="auction-card" onClick={goDetail}>
      {/* ── Media ── */}
      <div className="ac-media">
        {auction.images?.[0] ? (
          <img src={auction.images[0].url} alt={auction.title} className="ac-img" />
        ) : (
          <div className="ac-img-placeholder">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--muted-gray)" strokeWidth="1.4">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
            </svg>
          </div>
        )}
        {auction.category && <span className="ac-cat-badge">{auction.category}</span>}
        <span className={`badge ${st.cls} ac-status-badge`}>{st.label}</span>
      </div>

      {/* ── Body ── */}
      <div className="ac-body">
        <h3 className="ac-title">{auction.title}</h3>
        <p className="ac-desc">{auction.description}</p>

        {/* Price strip */}
        <div className="ac-price-strip">
          <div className="ac-price-main">
            <span className="ac-price-label">
              {hasBids ? 'Cea mai bună ofertă' : 'Preț de pornire'}
            </span>
            <span className={`ac-price-value ${hasBids ? 'has-bids' : ''}`}>
              {fmt(auction.currentPrice)} <span className="ac-price-cur">RON</span>
            </span>
          </div>
          {savings > 0 && (
            <span className="ac-savings" title="Reducere față de prețul de pornire">
              ▼ {savings}%
            </span>
          )}
        </div>

        {/* Secondary price meta */}
        {(auction.targetPrice || hasBids) && (
          <div className="ac-price-meta">
            {auction.targetPrice && <span>Țintă: <strong>{fmt(auction.targetPrice)} RON</strong></span>}
            {hasBids && <span>Buget inițial: <strong>{fmt(startPrice)} RON</strong></span>}
          </div>
        )}

        {/* Meta row */}
        <div className="ac-meta">
          <span className="ac-meta-item">
            <IconPin /> {auction.location?.city || 'Nespecificat'}
          </span>
          <span className={`ac-meta-item ${isExpired ? 'expired' : isUrgent ? 'urgent' : ''}`}>
            <IconClock /> {timeLeft}
          </span>
          <span className="ac-meta-item">
            <IconBids /> {hasBids ? `${bidCount} ${bidCount === 1 ? 'ofertă' : 'oferte'}` : 'Fără oferte'}
          </span>
        </div>

        {/* CTA */}
        <div className="ac-cta">
          <button className="ac-btn ac-btn-primary" onClick={goDetail}>
            Vezi detalii
          </button>
          {hasBids && (
            <button className="ac-btn ac-btn-secondary" onClick={goDetail}>
              Compară oferte
            </button>
          )}
        </div>
      </div>

      <style>{cardCSS}</style>
    </div>
  );
}

/* ── Skeleton placeholder ── */
export function AuctionCardSkeleton() {
  return (
    <div className="skel-card">
      <div className="skeleton skel-card-media" />
      <div className="skel-card-body">
        <div className="skeleton skel-line" style={{ width: '85%' }} />
        <div className="skeleton skel-line" style={{ width: '60%' }} />
        <div className="skeleton" style={{ height: 52, borderRadius: 8, marginTop: 4 }} />
        <div className="skeleton skel-line" style={{ width: '45%', marginTop: 4 }} />
        <div className="skeleton" style={{ height: 34, borderRadius: 8, marginTop: 6 }} />
      </div>
    </div>
  );
}

/* ── Iconuri mici ── */
function IconPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconBids() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function isWithin24h(deadline) {
  if (!deadline) return false;
  const diff = new Date(deadline) - new Date();
  return diff > 0 && diff <= 86400000;
}

function getTimeLeft(deadline) {
  if (!deadline) return 'Fără deadline';
  const diff = new Date(deadline) - new Date();
  if (diff <= 0) return 'Expirat';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}z ${h % 24}h`;
  if (h > 0)  return `${h}h ${m}m`;
  return `${m}m`;
}

const cardCSS = `
.auction-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden;
  cursor: pointer; transition: transform var(--transition-normal), box-shadow var(--transition-normal), border-color var(--transition-normal);
  box-shadow: var(--shadow-xs); display: flex; flex-direction: column;
}
.auction-card:hover {
  box-shadow: var(--shadow-lg); transform: translateY(-4px);
  border-color: var(--bid-teal);
}

/* Media */
.ac-media { position: relative; width: 100%; aspect-ratio: 16 / 10; background: var(--ice-blue); overflow: hidden; }
.ac-img { width: 100%; height: 100%; object-fit: cover; transition: transform .45s ease; }
.auction-card:hover .ac-img { transform: scale(1.06); }
.ac-img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.ac-cat-badge {
  position: absolute; top: 10px; left: 10px;
  background: rgba(255,255,255,0.94); color: var(--primary-navy);
  font-size: 0.6875rem; font-weight: 700; padding: 4px 10px;
  border-radius: var(--radius-full); letter-spacing: 0.02em;
  box-shadow: var(--shadow-xs); backdrop-filter: blur(4px);
}
.ac-status-badge { position: absolute; top: 10px; right: 10px; box-shadow: var(--shadow-sm); }

/* Body */
.ac-body { padding: 0.875rem 1rem 1rem; flex: 1; display: flex; flex-direction: column; }
.ac-title {
  font-size: 0.9375rem; font-weight: 700; margin: 0 0 4px;
  color: var(--text-heading); line-height: 1.35;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.ac-desc {
  font-size: 0.8125rem; color: var(--text-muted); margin: 0 0 12px; line-height: 1.5;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}

/* Price strip */
.ac-price-strip {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--ice-blue); border: 1px solid var(--border-light);
  border-radius: var(--radius-md); padding: 9px 12px; margin-bottom: 8px;
}
.ac-price-main { display: flex; flex-direction: column; min-width: 0; }
.ac-price-label {
  font-size: 0.625rem; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.05em; font-weight: 600;
}
.ac-price-value { font-size: 1.25rem; font-weight: 800; color: var(--primary-navy); line-height: 1.2; letter-spacing: -0.02em; }
.ac-price-value.has-bids { color: var(--success-green); }
.ac-price-cur { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
.ac-savings {
  flex-shrink: 0; font-size: 0.6875rem; font-weight: 700;
  color: var(--success-green); background: #DCFCE7;
  padding: 4px 9px; border-radius: var(--radius-full);
}

/* Secondary price meta */
.ac-price-meta {
  display: flex; flex-wrap: wrap; gap: 4px 14px; margin-bottom: 12px;
  font-size: 0.6875rem; color: var(--text-muted);
}
.ac-price-meta strong { color: var(--text-body); font-weight: 700; }

/* Meta row */
.ac-meta {
  display: flex; flex-wrap: wrap; gap: 6px 12px;
  padding-top: 10px; margin-top: auto;
  border-top: 1px solid var(--border-light);
}
.ac-meta-item {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; color: var(--text-muted); font-weight: 500;
}
.ac-meta-item svg { flex-shrink: 0; }
.ac-meta-item.urgent  { color: var(--warning-amber); font-weight: 600; }
.ac-meta-item.expired { color: var(--error-red); font-weight: 600; }

/* CTA */
.ac-cta { display: flex; gap: 8px; margin-top: 12px; }
.ac-btn {
  flex: 1; padding: 8px 12px; border-radius: var(--radius-md);
  font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  font-family: var(--font-sans); transition: all var(--transition-fast);
  white-space: nowrap;
}
.ac-btn-primary { background: var(--bid-teal); color: #fff; border: 1px solid var(--bid-teal); }
.ac-btn-primary:hover { background: #009688; }
.ac-btn-secondary { background: transparent; color: var(--action-blue); border: 1px solid var(--border); }
.ac-btn-secondary:hover { border-color: var(--action-blue); background: var(--ice-blue); }
`;
