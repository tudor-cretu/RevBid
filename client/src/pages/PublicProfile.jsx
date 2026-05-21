import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import StarRating from '../components/StarRating';

const fmtDate = d => (d
  ? new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })
  : '');

export default function PublicProfile() {
  const { id }          = useParams();
  const { user, token } = useAuth();
  const navigate        = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [ratingSummary, setRatingSummary] = useState(null);
  const [reviews,       setReviews]       = useState([]);
  const [reviewsPage,   setReviewsPage]   = useState(1);
  const [reviewsPages,  setReviewsPages]  = useState(1);

  useEffect(() => {
    if (id === user?.id) { navigate('/settings'); return; }
    fetchProfile();
  }, [id]);

  useEffect(() => {
    fetch(`${API_URL}/api/users/${id}/rating-summary`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setRatingSummary(d))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    fetch(`${API_URL}/api/users/${id}/reviews?page=${reviewsPage}&limit=5`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) { setReviews(d.reviews); setReviewsPages(d.pages); } })
      .catch(() => {});
  }, [id, reviewsPage]);

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

        {/* ── Recenzii primite ── */}
        <div className="card">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--text-heading)' }}>
            Recenzii primite
          </h2>

          {ratingSummary && ratingSummary.count > 0 ? (
            <>
              <div className="rv-summary">
                <div className="rv-summary-score">
                  <span className="rv-avg">{ratingSummary.average.toFixed(1)}</span>
                  <StarRating value={ratingSummary.average} readOnly size={16} />
                  <span className="rv-count">
                    {ratingSummary.count} {ratingSummary.count === 1 ? 'recenzie' : 'recenzii'}
                  </span>
                </div>
                <div className="rv-dist">
                  {[5, 4, 3, 2, 1].map(star => {
                    const c   = ratingSummary.distribution[star] || 0;
                    const pct = ratingSummary.count ? (c / ratingSummary.count) * 100 : 0;
                    return (
                      <div key={star} className="rv-dist-row">
                        <span className="rv-dist-label">{star}★</span>
                        <div className="rv-dist-track">
                          <div className="rv-dist-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="rv-dist-num">{c}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rv-list">
                {reviews.map(rv => (
                  <div key={rv._id} className="rv-item">
                    <div className="rv-item-top">
                      {rv.reviewerAvatar
                        ? <img src={rv.reviewerAvatar} alt="" className="rv-av" />
                        : <div className="rv-av-fb">{rv.reviewerName?.[0] || '?'}</div>}
                      <div className="rv-item-id">
                        <p className="rv-name">{rv.reviewerName}</p>
                        <p className="rv-meta">
                          {rv.reviewerRole === 'buyer' ? 'Cumpărător' : 'Furnizor'} · {fmtDate(rv.createdAt)}
                        </p>
                      </div>
                      <StarRating value={rv.rating} readOnly size={14} />
                    </div>
                    {rv.comment && <p className="rv-comment">{rv.comment}</p>}
                    {rv.auctionTitle && <p className="rv-ctx">Licitație: {rv.auctionTitle}</p>}
                  </div>
                ))}
              </div>

              {reviewsPages > 1 && (
                <div className="rv-pager">
                  <button className="btn btn-outline btn-sm" disabled={reviewsPage <= 1}
                    onClick={() => setReviewsPage(p => p - 1)}>← Anterioare</button>
                  <span className="rv-pager-info">Pagina {reviewsPage} din {reviewsPages}</span>
                  <button className="btn btn-outline btn-sm" disabled={reviewsPage >= reviewsPages}
                    onClick={() => setReviewsPage(p => p + 1)}>Următoarele →</button>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
              <div className="empty-state-icon">⭐</div>
              <p className="empty-state-text">Nu există încă recenzii.</p>
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
      <style>{reviewsCSS}</style>
    </div>
  );
}

const reviewsCSS = `
.rv-summary {
  display: flex; gap: 20px; flex-wrap: wrap;
  padding-bottom: 14px; border-bottom: 1px solid var(--border-light); margin-bottom: 14px;
}
.rv-summary-score { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 110px; }
.rv-avg { font-size: 2.25rem; font-weight: 800; color: var(--primary-navy); line-height: 1; }
.rv-count { font-size: 0.75rem; color: var(--text-muted); }
.rv-dist { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 4px; justify-content: center; }
.rv-dist-row { display: flex; align-items: center; gap: 8px; }
.rv-dist-label { font-size: 0.6875rem; color: var(--text-muted); width: 22px; }
.rv-dist-track { flex: 1; height: 7px; background: var(--ice-blue); border-radius: 4px; overflow: hidden; }
.rv-dist-fill { height: 100%; background: #F59E0B; border-radius: 4px; }
.rv-dist-num { font-size: 0.6875rem; color: var(--text-muted); width: 20px; text-align: right; }
.rv-list { display: flex; flex-direction: column; gap: 12px; }
.rv-item { padding: 12px; border: 1px solid var(--border-light); border-radius: var(--radius-md); background: var(--bg-card); }
.rv-item-top { display: flex; align-items: center; gap: 10px; }
.rv-av { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.rv-av-fb {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  background: var(--bid-teal); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.875rem;
}
.rv-item-id { flex: 1; min-width: 0; }
.rv-name { font-size: 0.8125rem; font-weight: 600; color: var(--text-heading); margin: 0; }
.rv-meta { font-size: 0.6875rem; color: var(--text-muted); margin: 1px 0 0; }
.rv-comment { font-size: 0.8125rem; color: var(--text-body); line-height: 1.55; margin: 8px 0 0; }
.rv-ctx { font-size: 0.6875rem; color: var(--text-muted); margin: 6px 0 0; font-style: italic; }
.rv-pager { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; }
.rv-pager-info { font-size: 0.75rem; color: var(--text-muted); }
`;