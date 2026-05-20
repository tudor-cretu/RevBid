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
  const counts = useMemo(() => {
    const active = allAuctions.filter(a => a.status === 'active');
    return {
      active:        active.length,
      activeWithBids: active.filter(a => (a.bidCount ?? 0) > 0).length,
      expiringSoon:  active.filter(a => isExpiringSoon(a.deadline)).length,
      closed:        allAuctions.filter(a => a.status === 'closed').length,
      cancelled:     allAuctions.filter(a => a.status === 'cancelled').length,
      draft:         allAuctions.filter(a => a.status === 'draft').length,
    };
  }, [allAuctions]);

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
            <p className="page-subtitle">
              Gestionează cererile active, compară ofertele și selectează furnizorul potrivit.
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
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span><strong>{counts.activeWithBids}</strong> au primit oferte</span>
              </span>
              <span className={`rb-insight-pill ${counts.expiringSoon > 0 ? 'is-amber' : ''}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span><strong>{counts.expiringSoon}</strong> expiră curând</span>
              </span>
            </div>
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
          <StatCard
            icon="auctions" tone="teal"
            value={counts.active} label="Licitații active"
            hint={counts.activeWithBids > 0
              ? `${counts.activeWithBids} ${counts.activeWithBids === 1 ? 'a primit' : 'au primit'} oferte`
              : 'Așteaptă primele oferte'}
            onClick={() => handleStatusChange('active')}
          />
          <StatCard
            icon="won" tone="blue"
            value={counts.closed} label="Încheiate"
            hint="Vezi istoricul deciziilor"
            onClick={() => handleStatusChange('closed')}
          />
          <StatCard
            icon="cancelled" tone="red"
            value={counts.cancelled} label="Anulate"
            hint={counts.cancelled > 0 ? 'Necesită revizuire' : 'Nimic anulat'}
            onClick={() => handleStatusChange('cancelled')}
          />
          <StatCard
            icon="draft" tone="gray"
            value={counts.draft} label="Drafturi"
            hint={counts.draft > 0 ? 'Pregătite de publicare' : 'Pregătește o licitație nouă'}
            onClick={() => handleStatusChange('draft')}
          />
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
          <div className="auction-grid">
            {Array.from({ length: 6 }).map((_, i) => <AuctionCardSkeleton key={i} />)}
          </div>
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
