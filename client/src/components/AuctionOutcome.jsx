import { useNavigate } from 'react-router-dom';

const fmt = n => (n === null || n === undefined ? '—' : Number(n).toLocaleString('ro-RO'));

const STEPS = {
  buyer: [
    'Verifică oferta câștigătoare și detaliile licitației.',
    'Contactează furnizorul pentru confirmarea detaliilor.',
    'Stabiliți împreună livrarea, termenii și execuția.',
    'Descarcă rezumatul tranzacției (PDF).',
    'Păstrează comunicarea în RevBid pentru transparență.',
  ],
  winner: [
    'Contactează cumpărătorul pentru confirmarea detaliilor.',
    'Confirmă disponibilitatea produsului sau serviciului.',
    'Stabiliți livrarea sau execuția lucrării.',
    'Descarcă rezumatul tranzacției (PDF).',
    'Păstrează comunicarea în RevBid pentru transparență.',
  ],
};

export default function AuctionOutcome({
  role, auction, invoiceMeta, counterparty,
  onDownloadInvoice, downloadingInvoice, onMessage,
}) {
  const navigate = useNavigate();

  /* ── Furnizor necâștigător ── */
  if (role === 'loser') {
    return (
      <div className="card ao-loser">
        <div className="ad-card-head">
          <span className="ad-card-icon">📊</span>
          <h3 className="card-title">Rezultatul licitației</h3>
        </div>
        <p className="ao-loser-text">
          Licitația s-a încheiat, iar oferta ta nu a fost selectată de această dată.
          Mulțumim pentru participare — sunt licitații noi în fiecare zi.
        </p>
        <button className="btn btn-primary btn-block btn-sm" onClick={() => navigate('/dashboard')}>
          Vezi alte licitații disponibile
        </button>
      </div>
    );
  }

  if (role !== 'buyer' && role !== 'winner') return null;

  const steps   = STEPS[role];
  const cpName  = counterparty
    ? `${counterparty.firstName || ''} ${counterparty.lastName || ''}`.trim()
    : null;
  const cpLabel = role === 'buyer' ? 'Furnizor câștigător' : 'Cumpărător';

  return (
    <>
      {/* ── Documente finale ── */}
      <div className="card">
        <div className="ad-card-head">
          <span className="ad-card-icon">📄</span>
          <h3 className="card-title">Documente finale</h3>
        </div>

        {role === 'winner' && (
          <div className="ao-congrats">
            <span className="ao-congrats-ico">🏆</span>
            <div>
              <p className="ao-congrats-title">Ai câștigat această licitație!</p>
              <p className="ao-congrats-sub">Felicitări — oferta ta a fost cea mai bună.</p>
            </div>
          </div>
        )}

        <div className="ao-doc">
          <div className="ao-doc-info">
            <span className="ao-doc-label">Rezumat tranzacție</span>
            <span className="ao-doc-nr">{invoiceMeta?.invoiceNumber || 'Se pregătește documentul…'}</span>
          </div>
          <span className="ao-doc-amount">{fmt(invoiceMeta?.amount ?? auction?.currentPrice)} RON</span>
        </div>

        <button
          className="btn btn-primary btn-block btn-sm"
          onClick={onDownloadInvoice}
          disabled={downloadingInvoice || !invoiceMeta}
        >
          {downloadingInvoice ? 'Se descarcă…' : '⬇ Descarcă rezumatul (PDF)'}
        </button>
        <p className="ao-doc-note">
          Document informativ — nu reprezintă o factură fiscală.
        </p>
      </div>

      {/* ── Pașii următori ── */}
      <div className="card">
        <div className="ad-card-head">
          <span className="ad-card-icon">🧭</span>
          <h3 className="card-title">{role === 'winner' ? 'Ce urmează' : 'Pașii următori'}</h3>
        </div>
        <ol className="ao-steps">
          {steps.map((s, i) => (
            <li key={i} className="ao-step">
              <span className="ao-step-num">{i + 1}</span>
              <span className="ao-step-text">{s}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Contact ── */}
      <div className="card">
        <div className="ad-card-head">
          <span className="ad-card-icon">🤝</span>
          <h3 className="card-title">Contact {role === 'buyer' ? 'furnizor' : 'cumpărător'}</h3>
        </div>

        {counterparty ? (
          <>
            <div className="ao-contact">
              {counterparty.avatar ? (
                <img src={counterparty.avatar} alt="" className="ao-contact-avatar" />
              ) : (
                <div className="ao-contact-avatar-fb">
                  {counterparty.firstName?.[0]}{counterparty.lastName?.[0]}
                </div>
              )}
              <div className="ao-contact-info">
                <p className="ao-contact-name">{cpName || '—'}</p>
                <p className="ao-contact-meta">
                  {cpLabel}
                  {counterparty.companyName ? ` · ${counterparty.companyName}` : ''}
                  {counterparty.rating > 0 ? ` · ★ ${counterparty.rating.toFixed(1)}` : ''}
                </p>
              </div>
            </div>

            <div className="ao-contact-rows">
              {counterparty.email && (
                <div className="ao-contact-row">
                  <span>✉️</span>
                  <a href={`mailto:${counterparty.email}`}>{counterparty.email}</a>
                </div>
              )}
              {counterparty.phone && (
                <div className="ao-contact-row">
                  <span>📞</span>
                  <a href={`tel:${counterparty.phone}`}>{counterparty.phone}</a>
                </div>
              )}
            </div>

            <div className="ao-contact-actions">
              <button className="btn btn-primary btn-block btn-sm" onClick={onMessage}>
                💬 Trimite mesaj
              </button>
              <button
                className="btn btn-outline btn-block btn-sm"
                onClick={() => navigate(`/profile/${counterparty._id}`)}
              >
                Vezi profilul
              </button>
            </div>
          </>
        ) : (
          <p className="ao-doc-note" style={{ textAlign: 'left' }}>
            Folosește mesageria RevBid pentru a stabili detaliile colaborării.
          </p>
        )}
      </div>

      <style>{outcomeCSS}</style>
    </>
  );
}

const outcomeCSS = `
.ao-congrats {
  display: flex; align-items: center; gap: 11px;
  background: #DCFCE7; border: 1px solid #A7F3D0;
  border-radius: var(--radius-md); padding: 11px 13px; margin-bottom: 14px;
}
.ao-congrats-ico { font-size: 1.625rem; }
.ao-congrats-title { font-size: 0.875rem; font-weight: 700; color: #065F46; margin: 0; }
.ao-congrats-sub { font-size: 0.75rem; color: #047857; margin: 1px 0 0; }

.ao-doc {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  background: var(--ice-blue); border: 1px solid var(--border-light);
  border-radius: var(--radius-md); padding: 11px 13px; margin-bottom: 10px;
}
.ao-doc-info { display: flex; flex-direction: column; min-width: 0; }
.ao-doc-label { font-size: 0.625rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.ao-doc-nr { font-size: 0.8125rem; font-weight: 700; color: var(--text-heading); }
.ao-doc-amount { font-size: 1.0625rem; font-weight: 800; color: var(--bid-teal); white-space: nowrap; }
.ao-doc-note { font-size: 0.6875rem; color: var(--text-muted); margin: 8px 0 0; text-align: center; }

.ao-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ao-step { display: flex; gap: 10px; align-items: flex-start; }
.ao-step-num {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
  background: var(--primary-navy); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.6875rem; font-weight: 800;
}
.ao-step-text { font-size: 0.8125rem; color: var(--text-body); line-height: 1.45; }

.ao-contact { display: flex; align-items: center; gap: 11px; margin-bottom: 12px; }
.ao-contact-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
.ao-contact-avatar-fb {
  width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
  background: var(--bid-teal); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.9375rem; font-weight: 700;
}
.ao-contact-info { min-width: 0; }
.ao-contact-name { font-size: 0.9375rem; font-weight: 700; color: var(--text-heading); margin: 0; }
.ao-contact-meta { font-size: 0.75rem; color: var(--text-muted); margin: 2px 0 0; }
.ao-contact-rows { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.ao-contact-row { display: flex; align-items: center; gap: 7px; font-size: 0.8125rem; }
.ao-contact-row a { color: var(--action-blue); font-weight: 500; word-break: break-all; }
.ao-contact-actions { display: flex; flex-direction: column; gap: 7px; }

.ao-loser-text { font-size: 0.8125rem; color: var(--text-muted); line-height: 1.55; margin: 0 0 12px; }
`;
