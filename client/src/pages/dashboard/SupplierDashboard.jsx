import { useEffect, useState, useMemo } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { useAuth }                      from '../../context/AuthContext';
import AuctionCard                      from '../../components/AuctionCard';
import FilterBar, { useAuctionFilters } from '../../components/SearchAndFilters';
import { API_URL }                      from '../../config';

export default function SupplierDashboard() {
  const { user, token }         = useAuth();
  const navigate                = useNavigate();
  const [allAuctions, setAllAuctions] = useState([]);
  const [myBidCount,  setMyBidCount]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');

  /* Licitațiile filtrate după status pill */
  const auctionsByStatus = useMemo(
    () => statusFilter === 'all'
      ? allAuctions
      : allAuctions.filter(a => a.status === statusFilter),
    [allAuctions, statusFilter]
  );

  /* Hook filtre — search/categorie/preț pe lista curentă */
  const filters      = useAuctionFilters(auctionsByStatus);
  const { filtered } = filters;

  /* Categorii disponibile */
  const availableCategories = useMemo(() => {
    const cats = [...new Set(allAuctions.map(a => a.category).filter(Boolean))];
    return cats.sort();
  }, [allAuctions]);

  /* Statistici */
  const counts = useMemo(() => ({
    all:       allAuctions.length,
    active:    allAuctions.filter(a => a.status === 'active').length,
    closed:    allAuctions.filter(a => a.status === 'closed').length,
    cancelled: allAuctions.filter(a => a.status === 'cancelled').length,
  }), [allAuctions]);

  useEffect(() => {
    fetchAllAuctions();
    // Badge count pentru "Ofertele mele"
    fetch(`${API_URL}/api/bids/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setMyBidCount(Array.isArray(d) ? d.length : null))
      .catch(() => {});
  }, []);

  const fetchAllAuctions = async () => {
    setLoading(true);
    try {
      /* status=all → returnează active + closed + cancelled */
      const res  = await fetch(`${API_URL}/api/auctions?status=all`);
      const data = await res.json();
      setAllAuctions(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleStatusChange = s => {
    setStatusFilter(s);
    filters.clearAll();
  };

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Oportunități de ofertare</h1>
            <p className="page-subtitle">Explorează licitațiile active și depune oferta pentru cel mai competitiv preț.</p>
          </div>
          <button className="btn btn-outline" onClick={() => navigate('/my-bids')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            📋 Ofertele mele
            {myBidCount !== null && myBidCount > 0 && (
              <span style={{ background: 'var(--bid-teal)', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, borderRadius: '999px', padding: '1px 7px' }}>{myBidCount}</span>
            )}
          </button>
        </div>

        {/* Stats */}
        <div className="stats-grid stats-grid-4">
          <div className="stat-card">
            <p className="stat-value" style={{ color: 'var(--bid-teal)' }}>{counts.active}</p>
            <p className="stat-label">Licitații active</p>
          </div>
          <div className="stat-card">
            <p className="stat-value" style={{ color: 'var(--action-blue)' }}>{counts.closed}</p>
            <p className="stat-label">Încheiate</p>
          </div>
          <div className="stat-card">
            <p className="stat-value" style={{ color: 'var(--text-muted)' }}>{counts.cancelled}</p>
            <p className="stat-label">Anulate</p>
          </div>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/my-bids')}>
            <p className="stat-value" style={{ color: 'var(--primary-navy)' }}>{myBidCount ?? '—'}</p>
            <p className="stat-label">Ofertele mele</p>
          </div>
        </div>

        {/* Status pills */}
        <div className="filter-pills">
          {[
            { key: 'active',    label: 'Active' },
            { key: 'closed',    label: 'Încheiate' },
            { key: 'cancelled', label: 'Anulate' },
            { key: 'all',       label: 'Toate' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`filter-pill ${statusFilter === key ? 'active' : ''}`}
              onClick={() => handleStatusChange(key)}
            >
              {label}
              <span style={{ marginLeft: 5, opacity: 0.65, fontSize: '0.75em' }}>
                {key === 'all' ? counts.all : counts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Bara search + filtre */}
        {!loading && auctionsByStatus.length > 0 && (
          <FilterBar
            filters={filters}
            total={auctionsByStatus.length}
            availableCategories={availableCategories}
          />
        )}

        {/* Rezultate */}
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p className="loading-text" style={{ padding: '1rem 0' }}>Se încarcă licitațiile...</p>
          </div>
        ) : auctionsByStatus.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <p className="empty-state-title">
              {statusFilter === 'active'
                ? 'Nu sunt licitații active momentan'
                : statusFilter === 'closed'
                  ? 'Nicio licitație încheiată'
                  : statusFilter === 'cancelled'
                    ? 'Nicio licitație anulată'
                    : 'Nicio licitație disponibilă'}
            </p>
            <p className="empty-state-text">Revino mai târziu pentru noi oportunități.</p>
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
      </div>
    </div>
  );
}
