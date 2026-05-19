import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate }      from 'react-router-dom';
import { io }                          from 'socket.io-client';
import { useAuth }                     from '../context/AuthContext';
import PriceChart                      from '../components/PriceChart';
import { API_URL }                     from '../config';
import AuctionChatBox                  from '../components/AuctionChatBox';
import MapView                         from '../components/MapView';

export default function AuctionDetail() {
  const { id }          = useParams();
  const { user, token } = useAuth();
  const navigate        = useNavigate();

  const [auction,  setAuction]  = useState(null);
  const [bids,     setBids]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [amount,   setAmount]   = useState('');
  const [message,  setMessage]  = useState('');
  const [error,    setError]    = useState('');
  const [status,   setStatus]   = useState('');
  const socketRef = useRef(null);
  const [subscribed,   setSubscribed]   = useState(false);
  const [subLoading,   setSubLoading]   = useState(false);
  const [segments,     setSegments]     = useState([]);
  const [expired,      setExpired]      = useState(false);
  const [activeImg,    setActiveImg]    = useState(0);

  useEffect(() => {
    fetchAuction(); fetchSubscription(); fetchBids(); connectSocket();
    return () => socketRef.current?.disconnect();
  }, [id]);

  useEffect(() => {
    if (!auction?.deadline) return;
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      const diff = new Date(auction.deadline) - Date.now();
      if (diff <= 0) { setSegments([]); setExpired(true); return; }
      setExpired(false);
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setSegments(d > 0
        ? [['zile', pad(d)], ['ore', pad(h)], ['min', pad(m)], ['sec', pad(s)]]
        : [['ore', pad(h)], ['min', pad(m)], ['sec', pad(s)]]);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [auction?.deadline]);

  const fetchAuction = async () => {
    try { const res = await fetch(`${API_URL}/api/auctions/${id}`); setAuction(await res.json()); }
    finally { setLoading(false); }
  };
  const fetchBids = async () => {
    try { const res = await fetch(`${API_URL}/api/bids/${id}`, { headers: { Authorization: `Bearer ${token}` } }); const d = await res.json(); setBids(Array.isArray(d) ? d : []); } catch {}
  };
  const fetchSubscription = async () => {
    try { const res = await fetch(`${API_URL}/api/subscriptions/check/${id}`, { headers: { Authorization: `Bearer ${token}` } }); const d = await res.json(); setSubscribed(d.subscribed); } catch {}
  };
  const toggleSubscription = async () => {
    setSubLoading(true);
    try { const res = await fetch(`${API_URL}/api/subscriptions/${id}`, { method: subscribed ? 'DELETE' : 'POST', headers: { Authorization: `Bearer ${token}` } }); const d = await res.json(); setSubscribed(d.subscribed); }
    finally { setSubLoading(false); }
  };
  const [socketReady, setSocketReady] = useState(false);

  const connectSocket = () => {
    const s = io(API_URL, { auth: { token } });
    s.on('connect', () => {
      s.emit('join_auction', id);
      setStatus('conectat');
      setSocketReady(true);
    });
    s.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
      setStatus('deconectat');
    });
    s.on('disconnect', () => setStatus('deconectat'));
    s.on('new_bid', ({ bid, currentPrice }) => {
      setBids(prev => {
        // Deduplicate
        if (bid._id && prev.some(b => b._id === bid._id)) return prev;
        return [...prev, bid];
      });
      setAuction(prev => prev ? { ...prev, currentPrice } : prev);
    });
    s.on('auction_closed', () => {
      setAuction(prev => prev ? { ...prev, status: 'closed' } : prev);
    });
    s.on('deadline_extended', ({ newDeadline }) => {
      setAuction(prev => prev ? { ...prev, deadline: newDeadline } : prev);
    });
    socketRef.current = s;
  };

  const placeBid = () => {
    if (!socketRef.current || !amount) return;
    setError('');
    socketRef.current.emit(
      'place_bid',
      { auctionId: id, amount: parseFloat(amount), message },
      (res) => {
        if (res.error) {
          setError(res.error);
        } else {
          setAmount('');
          setMessage('');
          // Supplier-ul s-a abonat automat — reflecta in UI
          setSubscribed(true);
        }
      }
    );
  };

  if (loading) return <p className="loading-text">Se incarca...</p>;
  if (!auction) return <div className="empty-state"><div className="empty-state-icon">❌</div><p className="empty-state-title">Licitatia nu exista.</p></div>;

  const isActive   = auction.status === 'active';
  const isSupplier = user?.role === 'supplier';
  const isBuyer    = auction.buyer?._id === user?.id || auction.buyer === user?.id;

  const statusCls = { active: 'badge-solid-teal', closed: 'badge-solid-gray', cancelled: 'badge-solid-red', draft: 'badge-solid-amber' }[auction.status] || 'badge-solid-gray';

  return (
    <div className="page">
      <div className="container">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>← Inapoi</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className={`btn btn-sm ${subscribed ? 'btn-danger' : 'btn-outline'}`}
              onClick={toggleSubscription}
              disabled={subLoading}
              title={subscribed ? 'Dezaboneaza-te de la notificari' : 'Aboneaza-te pentru notificari'}
              style={!subscribed ? { borderColor: 'var(--bid-teal)', color: 'var(--bid-teal)' } : {}}
            >
              {subLoading ? '...' : subscribed ? '🔕 Dezaboneaza-te' : '🔔 Aboneaza-te'}
            </button>
            <span className={`badge ${statusCls}`} style={{ fontSize: '0.75rem', padding: '5px 14px' }}>{auction.status}</span>
          </div>
        </div>

        <div className="ad-layout">
          {/* Left */}
          <div className="ad-left">
            {/* ── Galerie imagini ── */}
            {auction.images?.length > 0 ? (
              <div className="ad-gallery">
                {/* Imagine principală */}
                <div className="ad-gallery-main">
                  <img
                    key={activeImg}
                    src={auction.images[activeImg]?.url}
                    alt={auction.title}
                    className="ad-gallery-main-img"
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                  <div className="ad-gallery-placeholder" style={{ display: 'none' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--muted-gray)" strokeWidth="1.2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                    </svg>
                    <span>Imagine indisponibilă</span>
                  </div>
                  {auction.images.length > 1 && (
                    <span className="ad-gallery-counter">{activeImg + 1} / {auction.images.length}</span>
                  )}
                </div>

                {/* Thumbnails — doar dacă sunt cel puțin 2 imagini */}
                {auction.images.length > 1 && (
                  <div className="ad-gallery-thumbs">
                    {auction.images.map((img, i) => (
                      <button
                        key={i}
                        className={`ad-gallery-thumb ${i === activeImg ? 'active' : ''}`}
                        onClick={() => setActiveImg(i)}
                        aria-label={`Imaginea ${i + 1}`}
                        title={`Imaginea ${i + 1}`}
                      >
                        <img
                          src={img.url}
                          alt={`${auction.title} — ${i + 1}`}
                          className="ad-gallery-thumb-img"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Placeholder când nu există imagini */
              <div className="ad-gallery-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted-gray)" strokeWidth="1.2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                </svg>
                <span>Fără imagini</span>
              </div>
            )}

            <div className="card">
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span className="badge badge-blue">{auction.category}</span>
                {auction.tags?.map(t => <span key={t} className="badge badge-gray">{t}</span>)}
              </div>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-heading)' }}>{auction.title}</h1>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-body)', lineHeight: 1.6, marginBottom: '1rem' }}>{auction.description}</p>

              {auction.location?.lat && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '8px' }}>📍 {auction.location.address}</p>
                  <MapView location={auction.location} />
                </div>
              )}

              {/* Price box */}
              <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--ice-blue)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: '12px', alignItems: 'flex-end' }}>
                <div>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>Pret curent</p>
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--bid-teal)', margin: 0 }}>{auction.currentPrice} RON</p>
                </div>
                {auction.targetPrice && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>Pret tinta</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>{auction.targetPrice} RON</p>
                  </div>
                )}
              </div>

              {/* Timer */}
              {auction.deadline && (
                <div style={{ marginBottom: '12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--warning-amber)', marginBottom: '6px', fontWeight: 500 }}>
                    ⏰ Deadline: {new Date(auction.deadline).toLocaleString('ro-RO')}
                  </p>
                  {expired ? (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--error-red)', fontWeight: 600 }}>Licitatie expirata</p>
                  ) : segments.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', marginTop: '8px' }}>
                      {segments.map(([lbl, val], i) => (
                        <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--ice-blue)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', minWidth: '52px' }}>
                            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-heading)', lineHeight: 1 }}>{val}</span>
                            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{lbl}</span>
                          </div>
                          {i < segments.length - 1 && <span style={{ fontSize: '1.125rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '14px' }}>:</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Postat de:{' '}
                <span style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--action-blue)' }} onClick={() => navigate(`/profile/${auction.buyer?._id}`)}>
                  {auction.buyer?.firstName} {auction.buyer?.lastName}
                </span>
                {auction.buyer?.companyName && ` · ${auction.buyer.companyName}`}
              </p>
            </div>

            <PriceChart auctionId={id} startPrice={auction.startPrice} currentPrice={auction.currentPrice} />
            <AuctionChatBox auctionId={id} socket={socketRef.current} />
          </div>

          {/* Right */}
          <div className="ad-right">
            {isActive && isSupplier && !isBuyer && (
              <div className="card">
                <h3 className="card-title" style={{ marginBottom: '8px' }}>📝 Depune oferta</h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Oferta ta trebuie sa fie sub <strong style={{ color: 'var(--bid-teal)' }}>{auction.currentPrice} RON</strong>
                </p>
                <input className="form-input" type="number" placeholder={`Sub ${auction.currentPrice} RON`} value={amount} onChange={e => setAmount(e.target.value)} style={{ marginBottom: '8px' }} />
                <textarea className="form-input" placeholder="Mesaj optional pentru cumparator..." value={message} onChange={e => setMessage(e.target.value)} style={{ height: '70px', resize: 'none', marginBottom: '8px' }} />
                {error && <div className="alert alert-error" style={{ marginBottom: '8px' }}>{error}</div>}
                <button className="btn btn-primary btn-block" onClick={placeBid}>Depune oferta</button>
              </div>
            )}

            {!isActive && (
              <div className="card" style={{ textAlign: 'center', background: 'var(--ice-blue)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔒</div>
                <p style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: '4px' }}>Licitatie inchisa</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Pret final: <strong style={{ color: 'var(--bid-teal)' }}>{auction.currentPrice} RON</strong>
                </p>
              </div>
            )}

            {/* Bids */}
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: '12px' }}>
                Oferte ({bids.length})
                <span style={{ fontSize: '0.6875rem', color: status === 'conectat' ? 'var(--success-green)' : 'var(--text-muted)', marginLeft: '8px', fontWeight: 500 }}>
                  ● {status}
                </span>
              </h3>
              {bids.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <div className="empty-state-icon">💰</div>
                  <p className="empty-state-text">Fii primul care oferteza!</p>
                </div>
              ) : (
                [...bids].sort((a, b) => a.amount - b.amount).map((bid, i) => (
                  <div key={bid._id || i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '10px 12px', borderRadius: 'var(--radius-md)', marginBottom: '6px',
                    background: i === 0 ? '#ECFDF5' : 'var(--bg-card)',
                    borderLeft: `3px solid ${i === 0 ? 'var(--success-green)' : 'transparent'}`,
                    transition: 'background var(--transition-fast)',
                  }}>
                    <div>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>
                        {i === 0 && '🏆 '}
                        <span style={{ cursor: 'pointer', color: 'var(--action-blue)' }} onClick={() => navigate(`/profile/${bid.supplier?._id}`)}>
                          {bid.supplier?.firstName} {bid.supplier?.lastName}
                        </span>
                      </p>
                      {bid.message && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>{bid.message}</p>}
                    </div>
                    <p style={{ fontSize: '1rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', color: i === 0 ? 'var(--success-green)' : 'var(--bid-teal)' }}>
                      {bid.amount} RON
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Layout pagină ── */
        .ad-layout { display: grid; grid-template-columns: 1fr 360px; gap: 1.25rem; align-items: start; }
        .ad-left   { display: flex; flex-direction: column; gap: 1.25rem; }
        .ad-right  { display: flex; flex-direction: column; gap: 1.25rem; }
        @media (max-width: 900px) { .ad-layout { grid-template-columns: 1fr; } }

        /* ── Galerie ── */
        .ad-gallery { display: flex; flex-direction: column; gap: 10px; }

        /* Container imagine principală — aspect ratio 4:3 */
        .ad-gallery-main {
          position: relative; width: 100%; aspect-ratio: 4 / 3;
          background: var(--ice-blue);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .ad-gallery-main-img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
          animation: fadeIn .25s ease;
        }

        /* Placeholder în imagine principală (onError) */
        .ad-gallery-placeholder {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 10px; color: var(--muted-gray);
          font-size: 0.8125rem;
        }

        /* Counter "1 / 3" */
        .ad-gallery-counter {
          position: absolute; bottom: 10px; right: 12px;
          background: rgba(3,54,103,0.55);
          color: white; font-size: 0.6875rem; font-weight: 600;
          padding: 3px 9px; border-radius: var(--radius-full);
          letter-spacing: 0.04em; backdrop-filter: blur(4px);
        }

        /* Rând thumbnails */
        .ad-gallery-thumbs {
          display: flex; gap: 8px;
          overflow-x: auto; padding-bottom: 4px;
          scrollbar-width: thin; scrollbar-color: var(--border) transparent;
        }
        .ad-gallery-thumbs::-webkit-scrollbar { height: 4px; }
        .ad-gallery-thumbs::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        /* Fiecare thumbnail — buton */
        .ad-gallery-thumb {
          flex-shrink: 0;
          width: 80px; height: 80px;
          border-radius: var(--radius-md);
          overflow: hidden;
          border: 2px solid #DCE8EC;
          cursor: pointer; padding: 0;
          background: var(--ice-blue);
          transition: border-color var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast);
        }
        .ad-gallery-thumb:hover {
          border-color: var(--bid-teal);
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0,169,157,0.18);
        }
        .ad-gallery-thumb.active {
          border-color: var(--bid-teal);
          box-shadow: 0 0 0 3px rgba(0,169,157,0.18);
        }
        .ad-gallery-thumb-img {
          width: 100%; height: 100%;
          object-fit: cover; display: block;
        }

        /* Placeholder galerie goală */
        .ad-gallery-empty {
          width: 100%; aspect-ratio: 4 / 3;
          background: var(--ice-blue);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 10px; color: var(--muted-gray);
          font-size: 0.8125rem;
        }

        /* Mobile */
        @media (max-width: 600px) {
          .ad-gallery-thumb { width: 64px; height: 64px; }
        }
      `}</style>
    </div>
  );
}