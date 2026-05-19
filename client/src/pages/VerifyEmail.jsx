import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

export default function VerifyEmail() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  const handleVerify = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code }) });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      login(data.user, data.token); navigate('/dashboard');
    } catch { setError('Eroare de conexiune'); } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setError('');
    const res = await fetch(`${API_URL}/api/auth/resend-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    if (res.ok) setResent(true);
  };

  return (
    <div className="page-center" style={{ background: 'var(--bg-page)' }}>
      <div className="card" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '2.5rem' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--soft-aqua)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '28px' }}>
          📧
        </div>
        <h1 style={{ fontSize: '1.375rem', marginBottom: '8px' }}>Verifica emailul</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', marginBottom: '1.75rem', lineHeight: '1.6' }}>
          Am trimis un cod de 6 cifre la<br /><strong style={{ color: 'var(--text-heading)' }}>{email}</strong>
        </p>

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <input
            className="form-input"
            type="text" maxLength={6} placeholder="000000" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            required
            style={{ width: '200px', padding: '14px', fontSize: '1.75rem', fontWeight: 700, letterSpacing: '12px', textAlign: 'center', borderWidth: '2px' }}
          />
          {error && <div className="alert alert-error" style={{ width: '100%' }}>{error}</div>}
          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading || code.length !== 6}>
            {loading ? 'Se verifica...' : 'Verifica codul'}
          </button>
        </form>

        <div style={{ marginTop: '1.25rem' }}>
          {resent ? (
            <p style={{ color: 'var(--success-green)', fontSize: '0.8125rem', fontWeight: 500 }}>✓ Cod nou trimis!</p>
          ) : (
            <button className="btn btn-ghost" onClick={handleResend} style={{ color: 'var(--action-blue)' }}>
              Nu ai primit codul? Retrimite
            </button>
          )}
        </div>
      </div>
    </div>
  );
}