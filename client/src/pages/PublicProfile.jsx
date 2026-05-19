import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

export default function PublicProfile() {
  const { id }          = useParams();
  const { user, token } = useAuth();
  const navigate        = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id === user?.id) { navigate('/settings'); return; }
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    try {
      const [profRes, statsRes, auctRes] = await Promise.all([
        fetch(`${API_URL}/api/auth/profile/${id}`),
        fetch(`${API_URL}/api/auth/profile/${id}/stats`),
        fetch(`${API_URL}/api/auctions?buyerId=${id}&status=active`),
      ]);
      const [prof, st, auct] = await Promise.all([profRes.json(), statsRes.json(), auctRes.json()]);
      setProfile(prof); setStats(st);
      setAuctions(Array.isArray(auct) ? auct.filter(a => a.buyer?._id === id || a.buyer === id) : []);
    } finally { setLoading(false); }
  };

  const handleMessage = () => { navigate(`/messages?to=${id}&name=${profile.firstName} ${profile.lastName}`); };

  if (loading) return <p className="loading-text">Se incarca...</p>;
  if (!profile) return <div className="empty-state"><div className="empty-state-icon">❌</div><p className="empty-state-title">Profil negasit.</p></div>;

  const joinDate = new Date(profile.createdAt).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });

  return (
    <div className="page">
      <div className="container-sm" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <div className="card">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '3px solid var(--soft-aqua)' }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary-navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, flexShrink: 0, border: '3px solid var(--soft-aqua)' }}>
                {profile.firstName?.[0]}{profile.lastName?.[0]}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px' }}>{profile.firstName} {profile.lastName}</h1>
              {profile.companyName && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>{profile.companyName}</p>}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
                <span className={`badge ${profile.role === 'buyer' ? 'badge-blue' : 'badge-teal'}`}>
                  {profile.role === 'buyer' ? 'Cumparator' : 'Furnizor'}
                </span>
                {profile.city && <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>📍 {profile.city}</span>}
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>📅 Membru din {joinDate}</span>
              </div>
              {profile.rating > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                  {'⭐'.repeat(Math.round(profile.rating))}
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{profile.rating.toFixed(1)} ({profile.reviewCount} recenzii)</span>
                </div>
              )}
            </div>
            {user?.id !== id && (
              <button className="btn btn-primary" onClick={handleMessage}>✉️ Trimite mesaj</button>
            )}
          </div>

          {stats && (
            <div style={{ display: 'flex', borderTop: '1px solid var(--border-light)', paddingTop: '1rem', gap: '1rem' }}>
              {profile.role === 'buyer' ? (
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--bid-teal)' }}>{stats.auctionsCount}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Licitatii create</p>
                </div>
              ) : (<>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--action-blue)' }}>{stats.bidsCount}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Oferte depuse</p>
                </div>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--success-green)' }}>{stats.wonCount}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Licitatii castigate</p>
                </div>
              </>)}
            </div>
          )}
        </div>

        {profile.role === 'buyer' && auctions.length > 0 && (
          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--text-heading)' }}>Licitatii active</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auctions.map(a => (
                <div key={a._id} className="card-hover" onClick={() => navigate(`/auction/${a._id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--border)', transition: 'all var(--transition-fast)' }}>
                  {a.images?.[0] && <img src={a.images[0].url} alt="" style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 500, margin: '0 0 2px', color: 'var(--text-heading)' }}>{a.title}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{a.category} · <span style={{ color: 'var(--bid-teal)', fontWeight: 600 }}>{a.currentPrice} RON</span></p>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>→</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}