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

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleGoogle = () => {
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        // Daca contul nu e verificat, redirecteaza spre verificare
        if (data.needsVerify) {
          navigate('/verify-email', { state: { email: form.email } });
          return;
        }
        setError(data.message);
        return;
      }

      login(data.user, data.token);
      navigate('/dashboard');
    } catch {
      setError('Eroare de conexiune la server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>RevBid</h1>
        <p style={styles.subtitle}>Autentificare</p>

        {/* Buton Google */}
        <button style={styles.googleBtn} onClick={handleGoogle}>
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google" width="18"
            style={{ marginRight: '8px' }}
          />
          Continua cu Google
        </button>

        <div style={styles.divider}>
          <span style={styles.dividerText}>sau cu email</span>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
          />
          <input
            style={styles.input}
            type="password"
            name="password"
            placeholder="Parola"
            value={form.password}
            onChange={handleChange}
            required
          />

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Se incarca...' : 'Autentificare'}
          </button>
        </form>

        <p style={styles.link}>
          Nu ai cont?{' '}
          <Link to="/register">Inregistreaza-te</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page:        { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' },
  card:        { background: '#fff', padding: '2rem', borderRadius: '8px', width: '100%', maxWidth: '380px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  title:       { fontSize: '24px', fontWeight: '600', marginBottom: '4px' },
  subtitle:    { color: '#666', marginBottom: '1.5rem', fontSize: '14px' },
  googleBtn:   { width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', fontWeight: '500' },
  divider:     { position: 'relative', textAlign: 'center', margin: '16px 0', borderTop: '1px solid #e2e8f0' },
  dividerText: { position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#fff', padding: '0 12px', fontSize: '12px', color: '#a0aec0' },
  form:        { display: 'flex', flexDirection: 'column', gap: '12px' },
  input:       { padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' },
  button:      { padding: '10px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' },
  error:       { color: '#e53e3e', fontSize: '13px' },
  link:        { marginTop: '1rem', fontSize: '13px', textAlign: 'center', color: '#666' },
};