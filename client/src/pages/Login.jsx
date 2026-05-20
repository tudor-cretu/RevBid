import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth }        from '../context/AuthContext';
import { API_URL }        from '../config';
import AuthBrandPanel     from '../components/AuthBrandPanel';
import AuthHelp           from '../components/AuthHelp';
import Logo               from '../components/Logo';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

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
      <AuthBrandPanel mode="login" />

      <div className="auth-form-side">
        <div className="auth-mobile-logo"><Logo size="md" onClick={() => navigate('/')} /></div>

        <div className="auth-card">
          <h2 className="auth-title">Autentificare</h2>
          <p className="auth-subtitle">Bine ai revenit! Conectează-te la contul tău RevBid.</p>

          <button className="auth-google-btn" onClick={handleGoogle}>
            <GoogleIcon />
            Continuă cu Google
          </button>

          <div className="auth-divider"><span>sau cu email</span></div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" name="email" placeholder="exemplu@email.com" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <div className="auth-label-row">
                <label className="form-label" htmlFor="login-password">Parolă</label>
                <button type="button" className="auth-inline-link" onClick={() => navigate('/forgot-password')}>
                  Ai uitat parola?
                </button>
              </div>
              <input id="login-password" className="form-input" type="password" name="password" placeholder="Introdu parola" value={form.password} onChange={handleChange} required />
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: '0.5rem' }}>{error}</div>}

            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
              {loading ? 'Se încarcă...' : 'Autentificare'}
            </button>
          </form>

          <p className="auth-trust-note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Conexiune securizată — datele tale sunt criptate
          </p>

          <p className="auth-footer-text">
            Nu ai cont?{' '}<Link to="/register">Înregistrează-te gratuit</Link>
          </p>

          <AuthHelp />
        </div>
      </div>
    </div>
  );
}
