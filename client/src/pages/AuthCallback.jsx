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

    if (error || !token) {
      navigate('/login?error=google');
      return;
    }

    // Fetch datele userului cu tokenul primit
    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(user => {
        login(user, token);
        navigate('/dashboard');
      })
      .catch(() => navigate('/login'));
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <p style={{ color: '#718096' }}>Se autentifica cu Google...</p>
    </div>
  );
}