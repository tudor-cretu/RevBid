import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

export default function AuthCallback() {
  const [params]   = useSearchParams();
  const { login }  = useAuth();
  const navigate   = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const error = params.get('error');
    if (error || !token) { navigate('/login?error=google'); return; }
    fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(user => { login(user, token); navigate('/dashboard'); })
      .catch(() => navigate('/login'));
  }, []);

  return (
    <div className="page-center" style={{ background: 'var(--bg-page)' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div className="spinner" style={{ width: '40px', height: '40px' }} />
        <p style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Se autentifica cu Google...</p>
      </div>
    </div>
  );
}