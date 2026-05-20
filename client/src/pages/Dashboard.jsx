import { useEffect, useState, useMemo } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { useAuth }                      from '../context/AuthContext';
import AuctionCard, { AuctionCardSkeleton } from '../components/AuctionCard';
import StatCard                         from '../components/StatCard';
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

  const counts = useMemo(() => {
    const active = allAuctions.filter(a => a.status === 'active');
    return {
      all:        allAuctions.length,
      active:     active.length,
      withBids:   active.filter(a => (a.bidCount ?? 0) > 0).length,
      closed:     allAuctions.filter(a => a.status === 'closed').length,
      cancelled:  allAuctions.filter(a => a.status === 'cancelled').length,
      draft:      allAuctions.filter(a => a.status === 'draft').length,
    };
  }, [allAuctions]);

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

            <div className="rb-insight">
              <span className="rb-insight-pill is-teal">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h5"/>
                </svg>
                <span><strong>{counts.active}</strong> active</span>
              </span>
              <span className="rb-insight-pill">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span><strong>{counts.withBids}</strong> cu oferte</span>
              </span>
              <span className="rb-insight-pill">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                <span><strong>{counts.all}</strong> total</span>
              </span>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/admin')}>
            ⚙️ Panou Admin
          </button>
        </div>

        <div className="stats-grid stats-grid-4">
          <StatCard
            icon="auctions" tone="teal"
            value={counts.active} label="Active"
            hint={`${counts.withBids} au primit oferte`}
            onClick={() => handleStatusChange('active')}
          />
          <StatCard
            icon="won" tone="blue"
            value={counts.closed} label="Încheiate"
            hint="Licitații finalizate"
            onClick={() => handleStatusChange('closed')}
          />
          <StatCard
            icon="cancelled" tone="red"
            value={counts.cancelled} label="Anulate"
            hint={counts.cancelled > 0 ? 'Necesită atenție' : 'Nimic anulat'}
            onClick={() => handleStatusChange('cancelled')}
          />
          <StatCard
            icon="total" tone="navy"
            value={counts.all} label="Total licitații"
            hint="Pe toată platforma"
          />
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
          <div className="auction-grid">
            {Array.from({ length: 6 }).map((_, i) => <AuctionCardSkeleton key={i} />)}
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
