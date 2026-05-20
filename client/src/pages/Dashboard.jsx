import { useEffect, useState, useMemo } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { useAuth }                      from '../context/AuthContext';
import AuctionCard                      from '../components/AuctionCard';
import FilterBar, { useAuctionFilters } from '../components/SearchAndFilters';
import BuyerDashboard                   from './dashboard/BuyerDashboard';
import SupplierDashboard                from './dashboard/SupplierDashboard';
import { API_URL }                      from '../config';

function AdminDashboardView() {
  const { token }                       = useAuth();
  const navigate                        = useNavigate();
  const [allAuctions, setAllAuctions]   = useState([]);
  const [loading,     setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');

  const auctionsByStatus = useMemo(
    () => statusFilter === 'all'
      ? allAuctions
      : allAuctions.filter(a => a.status === statusFilter),
    [allAuctions, statusFilter]
  );

  const filters      = useAuctionFilters(auctionsByStatus);
  const { filtered } = filters;

  const availableCategories = useMemo(() => {
    const cats = [...new Set(allAuctions.map(a => a.category).filter(Boolean))];
    return cats.sort();
  }, [allAuctions]);

  const counts = useMemo(() => ({
    all:       allAuctions.length,
    active:    allAuctions.filter(a => a.status === 'active').length,
    closed:    allAuctions.filter(a => a.status === 'closed').length,
    cancelled: allAuctions.filter(a => a.status === 'cancelled').length,
    draft:     allAuctions.filter(a => a.status === 'draft').length,
  }), [allAuctions]);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/admin/auctions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setAllAuctions(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const handleStatusChange = s => {
    setStatusFilter(s);
    filters.clearAll();
  };

  return (
    <div className="page">
      <div className="container">

        <div className="page-header">
          <div>
            <h1 className="page-title">Toate licitațiile platformei</h1>
            <p className="page-subtitle">Vizualizare globală a tuturor licitațiilor de pe RevBid.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/admin')}>
            ⚙️ Panou Admin
          </button>
        </div>

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
            <p className="stat-value" style={{ color: 'var(--text-muted)' }}>{counts.cancelled}</p>
            <p className="stat-label">Anulate</p>
          </div>
          <div className="stat-card">
            <p className="stat-value" style={{ color: 'var(--primary-navy)' }}>{counts.all}</p>
            <p className="stat-label">Total</p>
          </div>
        </div>

        <div className="filter-pills">
          {[
            { key: 'active',    label: 'Active' },
            { key: 'closed',    label: 'Încheiate' },
            { key: 'cancelled', label: 'Anulate' },
            { key: 'draft',     label: 'Draft' },
            { key: 'all',       label: 'Toate' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`filter-pill ${statusFilter === key ? 'active' : ''}`}
              onClick={() => handleStatusChange(key)}
            >
              {label}
              <span style={{ marginLeft: 5, opacity: 0.65, fontSize: '0.75em' }}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        {!loading && auctionsByStatus.length > 0 && (
          <FilterBar
            filters={filters}
            total={auctionsByStatus.length}
            availableCategories={availableCategories}
          />
        )}

        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p className="loading-text" style={{ padding: '1rem 0' }}>Se încarcă licitațiile...</p>
          </div>
        ) : auctionsByStatus.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <p className="empty-state-title">Nicio licitație în această categorie</p>
            <p className="empty-state-text">Nu există licitații cu statusul selectat.</p>
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

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'buyer')    return <BuyerDashboard />;
  if (user?.role === 'supplier') return <SupplierDashboard />;
  if (user?.role === 'admin')    return <AdminDashboardView />;
  return <p>Rol necunoscut</p>;
}
