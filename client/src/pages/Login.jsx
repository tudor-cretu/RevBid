import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth }   from '../context/AuthContext';
import { API_URL }   from '../config';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleGoogle = () => { window.location.href = `${API_URL}/api/auth/google`; };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsVerify) { navigate('/verify-email', { state: { email: form.email } }); return; }
        setError(data.message); return;
      }
      login(data.user, data.token);
      navigate('/dashboard');
    } catch { setError('Eroare de conexiune la server'); } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-brand-logo">
            <span style={{ color: '#fff' }}>Rev</span><span style={{ color: 'var(--bid-teal)' }}>Bid</span>
          </div>
          <h1 className="auth-brand-title">Marketplace de licitatii inverse</h1>
          <p className="auth-brand-desc">Posteaza cererea ta si lasa furnizorii sa concureze pentru cel mai bun pret. Economisesti timp si bani.</p>
          <div className="auth-brand-features">
            <div className="auth-brand-feature">
              <span className="auth-feature-icon">📉</span>
              <span>Preturile scad, nu cresc</span>
            </div>
            <div className="auth-brand-feature">
              <span className="auth-feature-icon">🏆</span>
              <span>Furnizori verificati</span>
            </div>
            <div className="auth-brand-feature">
              <span className="auth-feature-icon">⚡</span>
              <span>Oferte in timp real</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <h2 className="auth-title">Autentificare</h2>
          <p className="auth-subtitle">Bine ai revenit! Conecteaza-te la contul tau.</p>

          <button className="auth-google-btn" onClick={handleGoogle}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="18" />
            Continua cu Google
          </button>

          <div className="auth-divider"><span>sau cu email</span></div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" name="email" placeholder="exemplu@email.com" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Parola</label>
              <input className="form-input" type="password" name="password" placeholder="Introdu parola" value={form.password} onChange={handleChange} required />
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: '0.5rem' }}>{error}</div>}

            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
              {loading ? 'Se incarca...' : 'Autentificare'}
            </button>
          </form>

          <p className="auth-footer-text">
            Nu ai cont?{' '}<Link to="/register">Inregistreaza-te</Link>
          </p>
        </div>
      </div>

      <style>{authCSS}</style>
    </div>
  );
}

const authCSS = `
.auth-page { display: flex; min-height: 100vh; }
.auth-brand {
  flex: 1; background: linear-gradient(135deg, var(--primary-navy) 0%, var(--deep-blue) 100%);
  display: flex; align-items: center; justify-content: center; padding: 3rem;
  position: relative; overflow: hidden;
}
.auth-brand::before {
  content: ''; position: absolute; top: -50%; right: -50%;
  width: 100%; height: 100%; background: radial-gradient(circle, rgba(0,169,157,0.12) 0%, transparent 70%);
  border-radius: 50%;
}
.auth-brand::after {
  content: ''; position: absolute; bottom: -30%; left: -30%;
  width: 80%; height: 80%; background: radial-gradient(circle, rgba(8,113,196,0.1) 0%, transparent 70%);
  border-radius: 50%;
}
.auth-brand-content { position: relative; z-index: 1; max-width: 420px; }
.auth-brand-logo { font-size: 2.5rem; font-weight: 800; margin-bottom: 1.5rem; }
.auth-brand-title { color: #fff; font-size: 1.75rem; margin-bottom: 1rem; line-height: 1.3; }
.auth-brand-desc { color: rgba(255,255,255,0.7); font-size: 1rem; line-height: 1.6; margin-bottom: 2rem; }
.auth-brand-features { display: flex; flex-direction: column; gap: 12px; }
.auth-brand-feature { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,0.85); font-size: 0.9375rem; font-weight: 500; }
.auth-feature-icon { font-size: 1.25rem; }

.auth-form-side {
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 2rem; background: var(--bg-page);
}
.auth-card { width: 100%; max-width: 420px; }
.auth-title { font-size: 1.5rem; font-weight: 700; color: var(--text-heading); margin-bottom: 6px; }
.auth-subtitle { font-size: 0.9375rem; color: var(--text-muted); margin-bottom: 1.75rem; }

.auth-google-btn {
  width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--bg-card); cursor: pointer; font-size: 0.875rem; font-weight: 500;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  font-family: var(--font-sans); transition: all var(--transition-fast); color: var(--text-body);
}
.auth-google-btn:hover { border-color: var(--action-blue); box-shadow: var(--shadow-sm); }

.auth-divider {
  position: relative; text-align: center; margin: 1.5rem 0; border-top: 1px solid var(--border);
}
.auth-divider span {
  position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
  background: var(--bg-page); padding: 0 14px; font-size: 0.75rem; color: var(--text-muted);
}

.auth-form { display: flex; flex-direction: column; gap: 4px; }
.auth-footer-text { margin-top: 1.5rem; font-size: 0.875rem; text-align: center; color: var(--text-muted); }

@media (max-width: 900px) {
  .auth-page { flex-direction: column; }
  .auth-brand { padding: 2rem; min-height: auto; }
  .auth-brand-content { max-width: 100%; }
  .auth-brand-title { font-size: 1.375rem; }
  .auth-brand-features { flex-direction: row; flex-wrap: wrap; gap: 8px; }
  .auth-brand-feature { font-size: 0.8125rem; }
  .auth-form-side { padding: 1.5rem; }
}
`;