import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL, SUPPORT_EMAIL } from '../config';
import AuthBrandPanel            from '../components/AuthBrandPanel';
import Logo                      from '../components/Logo';

const RULES = [
  { key: 'len',    label: 'Cel puțin 8 caractere', test: pw => pw.length >= 8 },
  { key: 'letter', label: 'Cel puțin o literă',    test: pw => /[a-zA-Z]/.test(pw) },
  { key: 'digit',  label: 'Cel puțin o cifră',     test: pw => /[0-9]/.test(pw) },
];

function EyeIcon({ off }) {
  return off ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function ResetPassword() {
  const navigate  = useNavigate();
  const [params]  = useSearchParams();
  const token     = params.get('token') || '';

  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [status,      setStatus]      = useState(token ? 'form' : 'invalid');

  const ruleState  = useMemo(() => RULES.map(r => ({ ...r, ok: r.test(password) })), [password]);
  const allRulesOk = ruleState.every(r => r.ok);
  const matches    = password.length > 0 && password === confirm;

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!allRulesOk) { setError('Parola nu respectă toate regulile de mai jos.'); return; }
    if (!matches)    { setError('Parolele nu se potrivesc.'); return; }

    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && /invalid|expirat/i.test(data.message || '')) {
          setStatus('invalid');
          return;
        }
        setError(data.message || 'A apărut o eroare. Încearcă din nou.');
        return;
      }
      setStatus('success');
    } catch {
      setError('Eroare de conexiune la server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthBrandPanel mode="login" />

      <div className="auth-form-side">
        <div className="auth-mobile-logo"><Logo size="md" onClick={() => navigate('/')} /></div>

        <div className="auth-card">

          {/* ── Succes ── */}
          {status === 'success' && (
            <div className="auth-state">
              <div className="auth-state-icon ok">✓</div>
              <h2 className="auth-title">Parola a fost schimbată</h2>
              <p className="auth-subtitle" style={{ marginBottom: '1.5rem' }}>
                Te poți autentifica acum cu noua parolă. Parola veche nu mai este valabilă.
              </p>
              <button className="btn btn-primary btn-block btn-lg" onClick={() => navigate('/login')}>
                Mergi la autentificare
              </button>
            </div>
          )}

          {/* ── Token invalid / expirat ── */}
          {status === 'invalid' && (
            <div className="auth-state">
              <div className="auth-state-icon bad">⚠️</div>
              <h2 className="auth-title">Link invalid sau expirat</h2>
              <p className="auth-subtitle" style={{ marginBottom: '1.5rem' }}>
                Acest link de resetare nu mai este valabil. Link-urile expiră după 60 de minute și pot fi folosite o singură dată.
              </p>
              <button className="btn btn-primary btn-block btn-lg" onClick={() => navigate('/forgot-password')}>
                Cere un link nou
              </button>
              <p className="auth-support-line">
                Ai nevoie de ajutor? Contactează{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </p>
            </div>
          )}

          {/* ── Formular ── */}
          {status === 'form' && (
            <>
              <h2 className="auth-title">Setează o parolă nouă</h2>
              <p className="auth-subtitle">
                Alege o parolă sigură pentru contul tău RevBid.
              </p>

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="rp-password">Parolă nouă</label>
                  <div className="auth-pw-field">
                    <input
                      id="rp-password"
                      className="form-input"
                      type={showPw ? 'text' : 'password'}
                      placeholder="Introdu parola nouă"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoFocus
                    />
                    <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(s => !s)}
                      aria-label={showPw ? 'Ascunde parola' : 'Arată parola'}>
                      <EyeIcon off={showPw} />
                    </button>
                  </div>
                </div>

                {/* Reguli parolă — live */}
                <div className="auth-rules" aria-live="polite">
                  {ruleState.map(r => (
                    <div key={r.key} className={`auth-rule ${r.ok ? 'ok' : ''}`}>
                      <span className="auth-rule-dot">✓</span>
                      {r.label}
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="rp-confirm">Confirmă parola</label>
                  <div className="auth-pw-field">
                    <input
                      id="rp-confirm"
                      className="form-input"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Reintrodu parola"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                    />
                    <button type="button" className="auth-pw-toggle" onClick={() => setShowConfirm(s => !s)}
                      aria-label={showConfirm ? 'Ascunde parola' : 'Arată parola'}>
                      <EyeIcon off={showConfirm} />
                    </button>
                  </div>
                  {confirm.length > 0 && !matches && (
                    <span className="form-error">Parolele nu se potrivesc</span>
                  )}
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: '0.5rem' }}>{error}</div>}

                <button className="btn btn-primary btn-block btn-lg" type="submit"
                  disabled={loading || !allRulesOk || !matches}>
                  {loading ? 'Se salvează...' : 'Salvează parola nouă'}
                </button>
              </form>

              <p className="auth-footer-text">
                Ți-ai amintit parola? <span className="auth-inline-link" onClick={() => navigate('/login')}>Autentifică-te</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
