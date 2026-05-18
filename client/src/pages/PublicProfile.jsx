import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

export default function PublicProfile() {
  const { id }          = useParams();
  const { user, token } = useAuth();
  const navigate        = useNavigate();

  const [profile,  setProfile]  = useState(null);
  const [stats,    setStats]    = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    // Daca e propriul profil, redirecteaza la settings
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
      const [prof, st, auct] = await Promise.all([
        profRes.json(), statsRes.json(), auctRes.json()
      ]);
      setProfile(prof);
      setStats(st);
      setAuctions(Array.isArray(auct) ? auct.filter(a => a.buyer?._id === id || a.buyer === id) : []);
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = () => {
    navigate(`/messages?to=${id}&name=${profile.firstName} ${profile.lastName}`);
  };

  if (loading) return <p style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>Se incarca...</p>;
  if (!profile) return <p style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>Profil negasit.</p>;

  const joinDate = new Date(profile.createdAt).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' });

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Header profil */}
        <div style={styles.profileCard}>
          <div style={styles.profileTop}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="" style={styles.avatar} />
            ) : (
              <div style={styles.avatarFallback}>
                {profile.firstName?.[0]}{profile.lastName?.[0]}
              </div>
            )}
            <div style={styles.profileInfo}>
              <h1 style={styles.name}>
                {profile.firstName} {profile.lastName}
              </h1>
              {profile.companyName && (
                <p style={styles.company}>{profile.companyName}</p>
              )}
              <div style={styles.metaRow}>
                <span style={{ ...styles.roleBadge, background: profile.role === 'buyer' ? '#EBF8FF' : '#F0FFF4', color: profile.role === 'buyer' ? '#2B6CB0' : '#276749' }}>
                  {profile.role === 'buyer' ? 'Cumparator' : 'Furnizor'}
                </span>
                {profile.city && (
                  <span style={styles.meta}>📍 {profile.city}</span>
                )}
                <span style={styles.meta}>📅 Membru din {joinDate}</span>
              </div>
              {profile.rating > 0 && (
                <div style={styles.ratingRow}>
                  {'⭐'.repeat(Math.round(profile.rating))}
                  <span style={styles.ratingText}>{profile.rating.toFixed(1)} ({profile.reviewCount} recenzii)</span>
                </div>
              )}
            </div>

            {/* Buton mesaj */}
            {user?.id !== id && (
              <button style={styles.msgBtn} onClick={handleMessage}>
                ✉️ Trimite mesaj
              </button>
            )}
          </div>

          {/* Stats */}
          {stats && (
            <div style={styles.statsRow}>
              {profile.role === 'buyer' ? (
                <StatItem value={stats.auctionsCount} label="Licitatii create" />
              ) : (
                <>
                  <StatItem value={stats.bidsCount}  label="Oferte depuse" />
                  <StatItem value={stats.wonCount}   label="Licitatii castigate" />
                </>
              )}
            </div>
          )}
        </div>

        {/* Licitatii active (doar pentru buyers) */}
        {profile.role === 'buyer' && auctions.length > 0 && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Licitatii active</h2>
            <div style={styles.auctionList}>
              {auctions.map(a => (
                <div key={a._id} style={styles.auctionRow}
                  onClick={() => navigate(`/auction/${a._id}`)}>
                  {a.images?.[0] && (
                    <img src={a.images[0].url} alt="" style={styles.auctionThumb} />
                  )}
                  <div style={styles.auctionInfo}>
                    <p style={styles.auctionTitle}>{a.title}</p>
                    <p style={styles.auctionMeta}>{a.category} · {a.currentPrice} RON</p>
                  </div>
                  <span style={styles.auctionArrow}>→</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ value, label }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <p style={{ fontSize: '24px', fontWeight: '700', margin: '0', color: '#1a1a1a' }}>{value}</p>
      <p style={{ fontSize: '12px', color: '#718096', margin: '4px 0 0' }}>{label}</p>
    </div>
  );
}

const styles = {
  page:          { minHeight: '100vh', background: '#f7f8fa', padding: '2rem' },
  container:     { maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  profileCard:   { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' },
  profileTop:    { display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap' },
  avatar:        { width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  avatarFallback:{ width: '80px', height: '80px', borderRadius: '50%', background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '600', flexShrink: 0 },
  profileInfo:   { flex: 1 },
  name:          { fontSize: '20px', fontWeight: '700', margin: '0 0 4px' },
  company:       { fontSize: '14px', color: '#718096', margin: '0 0 8px' },
  metaRow:       { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' },
  roleBadge:     { fontSize: '12px', padding: '2px 10px', borderRadius: '20px', fontWeight: '500' },
  meta:          { fontSize: '13px', color: '#718096' },
  ratingRow:     { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' },
  ratingText:    { fontSize: '13px', color: '#718096' },
  msgBtn:        { padding: '8px 16px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' },
  statsRow:      { display: 'flex', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', gap: '1rem' },
  card:          { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' },
  sectionTitle:  { fontSize: '16px', fontWeight: '600', margin: '0 0 1rem' },
  auctionList:   { display: 'flex', flexDirection: 'column', gap: '8px' },
  auctionRow:    { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e2e8f0', transition: 'background .15s' },
  auctionThumb:  { width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 },
  auctionInfo:   { flex: 1 },
  auctionTitle:  { fontSize: '14px', fontWeight: '500', margin: '0 0 2px', color: '#1a1a1a' },
  auctionMeta:   { fontSize: '12px', color: '#718096', margin: '0' },
  auctionArrow:  { color: '#a0aec0', fontSize: '16px' },
};