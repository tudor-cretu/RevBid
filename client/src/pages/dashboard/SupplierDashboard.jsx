import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuth }             from '../../context/AuthContext';
import AuctionCard             from '../../components/AuctionCard';
import { API_URL }             from '../../config';

export default function SupplierDashboard() {
  const { user, token }         = useAuth();
  const navigate                = useNavigate();
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
      const res = await fetch(`${API_URL}/api/auctions?status=active`);
      const data = await res.json();
      setAuctions(data);
    } finally { setLoading(false); }
  };

  const fetchMyBids = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/bids/my`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMyBids(data);
    } finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Buna, {user.firstName}! 👋</h1>
            <p className="page-subtitle">{user.companyName || 'Furnizor RevBid'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>
            Licitatii active
          </button>
          <button className={`tab-btn ${tab === 'mybids' ? 'active' : ''}`} onClick={() => setTab('mybids')}>
            Ofertele mele
          </button>
        </div>

        {loading ? (
          <p className="loading-text">Se incarca...</p>
        ) : tab === 'browse' ? (
          auctions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <p className="empty-state-title">Nu sunt licitatii active momentan</p>
              <p className="empty-state-text">Revino mai tarziu pentru a vedea noi oportunitati de ofertare.</p>
            </div>
          ) : (
            <div className="auction-grid">
              {auctions.map(a => <AuctionCard key={a._id} auction={a} />)}
            </div>
          )
        ) : (
          myBids.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <p className="empty-state-title">Nu ai depus nicio oferta inca</p>
              <p className="empty-state-text">Exploreaza licitatiile active si depune prima ta oferta.</p>
              <button className="btn btn-primary" onClick={() => setTab('browse')}>
                Vezi licitatii active
              </button>
            </div>
          ) : (
            <div className="auction-grid">
              {myBids.map(bid => (
                <div key={bid._id} className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => navigate(`/auction/${bid.auction?._id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {bid.auction?.title}
                    </span>
                    <span className={`badge ${bid.isWinning ? 'badge-solid-green' : 'badge-solid-amber'}`} style={{ marginLeft: '8px' }}>
                      {bid.isWinning ? '🏆 Castigator' : 'Supralicitat'}
                    </span>
                  </div>
                  <p style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--bid-teal)', margin: '0 0 4px' }}>{bid.amount} RON</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(bid.createdAt).toLocaleDateString('ro-RO')}
                  </p>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}