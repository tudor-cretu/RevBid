import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'buyer', companyName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      navigate('/verify-email', { state: { email: form.email } });
    } catch { setError('Eroare de conexiune la server'); } finally { setLoading(false); }
  };

  const handleGoogle = () => { window.location.href = `${API_URL}/api/auth/google`; };

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-brand-content">
          <div className="auth-brand-logo">
            <span style={{ color: '#fff' }}>Rev</span><span style={{ color: 'var(--bid-teal)' }}>Bid</span>
          </div>
          <h1 className="auth-brand-title">Incepe sa economisesti astazi</h1>
          <p className="auth-brand-desc">Creeaza un cont gratuit si acceseaza piata de licitatii inverse. Fie ca esti cumparator sau furnizor, RevBid te ajuta sa obtii cele mai bune oferte.</p>
          <div className="auth-brand-features">
            <div className="auth-brand-feature"><span className="auth-feature-icon">🆓</span><span>Cont gratuit</span></div>
            <div className="auth-brand-feature"><span className="auth-feature-icon">🔒</span><span>Date securizate</span></div>
            <div className="auth-brand-feature"><span className="auth-feature-icon">🚀</span><span>Activ in 2 minute</span></div>
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <h2 className="auth-title">Creeare cont</h2>
          <p className="auth-subtitle">Completeaza datele pentru a incepe.</p>

          <button className="auth-google-btn" onClick={handleGoogle}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="18" />
            Continua cu Google
          </button>

          <div className="auth-divider"><span>sau cu email</span></div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Prenume</label>
                <input className="form-input" name="firstName" placeholder="Ion" value={form.firstName} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Nume</label>
                <input className="form-input" name="lastName" placeholder="Popescu" value={form.lastName} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" name="email" placeholder="exemplu@email.com" value={form.email} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Parola</label>
              <input className="form-input" type="password" name="password" placeholder="Minim 6 caractere" value={form.password} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Tip cont</label>
              <div className="role-selector">
                <button type="button" className={`role-option ${form.role === 'buyer' ? 'active' : ''}`} onClick={() => setForm(prev => ({ ...prev, role: 'buyer' }))}>
                  <span className="role-icon">🛒</span>
                  <span className="role-name">Cumparator</span>
                  <span className="role-desc">Postez licitatii</span>
                </button>
                <button type="button" className={`role-option ${form.role === 'supplier' ? 'active' : ''}`} onClick={() => setForm(prev => ({ ...prev, role: 'supplier' }))}>
                  <span className="role-icon">🏢</span>
                  <span className="role-name">Furnizor</span>
                  <span className="role-desc">Depun oferte</span>
                </button>
              </div>
            </div>

            {form.role === 'supplier' && (
              <div className="form-group">
                <label className="form-label">Nume companie</label>
                <input className="form-input" name="companyName" placeholder="SC Exemplu SRL" value={form.companyName} onChange={handleChange} />
              </div>
            )}

            {error && <div className="alert alert-error">{error}</div>}

            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
              {loading ? 'Se creeaza...' : 'Creeaza cont'}
            </button>
          </form>

          <p className="auth-footer-text">
            Ai deja cont? <Link to="/login">Autentifica-te</Link>
          </p>
        </div>
      </div>

      <style>{regCSS}</style>
    </div>
  );
}

const regCSS = `
.role-selector { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.role-option {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 14px 12px; border: 2px solid var(--border); border-radius: var(--radius-lg);
  background: var(--bg-card); cursor: pointer; transition: all var(--transition-fast);
  font-family: var(--font-sans);
}
.role-option:hover { border-color: var(--action-blue); background: var(--ice-blue); }
.role-option.active { border-color: var(--bid-teal); background: var(--soft-aqua); }
.role-icon { font-size: 1.5rem; }
.role-name { font-size: 0.875rem; font-weight: 600; color: var(--text-heading); }
.role-desc { font-size: 0.75rem; color: var(--text-muted); }
`;