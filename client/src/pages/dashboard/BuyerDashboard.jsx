import { useEffect, useState, useMemo } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { useAuth }                      from '../../context/AuthContext';
import AuctionCard                      from '../../components/AuctionCard';
import FilterBar, { useAuctionFilters } from '../../components/SearchAndFilters';
import { API_URL }                      from '../../config';

export default function BuyerDashboard() {
  const { user, token } = useAuth();
  const navigate        = useNavigate();
  const [allAuctions, setAllAuctions] = useState([]);
  const [statusFilter,  setStatusFilter]  = useState('active');
  const [loading,       setLoading]       = useState(true);

  /* Licitațiile pentru statusul curent */
  const auctionsByStatus = useMemo(
    () => allAuctions.filter(a => a.status === statusFilter),
    [allAuctions, statusFilter]
  );

  /* Hook filtre — rulează pe lista filtrată după status */
  const filters      = useAuctionFilters(auctionsByStatus);
  const { filtered } = filters;

  /* Categorii disponibile din datele reale */
  const availableCategories = useMemo(() => {
    const cats = [...new Set(allAuctions.map(a => a.category).filter(Boolean))];
    return cats.sort();
  }, [allAuctions]);

  /* Statistici (pe toate licitațiile, indiferent de filtru) */
  const counts = useMemo(() => ({
    active:    allAuctions.filter(a => a.status === 'active').length,
    closed:    allAuctions.filter(a => a.status === 'closed').length,
    cancelled: allAuctions.filter(a => a.status === 'cancelled').length,
    draft:     allAuctions.filter(a => a.status === 'draft').length,
  }), [allAuctions]);

  useEffect(() => { fetchMyAuctions(); }, []);

  const fetchMyAuctions = async () => {
    setLoading(true);
    try {
      /* status=all → returnează toate statusurile de la server */
      const res  = await fetch(`${API_URL}/api/auctions?status=all`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      /* Filtrează doar licitațiile proprii */
      setAllAuctions(data.filter(a => a.buyer?._id === user.id || a.buyer === user.id));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  /* Resetează filtrele de search când se schimbă statusul */
  const handleStatusChange = (s) => {
    setStatusFilter(s);
    filters.clearAll();
  };

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Licitațiile tale</h1>
            <p className="page-subtitle">Gestionează licitațiile active, urmărește ofertele și selectează cel mai bun furnizor.</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/auction/create')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Licitație nouă
          </button>
        </div>

        {/* Stats */}
        <div className="stats-grid stats-grid-4">
          <div className="stat-card">
            <p className="stat-value" style={{ color: 'var(--bid-teal)' }}>{counts.active}</p>
            <p className="stat-label">Active</p>
          </div>
          <div className="stat-card">
            <p className="stat-value" style={{ color: 'var(--action-blue)' }}>{counts.closed}</p>
            <p className="stat-label">Încheiate</p>
          </div>
          <div className="stat-card">
            <p className="stat-value" style={{ color: 'var(--warning-amber)' }}>{counts.cancelled}</p>
            <p className="stat-label">Anulate</p>
          </div>
          <div className="stat-card">
            <p className="stat-value" style={{ color: 'var(--text-muted)' }}>{counts.draft}</p>
            <p className="stat-label">Draft</p>
          </div>
        </div>

        {/* Status pills */}
        <div className="filter-pills">
          {['active', 'closed', 'cancelled', 'draft'].map(s => (
            <button
              key={s}
              className={`filter-pill ${statusFilter === s ? 'active' : ''}`}
              onClick={() => handleStatusChange(s)}
            >
              {s === 'active' ? 'Active' : s === 'closed' ? 'Încheiate' : s === 'cancelled' ? 'Anulate' : 'Draft'}
            </button>
          ))}
        </div>

        {/* Search & filtre */}
        {!loading && auctionsByStatus.length > 0 && (
          <FilterBar
            filters={filters}
            total={auctionsByStatus.length}
            availableCategories={availableCategories}
          />
        )}

        {/* Rezultate */}
        {loading ? (
          <p className="loading-text">Se încarcă...</p>
        ) : auctionsByStatus.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p className="empty-state-title">Nu ai licitații cu statusul "{statusFilter}"</p>
            <p className="empty-state-text">Creează prima ta licitație și lasă furnizorii să concureze pentru cel mai bun preț.</p>
            <button className="btn btn-primary" onClick={() => navigate('/auction/create')}>
              Creează prima licitație
            </button>
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
