import { useState } from 'react';
import StarRating from './StarRating';

const MAX_COMMENT = 1000;

/**
 * Modal pentru lăsarea unui review după finalizarea colaborării.
 * @param {'supplier'|'buyer'} revieweeRole  cine este evaluat
 */
export default function ReviewModal({ revieweeRole, revieweeName, onSubmit, onClose, submitting, error }) {
  const [rating,   setRating]   = useState(0);
  const [comment,  setComment]  = useState('');
  const [localErr, setLocalErr] = useState('');

  const title = revieweeRole === 'supplier' ? 'Evaluează furnizorul' : 'Evaluează cumpărătorul';

  const handleSubmit = () => {
    if (rating < 1) { setLocalErr('Selectează un rating între 1 și 5 stele.'); return; }
    setLocalErr('');
    onSubmit(rating, comment.trim());
  };

  return (
    <div className="rm-overlay" onClick={submitting ? undefined : onClose}>
      <div className="rm-modal card" onClick={e => e.stopPropagation()}>
        <h3 className="rm-title">{title}</h3>
        <p className="rm-target">{revieweeName || '—'}</p>

        <div className="rm-field">
          <label className="rm-label">Rating <span className="rm-req">*</span></label>
          <StarRating value={rating} onChange={setRating} size={36} />
          {rating > 0 && (
            <span className="rm-rating-hint">
              {['', 'Slab', 'Acceptabil', 'Bun', 'Foarte bun', 'Excelent'][rating]}
            </span>
          )}
        </div>

        <div className="rm-field">
          <label className="rm-label">
            Comentariu <span className="rm-opt">(opțional)</span>
          </label>
          <textarea
            className="form-input"
            rows={4}
            maxLength={MAX_COMMENT}
            placeholder="Cum a decurs colaborarea? Livrarea, comunicarea, respectarea termenilor…"
            value={comment}
            onChange={e => setComment(e.target.value)}
            style={{ resize: 'vertical' }}
          />
          <span className="rm-count">{comment.length} / {MAX_COMMENT}</span>
        </div>

        <p className="rm-help">
          Review-ul tău ajută comunitatea RevBid să construiască relații mai sigure.
        </p>

        {(localErr || error) && (
          <div className="alert alert-error" style={{ marginBottom: '12px' }}>
            {localErr || error}
          </div>
        )}

        <div className="rm-actions">
          <button className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Anulează
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Se trimite…' : 'Trimite review'}
          </button>
        </div>

        <style>{modalCSS}</style>
      </div>
    </div>
  );
}

const modalCSS = `
.rm-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.rm-modal {
  max-width: 440px; width: 100%; padding: 1.5rem;
  box-shadow: var(--shadow-xl);
}
.rm-title { margin: 0 0 2px; color: var(--primary-navy); font-size: 1.125rem; font-weight: 700; }
.rm-target { margin: 0 0 16px; font-size: 0.875rem; color: var(--text-muted); }
.rm-field { margin-bottom: 16px; }
.rm-label { display: block; font-size: 0.8125rem; font-weight: 600; color: var(--text-heading); margin-bottom: 7px; }
.rm-req { color: var(--error-red); }
.rm-opt { color: var(--text-muted); font-weight: 400; }
.rm-rating-hint { display: inline-block; margin-left: 10px; font-size: 0.8125rem; font-weight: 600; color: var(--warning-amber); vertical-align: 6px; }
.rm-count { display: block; text-align: right; font-size: 0.6875rem; color: var(--text-muted); margin-top: 4px; }
.rm-help { font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; margin: 0 0 14px; }
.rm-actions { display: flex; gap: 8px; justify-content: flex-end; }
`;
