import { useNavigate } from 'react-router-dom';
import StarRating from './StarRating';

const fmt = n => (n === null || n === undefined ? '—' : Number(n).toLocaleString('ro-RO'));

const fmtDate = d => (d
  ? new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })
  : '');

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
  role, auction, invoiceMeta, counterparty, companyComplete,
  completion, confirming,
  onConfirmDelivery, onConfirmReceipt, onOpenReview,
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
  const showCollab = completion?.exists && (role === 'buyer' || role === 'winner');

  return (
    <>
      {/* ── Documente finale ── */}
      <div className="card">
        <div className="ad-card-head">
          <span className="ad-card-icon">📄</span>
          <h3 className="card-title">Documente finale</h3>
        </div>

        {companyComplete === false && (
          <div className="ao-cta">
            <div className="ao-cta-body">
              <span className="ao-cta-ico">🏢</span>
              <div>
                <p className="ao-cta-title">Completează datele companiei</p>
                <p className="ao-cta-sub">
                  Datele firmei tale lipsesc sau sunt incomplete. Completează-le pentru ca
                  documentele generate să te identifice corect.
                </p>
              </div>
            </div>
            <button
              className="btn btn-primary btn-block btn-sm"
              onClick={() => navigate('/settings?tab=company')}
            >
              Actualizează datele fiscale
            </button>
          </div>
        )}

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

      {/* ── Finalizarea colaborării ── */}
      {showCollab && (
        <CollaborationCard
          role={role}
          completion={completion}
          confirming={confirming}
          onConfirmDelivery={onConfirmDelivery}
          onConfirmReceipt={onConfirmReceipt}
          onOpenReview={onOpenReview}
        />
      )}

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

/* ── Card workflow post-licitație: confirmări + review ── */
function CollaborationCard({ role, completion, confirming, onConfirmDelivery, onConfirmReceipt, onOpenReview }) {
  const {
    supplierDeliveryConfirmed: delivered,
    buyerReceiptConfirmed:     received,
    readyForReview,
    myReview,
    receivedReview,
  } = completion;

  const isWinner       = role === 'winner';
  const myConfirmed    = isWinner ? delivered : received;
  const otherConfirmed = isWinner ? received  : delivered;

  const steps = [
    { label: 'Licitație finalizată',             done: true },
    { label: 'Livrare confirmată de furnizor',   done: delivered },
    { label: 'Primire confirmată de cumpărător', done: received },
    { label: 'Review-uri disponibile',           done: readyForReview },
    { label: 'Review trimis',                    done: !!myReview },
  ];

  let statusText;
  if (readyForReview) {
    statusText = myReview
      ? 'Colaborarea este completă. Mulțumim pentru review!'
      : 'Ambele părți au confirmat — poți lăsa acum un review.';
  } else if (myConfirmed && !otherConfirmed) {
    statusText = isWinner
      ? 'Așteptăm confirmarea primirii de la cumpărător.'
      : 'Așteptăm confirmarea livrării de la furnizor.';
  } else if (!myConfirmed && otherConfirmed) {
    statusText = isWinner
      ? 'Cumpărătorul a confirmat primirea. Confirmă livrarea pentru a debloca review-urile.'
      : 'Furnizorul a confirmat livrarea. Confirmă primirea pentru a debloca review-urile.';
  } else {
    statusText = isWinner
      ? 'Confirmă livrarea după ce ai livrat produsul sau ai prestat serviciul.'
      : 'Confirmă primirea după ce ai primit produsele sau serviciile.';
  }

  return (
    <div className="card">
      <div className="ad-card-head">
        <span className="ad-card-icon">✅</span>
        <h3 className="card-title">Finalizarea colaborării</h3>
      </div>

      <ol className="ao-stepper">
        {steps.map((s, i) => (
          <li key={i} className="ao-stepper-item">
            <div className="ao-stepper-marker">
              <span className={`ao-stepper-dot ${s.done ? 'done' : 'todo'}`}>
                {s.done ? '✓' : i + 1}
              </span>
              {i < steps.length - 1 && (
                <span className={`ao-stepper-line ${s.done ? 'done' : ''}`} />
              )}
            </div>
            <span className={`ao-stepper-label ${s.done ? 'done' : 'todo'}`}>{s.label}</span>
          </li>
        ))}
      </ol>

      <div className={`ao-collab-status ${readyForReview ? 'ready' : 'pending'}`}>
        {statusText}
      </div>

      {!myConfirmed && (
        <button
          className="btn btn-primary btn-block btn-sm"
          onClick={isWinner ? onConfirmDelivery : onConfirmReceipt}
          disabled={confirming}
          style={{ marginTop: '10px' }}
        >
          {confirming
            ? 'Se confirmă…'
            : isWinner ? '📦 Confirmă livrarea' : '📥 Confirmă primirea'}
        </button>
      )}
      {myConfirmed && (
        <div className="ao-confirmed">
          ✓ {isWinner ? 'Ai confirmat livrarea' : 'Ai confirmat primirea'}
        </div>
      )}

      {readyForReview && !myReview && (
        <button
          className="btn btn-block btn-sm ao-review-cta"
          onClick={onOpenReview}
          style={{ marginTop: '8px' }}
        >
          ⭐ Lasă review {isWinner ? 'cumpărătorului' : 'furnizorului'}
        </button>
      )}

      {myReview && (
        <div className="ao-review-box">
          <p className="ao-review-box-label">Review-ul tău</p>
          <div className="ao-review-box-stars">
            <StarRating value={myReview.rating} readOnly size={17} />
            <span className="ao-review-box-date">{fmtDate(myReview.createdAt)}</span>
          </div>
          {myReview.comment && <p className="ao-review-box-text">„{myReview.comment}”</p>}
        </div>
      )}

      {receivedReview && (
        <div className="ao-review-box received">
          <p className="ao-review-box-label">Review primit</p>
          <div className="ao-review-box-stars">
            <StarRating value={receivedReview.rating} readOnly size={17} />
            <span className="ao-review-box-date">{fmtDate(receivedReview.createdAt)}</span>
          </div>
          {receivedReview.comment && <p className="ao-review-box-text">„{receivedReview.comment}”</p>}
        </div>
      )}
    </div>
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

.ao-cta {
  background: #FFFBEB; border: 1px solid #FDE68A;
  border-radius: var(--radius-md); padding: 12px; margin-bottom: 14px;
}
.ao-cta-body { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
.ao-cta-ico { font-size: 1.25rem; flex-shrink: 0; line-height: 1.2; }
.ao-cta-title { font-size: 0.8125rem; font-weight: 700; color: #92400E; margin: 0; }
.ao-cta-sub { font-size: 0.75rem; color: #92400E; margin: 3px 0 0; line-height: 1.45; }

/* ── Workflow post-licitație ── */
.ao-stepper { list-style: none; margin: 0 0 4px; padding: 0; }
.ao-stepper-item { display: flex; gap: 10px; align-items: flex-start; }
.ao-stepper-marker { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.ao-stepper-dot {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.6875rem; font-weight: 800;
}
.ao-stepper-dot.done { background: var(--success-green); color: #fff; }
.ao-stepper-dot.todo { background: var(--ice-blue); color: var(--text-muted); border: 1px solid var(--border); }
.ao-stepper-line { width: 2px; flex: 1; min-height: 13px; background: var(--border-light); margin: 2px 0; }
.ao-stepper-line.done { background: var(--success-green); }
.ao-stepper-label { font-size: 0.8125rem; padding-bottom: 11px; line-height: 1.4; }
.ao-stepper-label.done { color: var(--text-heading); font-weight: 600; }
.ao-stepper-label.todo { color: var(--text-muted); }

.ao-collab-status {
  font-size: 0.78rem; line-height: 1.5; border-radius: var(--radius-md);
  padding: 9px 11px; border: 1px solid;
}
.ao-collab-status.pending { background: #FFFBEB; border-color: #FDE68A; color: #92400E; }
.ao-collab-status.ready   { background: #ECFDF5; border-color: #A7F3D0; color: #065F46; }

.ao-confirmed {
  margin-top: 10px; text-align: center;
  font-size: 0.8125rem; font-weight: 700; color: var(--success-green);
  background: #ECFDF5; border: 1px solid #A7F3D0;
  border-radius: var(--radius-md); padding: 9px 11px;
}
.ao-review-cta {
  background: var(--warning-amber); color: #fff; border: 1px solid var(--warning-amber);
  font-weight: 700;
}
.ao-review-cta:hover { filter: brightness(0.95); }

.ao-review-box {
  margin-top: 12px; padding: 11px 13px;
  background: var(--ice-blue); border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}
.ao-review-box.received { background: #FFFBF2; border-color: #FDE9C8; }
.ao-review-box-label {
  font-size: 0.625rem; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 5px;
}
.ao-review-box-stars { display: flex; align-items: center; gap: 8px; }
.ao-review-box-date { font-size: 0.6875rem; color: var(--text-muted); }
.ao-review-box-text { font-size: 0.8125rem; color: var(--text-body); line-height: 1.5; margin: 6px 0 0; font-style: italic; }
`;
