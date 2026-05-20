import { useState } from 'react';
import { useNavigate, Link }     from 'react-router-dom';
import { API_URL, SUPPORT_EMAIL } from '../config';
import AuthBrandPanel            from '../components/AuthBrandPanel';
import Logo                      from '../components/Logo';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'A apărut o eroare. Încearcă din nou.'); return; }
      setSent(true);
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
          {sent ? (
            <div className="auth-state">
              <div className="auth-state-icon ok">📨</div>
              <h2 className="auth-title">Verifică-ți emailul</h2>
              <p className="auth-subtitle" style={{ marginBottom: '1.5rem' }}>
                Dacă există un cont asociat acestui email, vei primi instrucțiuni pentru resetarea parolei.
              </p>
              <button className="btn btn-primary btn-block btn-lg" onClick={() => navigate('/login')}>
                Înapoi la autentificare
              </button>
              <p className="auth-support-line">
                Nu primești emailul? Verifică folderul Spam sau scrie-ne la{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </p>
            </div>
          ) : (
            <>
              <h2 className="auth-title">Recuperează accesul la cont</h2>
              <p className="auth-subtitle">
                Introdu adresa de email asociată contului tău și îți vom trimite instrucțiuni pentru resetarea parolei.
              </p>

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="fp-email">Email</label>
                  <input
                    id="fp-email"
                    className="form-input"
                    type="email"
                    placeholder="exemplu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: '0.5rem' }}>{error}</div>}

                <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading || !email.trim()}>
                  {loading ? 'Se trimite...' : 'Trimite instrucțiuni'}
                </button>
              </form>

              <p className="auth-footer-text">
                <Link to="/login">← Înapoi la autentificare</Link>
              </p>

              <p className="auth-support-line">
                Nu mai ai acces la adresa de email? Contactează echipa RevBid la{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
