import { useNavigate } from 'react-router-dom';

export default function AuctionCard({ auction }) {
  const navigate   = useNavigate();
  const timeLeft   = getTimeLeft(auction.deadline);
  const isExpired  = timeLeft === 'Expirat';

  const statusMap = {
    active:    { cls: 'badge-solid-teal', label: 'Activa' },
    closed:    { cls: 'badge-solid-gray', label: 'Inchisa' },
    cancelled: { cls: 'badge-solid-red',  label: 'Anulata' },
    draft:     { cls: 'badge-solid-amber', label: 'Draft' },
  };
  const st = statusMap[auction.status] || statusMap.closed;

  return (
    <div className="auction-card" onClick={() => navigate(`/auction/${auction._id}`)}>
      {auction.images?.[0] && (
        <div className="auction-card-img-wrap">
          <img src={auction.images[0].url} alt={auction.title} className="auction-card-img" />
          <span className={`badge ${st.cls} auction-card-status`}>{st.label}</span>
        </div>
      )}
      {!auction.images?.[0] && (
        <div className="auction-card-img-placeholder">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted-gray)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          <span className={`badge ${st.cls} auction-card-status`}>{st.label}</span>
        </div>
      )}
      <div className="auction-card-body">
        <div className="auction-card-top">
          <span className="badge badge-blue">{auction.category}</span>
        </div>
        <h3 className="auction-card-title">{auction.title}</h3>
        <p className="auction-card-desc">{auction.description}</p>

        <div className="auction-card-prices">
          <div>
            <p className="auction-card-price-label">Pret curent</p>
            <p className="auction-card-price">{auction.currentPrice} RON</p>
          </div>
          {auction.targetPrice && (
            <div style={{ textAlign: 'right' }}>
              <p className="auction-card-price-label">Pret tinta</p>
              <p className="auction-card-target">{auction.targetPrice} RON</p>
            </div>
          )}
        </div>

        <div className="auction-card-footer">
          {auction.deadline && (
            <span className={`auction-card-deadline ${isExpired ? 'expired' : ''}`}>
              ⏱ {timeLeft}
            </span>
          )}
          {auction.location?.city && (
            <span className="auction-card-location">📍 {auction.location.city}</span>
          )}
        </div>
      </div>

      <style>{cardCSS}</style>
    </div>
  );
}

function getTimeLeft(deadline) {
  if (!deadline) return 'Fara deadline';
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
  cursor: pointer; transition: all var(--transition-normal);
  box-shadow: var(--shadow-xs); display: flex; flex-direction: column;
}
.auction-card:hover {
  box-shadow: var(--shadow-lg); transform: translateY(-3px);
  border-color: var(--bid-teal);
}
.auction-card-img-wrap { position: relative; width: 100%; height: 180px; overflow: hidden; background: var(--ice-blue); }
.auction-card-img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s ease; }
.auction-card:hover .auction-card-img { transform: scale(1.05); }
.auction-card-img-placeholder {
  width: 100%; height: 140px; background: var(--ice-blue);
  display: flex; align-items: center; justify-content: center; position: relative;
}
.auction-card-status { position: absolute; top: 12px; right: 12px; }
.auction-card-body { padding: 1rem 1.25rem 1.25rem; flex: 1; display: flex; flex-direction: column; }
.auction-card-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
.auction-card-title {
  font-size: 0.9375rem; font-weight: 600; margin: 0 0 6px;
  color: var(--text-heading); line-height: 1.4;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.auction-card-desc {
  font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.5;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  flex: 1;
}
.auction-card-prices {
  display: flex; justify-content: space-between; align-items: flex-end;
  margin-bottom: 10px; padding: 10px 12px;
  background: var(--ice-blue); border-radius: var(--radius-md);
}
.auction-card-price-label { font-size: 0.6875rem; color: var(--text-muted); margin: 0; text-transform: uppercase; letter-spacing: 0.03em; font-weight: 500; }
.auction-card-price { font-size: 1.25rem; font-weight: 700; color: var(--bid-teal); margin: 0; }
.auction-card-target { font-size: 1rem; font-weight: 600; color: var(--text-muted); margin: 0; }
.auction-card-footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.auction-card-deadline { font-size: 0.75rem; color: var(--warning-amber); font-weight: 600; }
.auction-card-deadline.expired { color: var(--error-red); }
.auction-card-location { font-size: 0.75rem; color: var(--text-muted); }
`;