import { useEffect, useState, useMemo } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { useAuth }                      from '../../context/AuthContext';
import AuctionCard, { AuctionCardSkeleton } from '../../components/AuctionCard';
import StatCard                         from '../../components/StatCard';
import FilterBar, { useAuctionFilters } from '../../components/SearchAndFilters';
import { API_URL }                      from '../../config';

function isExpiringSoon(deadline) {
  if (!deadline) return false;
  const diff = new Date(deadline) - new Date();
  return diff > 0 && diff <= 48 * 3600000;
}

export default function SupplierDashboard() {
  const { token }               = useAuth();
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
  const counts = useMemo(() => {
    const active = allAuctions.filter(a => a.status === 'active');
    return {
      all:          allAuctions.length,
      active:       active.length,
      expiringSoon: active.filter(a => isExpiringSoon(a.deadline)).length,
      noBids:       active.filter(a => (a.bidCount ?? 0) === 0).length,
      closed:       allAuctions.filter(a => a.status === 'closed').length,
      cancelled:    allAuctions.filter(a => a.status === 'cancelled').length,
    };
  }, [allAuctions]);

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
            <p className="page-subtitle">
              Explorează licitațiile active și depune oferta pentru cel mai competitiv preț.
            </p>

            {/* Insight contextual */}
            <div className="rb-insight">
              <span className="rb-insight-pill is-teal">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h5"/>
                </svg>
                <span><strong>{counts.active}</strong> licitații active</span>
              </span>
              <span className="rb-insight-pill">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                </svg>
                <span><strong>{counts.noBids}</strong> fără oferte încă</span>
              </span>
              <span className={`rb-insight-pill ${counts.expiringSoon > 0 ? 'is-amber' : ''}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span><strong>{counts.expiringSoon}</strong> expiră curând</span>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline btn-lg"
              onClick={() => navigate('/dashboard/statistici')}
              title="Rată câștig, categorii performante, oferte pierdute la diferență mică"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="20" x2="12" y2="10"/>
                <line x1="18" y1="20" x2="18" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="16"/>
              </svg>
              Statistici
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => navigate('/my-bids')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Ofertele mele
              {myBidCount !== null && myBidCount > 0 && (
                <span style={{ background: 'var(--bid-teal)', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, borderRadius: '999px', padding: '1px 7px' }}>{myBidCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid stats-grid-4">
          <StatCard
            icon="auctions" tone="teal"
            value={counts.active} label="Licitații active"
            hint="Oportunități deschise"
            onClick={() => handleStatusChange('active')}
          />
          <StatCard
            icon="won" tone="blue"
            value={counts.closed} label="Încheiate"
            hint="Licitații finalizate"
            onClick={() => handleStatusChange('closed')}
          />
          <StatCard
            icon="cancelled" tone="gray"
            value={counts.cancelled} label="Anulate"
            hint={counts.cancelled > 0 ? 'Nu mai acceptă oferte' : 'Nimic anulat'}
            onClick={() => handleStatusChange('cancelled')}
          />
          <StatCard
            icon="bids" tone="navy"
            value={myBidCount ?? '—'} label="Ofertele mele"
            hint="Vezi toate ofertele depuse"
            onClick={() => navigate('/my-bids')}
          />
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
          <div className="auction-grid">
            {Array.from({ length: 6 }).map((_, i) => <AuctionCardSkeleton key={i} />)}
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
