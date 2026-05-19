import { useEffect, useState, useMemo } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { useAuth }                      from '../../context/AuthContext';
import AuctionCard                      from '../../components/AuctionCard';
import FilterBar, { useAuctionFilters } from '../../components/SearchAndFilters';
import { API_URL }                      from '../../config';

export default function SupplierDashboard() {
  const { user, token }         = useAuth();
  const navigate                = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [myBids, setMyBids]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('browse');

  /* ── Filtre (doar pentru tab-ul browse) ── */
  const filters       = useAuctionFilters(auctions);
  const { filtered }  = filters;

  /* Categorii disponibile din datele reale */
  const availableCategories = useMemo(() => {
    const cats = [...new Set(auctions.map(a => a.category).filter(Boolean))];
    return cats.sort();
  }, [auctions]);

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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchMyBids = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/bids/my`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMyBids(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Buna, {user.firstName}! 👋</h1>
            <p className="page-subtitle">{user.companyName || 'Furnizor RevBid'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn ${tab === 'browse' ? 'active' : ''}`} onClick={() => setTab('browse')}>
            Licitații active
          </button>
          <button className={`tab-btn ${tab === 'mybids' ? 'active' : ''}`} onClick={() => setTab('mybids')}>
            Ofertele mele
          </button>
        </div>

        {/* ── Tab: Browse ── */}
        {tab === 'browse' && (
          <>
            {/* Bara de search + filtre */}
            {!loading && auctions.length > 0 && (
              <FilterBar
                filters={filters}
                total={auctions.length}
                availableCategories={availableCategories}
              />
            )}

            {loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <p className="loading-text" style={{ padding: '1rem 0' }}>Se încarcă licitațiile...</p>
              </div>
            ) : auctions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <p className="empty-state-title">Nu sunt licitații active momentan</p>
                <p className="empty-state-text">Revino mai târziu pentru a vedea noi oportunități de ofertare.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔎</div>
                <p className="empty-state-title">Niciun rezultat pentru filtrele selectate</p>
                <p className="empty-state-text">Încearcă să modifici criteriile de căutare sau să ștergi unele filtre.</p>
                <button className="btn btn-outline" onClick={filters.clearAll}>
                  Șterge toate filtrele
                </button>
              </div>
            ) : (
              <div className="auction-grid">
                {filtered.map(a => <AuctionCard key={a._id} auction={a} />)}
              </div>
            )}
          </>
        )}

        {/* ── Tab: Ofertele mele ── */}
        {tab === 'mybids' && (
          loading ? (
            <p className="loading-text">Se încarcă...</p>
          ) : myBids.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <p className="empty-state-title">Nu ai depus nicio ofertă încă</p>
              <p className="empty-state-text">Explorează licitațiile active și depune prima ta ofertă.</p>
              <button className="btn btn-primary" onClick={() => setTab('browse')}>
                Vezi licitații active
              </button>
            </div>
          ) : (
            <div className="auction-grid">
              {myBids.map(bid => (
                <div
                  key={bid._id}
                  className="card card-hover"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/auction/${bid.auction?._id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {bid.auction?.title}
                    </span>
                    <span className={`badge ${bid.isWinning ? 'badge-solid-green' : 'badge-solid-amber'}`} style={{ marginLeft: '8px' }}>
                      {bid.isWinning ? '🏆 Câștigător' : 'Supralicitat'}
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
