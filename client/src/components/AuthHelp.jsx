import { useState } from 'react';
import { useNavigate }   from 'react-router-dom';
import { SUPPORT_EMAIL } from '../config';

function Chevron({ open }) {
  return (
    <svg className={`auth-help-chevron ${open ? 'open' : ''}`} width="13" height="13"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function AuthHelp() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [sub,  setSub]  = useState(null);

  const toggleSub = key => setSub(s => (s === key ? null : key));

  return (
    <div className="auth-help">
      <button className="auth-help-toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        Nu te poți conecta?
        <Chevron open={open} />
      </button>

      {open && (
        <div className="auth-help-panel">
          {/* Am uitat parola */}
          <button className="auth-help-item" onClick={() => navigate('/forgot-password')}>
            <span className="auth-help-item-ico">🔑</span>
            Am uitat parola
            <span className="auth-help-item-arrow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </button>

          {/* Nu mai am acces la email */}
          <button
            className={`auth-help-item ${sub === 'noEmail' ? 'active' : ''}`}
            onClick={() => toggleSub('noEmail')}
            aria-expanded={sub === 'noEmail'}
          >
            <span className="auth-help-item-ico">📭</span>
            Nu mai am acces la email
            <span className="auth-help-item-arrow"><Chevron open={sub === 'noEmail'} /></span>
          </button>
          {sub === 'noEmail' && (
            <div className="auth-help-info">
              Dacă nu mai ai acces la adresa de email asociată contului, resetarea automată nu este
              posibilă. Contactează suportul RevBid la{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> — echipa te va ajuta să îți
              verifici identitatea și să recuperezi accesul.
              <br /><strong>Include în mesaj:</strong>
              <ul>
                <li>numele contului / companiei</li>
                <li>adresa de email veche asociată contului</li>
                <li>numărul de telefon, dacă există</li>
                <li>alte detalii relevante despre cont</li>
              </ul>
            </div>
          )}

          {/* Am nevoie de ajutor */}
          <button
            className={`auth-help-item ${sub === 'help' ? 'active' : ''}`}
            onClick={() => toggleSub('help')}
            aria-expanded={sub === 'help'}
          >
            <span className="auth-help-item-ico">💬</span>
            Am nevoie de ajutor
            <span className="auth-help-item-arrow"><Chevron open={sub === 'help'} /></span>
          </button>
          {sub === 'help' && (
            <div className="auth-help-info">
              Pentru orice problemă de acces, scrie echipei RevBid la{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              <br />Program suport: <strong>Luni–Vineri, 9–18</strong>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
