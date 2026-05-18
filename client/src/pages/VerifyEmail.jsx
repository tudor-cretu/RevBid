import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

export default function VerifyEmail() {
  const { login }    = useAuth();
  const navigate     = useNavigate();
  const location     = useLocation();
  const email        = location.state?.email || '';

  const [code,    setCode]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [resent,  setResent]  = useState(false);

  const handleVerify = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res  = await fetch(`${API_URL}/api/auth/verify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, code }),
      });
      const data = await res.json();

      if (!res.ok) { setError(data.message); return; }

      login(data.user, data.token);
      navigate('/dashboard');
    } catch {
      setError('Eroare de conexiune');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    const res = await fetch(`${API_URL}/api/auth/resend-code`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    if (res.ok) setResent(true);
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>📧</div>
        <h1 style={styles.title}>Verifica emailul</h1>
        <p style={styles.subtitle}>
          Am trimis un cod de 6 cifre la<br />
          <strong>{email}</strong>
        </p>

        <form onSubmit={handleVerify} style={styles.form}>
          <input
            style={styles.codeInput}
            type="text"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.button} type="submit" disabled={loading || code.length !== 6}>
            {loading ? 'Se verifica...' : 'Verifica codul'}
          </button>
        </form>

        <div style={styles.resendRow}>
          {resent ? (
            <p style={{ color: '#38a169', fontSize: '13px' }}>Cod nou trimis!</p>
          ) : (
            <button style={styles.resendBtn} onClick={handleResend}>
              Nu ai primit codul? Retrimite
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page:      { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' },
  card:      { background: '#fff', padding: '2.5rem', borderRadius: '12px', width: '100%', maxWidth: '380px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' },
  icon:      { fontSize: '48px', marginBottom: '12px' },
  title:     { fontSize: '22px', fontWeight: '700', margin: '0 0 8px' },
  subtitle:  { color: '#718096', fontSize: '14px', marginBottom: '1.5rem', lineHeight: '1.6' },
  form:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' },
  codeInput: { width: '180px', padding: '14px', fontSize: '28px', fontWeight: '700', letterSpacing: '12px', textAlign: 'center', border: '2px solid #e2e8f0', borderRadius: '10px', outline: 'none' },
  button:    { width: '100%', padding: '11px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', cursor: 'pointer', opacity: 1 },
  error:     { color: '#e53e3e', fontSize: '13px' },
  resendRow: { marginTop: '1rem' },
  resendBtn: { background: 'none', border: 'none', color: '#3182ce', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' },
};