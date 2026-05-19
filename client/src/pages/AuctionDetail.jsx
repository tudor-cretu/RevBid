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

  // Fetch date initiale
  useEffect(() => {
    fetchAuction();
    fetchSubscription();
    fetchBids();
    connectSocket();
    return () => socketRef.current?.disconnect();
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (!auction?.deadline) return;
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      const diff = new Date(auction.deadline) - Date.now();
      if (diff <= 0) {
        setSegments([]);
        setExpired(true);
        return;
      }
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
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [auction?.deadline]);

  const fetchAuction = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/auctions/${id}`);
      const data = await res.json();
      setAuction(data);
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/bids/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setBids(Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchSubscription = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/subscriptions/check/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSubscribed(data.subscribed);
    } catch {}
  };

  const toggleSubscription = async () => {
    setSubLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/subscriptions/${id}`, {
        method:  subscribed ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSubscribed(data.subscribed);
    } finally {
      setSubLoading(false);
    }
  };

  const connectSocket = () => {
    const s = io(API_URL, { auth: { token } });

    s.on('connect', () => {
      s.emit('join_auction', id);
      setStatus('conectat');
    });

    s.on('new_bid', ({ bid, currentPrice }) => {
      setBids(prev => [...prev, bid]);
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

    socketRef.current.emit('place_bid',
      { auctionId: id, amount: parseFloat(amount), message },
      (res) => {
        if (res.error) setError(res.error);
        else { setAmount(''); setMessage(''); }
      }
    );
  };

  if (loading) return <p style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>Se incarca...</p>;
  if (!auction) return <p style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>Licitatia nu exista.</p>;

  const isActive   = auction.status === 'active';
  const isSupplier = user?.role === 'supplier';
  const isBuyer    = auction.buyer?._id === user?.id || auction.buyer === user?.id;

  return (
    <div style={styles.page}>

      {/* Header */}
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>← Inapoi</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {auction.buyer?._id !== user?.id && auction.buyer !== user?.id && (
            <button
              style={{
                ...styles.backBtn,
                color:       subscribed ? '#e53e3e' : '#38a169',
                borderColor: subscribed ? '#FED7D7' : '#C6F6D5',
                background:  subscribed ? '#FFF5F5' : '#F0FFF4',
              }}
              onClick={toggleSubscription}
              disabled={subLoading}
            >
              {subLoading ? '...' : subscribed ? '🔕 Dezaboneaza-te' : '🔔 Aboneaza-te'}
            </button>
          )}
          <span style={{ ...styles.statusBadge, background: statusColor(auction.status) }}>
            {auction.status}
          </span>
        </div>
      </div>

      <div style={styles.layout}>

        {/* Coloana stanga */}
        <div style={styles.left}>

          {/* Imagini */}
          {auction.images?.length > 0 && (
            <div style={styles.images}>
              {auction.images.map((img, i) => (
                <img key={i} src={img.url} alt="" style={i === 0 ? styles.mainImg : styles.thumbImg} />
              ))}
            </div>
          )}

          {/* Info licitatie */}
          <div style={styles.card}>
            <div style={styles.categoryRow}>
              <span style={styles.category}>{auction.category}</span>
              {auction.tags?.map(t => (
                <span key={t} style={styles.tag}>{t}</span>
              ))}
            </div>
            <h1 style={styles.title}>{auction.title}</h1>
            <p style={styles.description}>{auction.description}</p>

            {auction.location?.lat && (
              <div style={{ marginBottom: '12px' }}>
                <p style={styles.location}>📍 {auction.location.address}</p>
                <div style={{ marginTop: '8px' }}>
                  <MapView location={auction.location} />
                </div>
              </div>
            )}

            <div style={styles.priceBox}>
              <div>
                <p style={styles.priceLabel}>Pret curent</p>
                <p style={styles.currentPrice}>{auction.currentPrice} RON</p>
              </div>
              {auction.targetPrice && (
                <div style={{ textAlign: 'right' }}>
                  <p style={styles.priceLabel}>Pret tinta</p>
                  <p style={styles.targetPrice}>{auction.targetPrice} RON</p>
                </div>
              )}
            </div>

            {auction.deadline && (
              <div style={{ marginBottom: '10px' }}>
                <p style={styles.deadline}>
                  ⏰ Deadline: {new Date(auction.deadline).toLocaleString('ro-RO')}
                </p>
                {expired ? (
                  <p style={{ fontSize: '13px', color: '#e53e3e', fontWeight: '600', marginTop: '6px' }}>
                    Licitatie expirata
                  </p>
                ) : segments.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', marginTop: '8px' }}>
                    {segments.map(([lbl, val], i) => (
                      <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={styles.timerSeg}>
                          <span style={styles.timerVal}>{val}</span>
                          <span style={styles.timerLbl}>{lbl}</span>
                        </div>
                        {i < segments.length - 1 && (
                          <span style={styles.timerSep}>:</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p style={styles.buyer}>
              Postat de:{' '}
              <span
                style={{ fontWeight: '600', cursor: 'pointer', textDecoration: 'underline', color: '#3182ce' }}
                onClick={() => navigate(`/profile/${auction.buyer?._id}`)}
              >
                {auction.buyer?.firstName} {auction.buyer?.lastName}
              </span>
              {auction.buyer?.companyName && ` · ${auction.buyer.companyName}`}
            </p>
          </div>

          {/* Grafic */}
          <PriceChart
            auctionId={id}
            startPrice={auction.startPrice}
            currentPrice={auction.currentPrice}
          />

          {/* Chatbox */}
          <AuctionChatBox auctionId={id} socket={socketRef.current} />
        </div>

        {/* Coloana dreapta */}
        <div style={styles.right}>

          {/* Form ofertare */}
          {isActive && isSupplier && !isBuyer && (
            <div style={styles.card}>
              <h3 style={styles.sectionTitle}>Depune oferta</h3>
              <p style={styles.hint}>
                Oferta ta trebuie sa fie sub <strong>{auction.currentPrice} RON</strong>
              </p>

              <input
                style={styles.input} type="number"
                placeholder={`Sub ${auction.currentPrice} RON`}
                value={amount} onChange={e => setAmount(e.target.value)}
              />
              <textarea
                style={{ ...styles.input, height: '70px', resize: 'none', marginTop: '8px' }}
                placeholder="Mesaj optional pentru cumparator..."
                value={message} onChange={e => setMessage(e.target.value)}
              />

              {error && <p style={styles.error}>{error}</p>}

              <button style={styles.bidBtn} onClick={placeBid}>
                Depune oferta
              </button>
            </div>
          )}

          {!isActive && (
            <div style={{ ...styles.card, textAlign: 'center', background: '#f7f8fa' }}>
              <p style={{ fontSize: '32px', margin: '0' }}>🔒</p>
              <p style={{ fontWeight: '600', color: '#1a1a1a' }}>Licitatie inchisa</p>
              <p style={{ fontSize: '13px', color: '#718096' }}>
                Pret final: <strong>{auction.currentPrice} RON</strong>
              </p>
            </div>
          )}

          {/* Lista oferte */}
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>
              Oferte ({bids.length})
              <span style={{ fontSize: '11px', color: status === 'conectat' ? '#38a169' : '#718096', marginLeft: '8px' }}>
                ● {status}
              </span>
            </h3>

            {bids.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#a0aec0', textAlign: 'center', padding: '1rem' }}>
                Fii primul care oferteza!
              </p>
            ) : (
              [...bids]
                .sort((a, b) => a.amount - b.amount)
                .map((bid, i) => (
                  <div key={bid._id || i} style={{
                    ...styles.bidRow,
                    background: i === 0 ? '#F0FFF4' : '#fff',
                    borderLeft: i === 0 ? '3px solid #38a169' : '3px solid transparent',
                  }}>
                    <div>
                      <p style={styles.bidName}>
                        {i === 0 && '🏆 '}
                        <span
                          style={{ cursor: 'pointer', textDecoration: 'underline', color: '#3182ce' }}
                          onClick={() => navigate(`/profile/${bid.supplier?._id}`)}
                        >
                          {bid.supplier?.firstName} {bid.supplier?.lastName}
                        </span>
                      </p>
                      {bid.message && <p style={styles.bidMsg}>{bid.message}</p>}
                    </div>
                    <p style={{ ...styles.bidAmount, color: i === 0 ? '#38a169' : '#e53e3e' }}>
                      {bid.amount} RON
                    </p>
                  </div>
                ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

const statusColor = s => ({ active: '#38a169', closed: '#718096', cancelled: '#e53e3e', draft: '#d69e2e' }[s] || '#718096');

const styles = {
  page:         { maxWidth: '1100px', margin: '0 auto', padding: '2rem' },
  topBar:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  backBtn:      { background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: '#718096' },
  statusBadge:  { fontSize: '12px', color: '#fff', padding: '4px 12px', borderRadius: '20px' },
  layout:       { display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' },
  left:         { display: 'flex', flexDirection: 'column', gap: '16px' },
  right:        { display: 'flex', flexDirection: 'column', gap: '16px' },
  images:       { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  mainImg:      { width: '100%', maxHeight: '300px', objectFit: 'cover', borderRadius: '10px' },
  thumbImg:     { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' },
  card:         { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' },
  categoryRow:  { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' },
  category:     { fontSize: '11px', background: '#EBF8FF', color: '#2B6CB0', padding: '2px 8px', borderRadius: '20px' },
  tag:          { fontSize: '11px', background: '#F7FAFC', color: '#718096', padding: '2px 8px', borderRadius: '20px', border: '1px solid #e2e8f0' },
  title:        { fontSize: '20px', fontWeight: '700', margin: '0 0 8px', color: '#1a1a1a' },
  description:  { fontSize: '14px', color: '#4a5568', lineHeight: '1.6', marginBottom: '12px' },
  location:     { fontSize: '13px', color: '#718096', marginBottom: '12px' },
  priceBox:     { display: 'flex', justifyContent: 'space-between', background: '#F7FAFC', borderRadius: '8px', padding: '12px 16px', marginBottom: '10px' },
  priceLabel:   { fontSize: '11px', color: '#718096', margin: '0' },
  currentPrice: { fontSize: '24px', fontWeight: '700', color: '#e53e3e', margin: '0' },
  targetPrice:  { fontSize: '20px', fontWeight: '600', color: '#718096', margin: '0' },
  deadline:     { fontSize: '13px', color: '#d69e2e', marginBottom: '4px', textAlign: 'center' },
  timerSeg:     { display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#F7FAFC', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', minWidth: '48px' },
  timerVal:     { fontSize: '20px', fontWeight: '600', color: '#1a1a1a', lineHeight: '1' },
  timerLbl:     { fontSize: '10px', color: '#718096', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' },
  timerSep:     { fontSize: '18px', color: '#718096', fontWeight: '600', marginBottom: '14px' },
  buyer:        { fontSize: '13px', color: '#718096' },
  sectionTitle: { fontSize: '15px', fontWeight: '600', color: '#1a1a1a', marginBottom: '12px', marginTop: '0' },
  hint:         { fontSize: '13px', color: '#718096', marginBottom: '10px' },
  input:        { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' },
  error:        { color: '#e53e3e', fontSize: '13px', marginTop: '6px' },
  bidBtn:       { width: '100%', padding: '10px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '10px' },
  bidRow:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '8px', marginBottom: '6px' },
  bidName:      { fontSize: '13px', fontWeight: '600', color: '#1a1a1a', margin: '0' },
  bidMsg:       { fontSize: '12px', color: '#718096', margin: '2px 0 0' },
  bidAmount:    { fontSize: '16px', fontWeight: '700', margin: '0', whiteSpace: 'nowrap' },
};