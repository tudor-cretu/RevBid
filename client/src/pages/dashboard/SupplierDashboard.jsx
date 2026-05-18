import { useEffect, useState } from 'react';
import { useAuth }             from '../../context/AuthContext';
import AuctionCard             from '../../components/AuctionCard';
import { API_URL }             from '../../config';

export default function SupplierDashboard() {
  const { user, token }         = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [myBids, setMyBids]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('browse');

  useEffect(() => {
    if (tab === 'browse') fetchActiveAuctions();
    if (tab === 'mybids') fetchMyBids();
  }, [tab]);

  const fetchActiveAuctions = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auctions?status=active`);
      const data = await res.json();
      setAuctions(data);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBids = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/bids/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMyBids(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Buna, {user.firstName}! 👋</h1>
          <p style={styles.subtitle}>{user.companyName || 'Furnizor RevBid'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'browse' ? styles.tabActive : {}) }}
          onClick={() => setTab('browse')}
        >
          Licitatii active
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'mybids' ? styles.tabActive : {}) }}
          onClick={() => setTab('mybids')}
        >
          Ofertele mele
        </button>
      </div>

      {loading ? (
        <p style={styles.loading}>Se incarca...</p>
      ) : tab === 'browse' ? (
        auctions.length === 0 ? (
          <p style={styles.empty}>Nu sunt licitatii active momentan.</p>
        ) : (
          <div style={styles.grid}>
            {auctions.map(a => <AuctionCard key={a._id} auction={a} />)}
          </div>
        )
      ) : (
        myBids.length === 0 ? (
          <p style={styles.empty}>Nu ai depus nicio oferta inca.</p>
        ) : (
          <div style={styles.grid}>
            {myBids.map(bid => (
              <div key={bid._id} style={styles.bidCard}>
                <div style={styles.bidTop}>
                  <span style={styles.bidTitle}>{bid.auction?.title}</span>
                  <span style={{
                    ...styles.bidStatus,
                    background: bid.isWinning ? '#38a169' : '#718096'
                  }}>
                    {bid.isWinning ? '🏆 Castigator' : 'Supralicitat'}
                  </span>
                </div>
                <p style={styles.bidAmount}>{bid.amount} RON</p>
                <p style={styles.bidDate}>{new Date(bid.createdAt).toLocaleDateString('ro-RO')}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

const styles = {
  page:      { maxWidth: '1100px', margin: '0 auto', padding: '2rem' },
  header:    { marginBottom: '1.5rem' },
  title:     { fontSize: '22px', fontWeight: '700', margin: '0' },
  subtitle:  { color: '#718096', fontSize: '14px', margin: '4px 0 0' },
  tabs:      { display: 'flex', gap: '4px', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0' },
  tab:       { padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: '#718096', borderBottom: '2px solid transparent', marginBottom: '-1px' },
  tabActive: { color: '#1a1a1a', fontWeight: '600', borderBottom: '2px solid #1a1a1a' },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  loading:   { textAlign: 'center', color: '#718096', padding: '2rem' },
  empty:     { textAlign: 'center', color: '#718096', padding: '3rem' },
  bidCard:   { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' },
  bidTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  bidTitle:  { fontSize: '14px', fontWeight: '600', color: '#1a1a1a' },
  bidStatus: { fontSize: '11px', color: '#fff', padding: '2px 8px', borderRadius: '20px' },
  bidAmount: { fontSize: '20px', fontWeight: '700', color: '#e53e3e', margin: '0 0 4px' },
  bidDate:   { fontSize: '12px', color: '#718096', margin: '0' },
};