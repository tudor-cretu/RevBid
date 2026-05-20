import { useEffect, useState, useMemo } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { useAuth }                      from '../context/AuthContext';
import { API_URL }                      from '../config';

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Derivă statusul ofertei din datele disponibile.
 * Combinație între isWinning, auction.status și rank.
 */
function deriveBidStatus(bid) {
  const as = bid.auction?.status;
  if (as === 'cancelled')          return 'cancelled';
  if (as === 'closed') {
    if (bid.isWinning)             return 'accepted';   // oferta câștigătoare la o licitație închisă
    return 'expired';
  }
  if (as === 'active') {
    if (bid.rank === 1)            return 'leading';    // cea mai bună ofertă curentă
    return 'outbid';                                    // a existat o ofertă mai bună
  }
  return 'submitted';
}

const STATUS_CONFIG = {
  leading:   { label: '🏆 Lider',        bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
  accepted:  { label: '✅ Câștigată',     bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
  outbid:    { label: '⚡ Depășită',      bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
  submitted: { label: '📤 Trimisă',       bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  expired:   { label: '🕐 Expirată',      bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
  cancelled: { label: '❌ Anulată',       bg: '#FEF2F2', color: '#991B1B', border: '#FCA5A5' },
};

const AUCTION_STATUS_CONFIG = {
  active:    { label: 'Activă',    bg: '#D1FAE5', color: '#065F46' },
  closed:    { label: 'Închisă',   bg: '#F3F4F6', color: '#6B7280' },
  cancelled: { label: 'Anulată',   bg: '#FEE2E2', color: '#991B1B' },
  draft:     { label: 'Draft',     bg: '#FEF3C7', color: '#92400E' },
};

function BidStatusBadge({ bid }) {
  const s   = deriveBidStatus(bid);
  const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.submitted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: '999px', fontSize: '0.75rem',
      fontWeight: 600, background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function AuctionStatusBadge({ status }) {
  const cfg = AUCTION_STATUS_CONFIG[status] || AUCTION_STATUS_CONFIG.closed;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '999px',
      fontSize: '0.6875rem', fontWeight: 600, background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

function timeAgo(date) {
  if (!date) return '—';
  const diff = Date.now() - new Date(date);
  const h    = Math.floor(diff / 3600000);
  const d    = Math.floor(diff / 86400000);
  if (h < 1)  return 'acum';
  if (h < 24) return `acum ${h}h`;
  if (d < 30) return `acum ${d}z`;
  return new Date(date).toLocaleDateString('ro-RO');
}

function deadlineLabel(date) {
  if (!date) return { text: '—', urgent: false };
  const diff = new Date(date) - Date.now();
  if (diff < 0) return { text: 'Expirat', urgent: true };
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 2)  return { text: `${Math.floor(diff / 60000)}min`, urgent: true };
  if (h < 24) return { text: `${h}h`, urgent: true };
  if (d < 3)  return { text: `${d}z ${h % 24}h`, urgent: true };
  return { text: new Date(date).toLocaleDateString('ro-RO'), urgent: false };
}

/* ─── BidDetailModal ─────────────────────────────────────────── */
function BidDetailModal({ bid, onClose }) {
  const navigate   = useNavigate();
  const bidStatus  = deriveBidStatus(bid);
  const dl         = deadlineLabel(bid.auction?.deadline);
  const buyerName  = bid.auction?.buyer?.companyName
    || `${bid.auction?.buyer?.firstName || ''} ${bid.auction?.buyer?.lastName || ''}`.trim()
    || '—';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card" style={{ maxWidth: 540, width: '100%', padding: '1.75rem', maxHeight: '85vh', overflow: 'auto', boxShadow: 'var(--shadow-xl)', animation: 'slideDown .2s ease' }}>

        {/* Header modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-heading)' }}>
              Detalii ofertă
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Trimisă {timeAgo(bid.createdAt)}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)', padding: '0 4px' }}>✕</button>
        </div>

        {/* Licitație */}
        <Section title="Licitație">
          <InfoRow label="Titlu"    value={bid.auction?.title || '—'} />
          <InfoRow label="Categorie" value={bid.auction?.category || '—'} />
          <InfoRow label="Buyer"    value={buyerName} />
          <InfoRow label="Status licitație" value={<AuctionStatusBadge status={bid.auction?.status} />} />
          <InfoRow label="Deadline" value={
            <span style={{ color: dl.urgent ? 'var(--warning-amber)' : 'inherit', fontWeight: dl.urgent ? 600 : 400 }}>
              {dl.text}{dl.urgent && bid.auction?.status === 'active' ? ' ⚠️' : ''}
            </span>
          } />
          <InfoRow label="Preț curent licitație" value={
            <span style={{ fontWeight: 700, color: 'var(--bid-teal)' }}>
              {bid.auction?.currentPrice?.toLocaleString('ro-RO')} RON
            </span>
          } />
        </Section>

        {/* Oferta mea */}
        <Section title="Oferta mea">
          <InfoRow label="Suma oferită" value={
            <span style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--primary-navy)' }}>
              {bid.amount?.toLocaleString('ro-RO')} RON
            </span>
          } />
          <InfoRow label="Status ofertă" value={<BidStatusBadge bid={bid} />} />
          <InfoRow label="Poziție"  value={
            bid.rank === 1
              ? <span style={{ color: '#065F46', fontWeight: 700 }}>🏆 #1 — Cea mai bună ofertă</span>
              : bid.rank ? `#${bid.rank} din ${bid.totalBids}` : '—'
          } />
          <InfoRow label="Total oferte" value={bid.totalBids || '—'} />
          <InfoRow label="Mesaj trimis" value={bid.message || <span style={{ color: 'var(--text-muted)' }}>Fără mesaj</span>} />
          <InfoRow label="Trimisă la"   value={new Date(bid.createdAt).toLocaleString('ro-RO')} />
          <InfoRow label="Actualizat"   value={bid.updatedAt !== bid.createdAt ? new Date(bid.updatedAt).toLocaleString('ro-RO') : '—'} />
        </Section>

        {/* Acțiuni */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn btn-primary" onClick={() => { navigate(`/auction/${bid.auction?._id}`); onClose(); }}>
            👁 Vezi licitația
          </button>
          <button className="btn btn-outline" onClick={onClose}>
            Închide
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>{title}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: '0.875rem', padding: '4px 0', borderBottom: '1px solid var(--border-light)' }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text-body)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════ */
const SORT_OPTIONS = [
  { value: 'newest',          label: 'Cele mai noi' },
  { value: 'deadline_asc',    label: 'Deadline apropiat' },
  { value: 'amount_asc',      label: 'Sumă crescătoare' },
  { value: 'amount_desc',     label: 'Sumă descrescătoare' },
  { value: 'active_first',    label: 'Licitații active' },
  { value: 'leading_first',   label: 'Oferte lider' },
];

export default function MyBids() {
  const { user, token } = useAuth();
  const navigate        = useNavigate();

  const [bids,       setBids]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [detailBid,  setDetailBid]  = useState(null);

  // Filtre
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [filterAuction, setFilterAuction] = useState('all');
  const [filterCat,     setFilterCat]     = useState('all');
  const [sortBy,        setSortBy]        = useState('newest');
  const [amountMin,     setAmountMin]     = useState('');
  const [amountMax,     setAmountMax]     = useState('');

  useEffect(() => {
    if (user?.role !== 'supplier') { navigate('/dashboard'); return; }
    fetchMyBids();
  }, []);

  const fetchMyBids = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/bids/my`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setBids(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // Categorii disponibile
  const categories = useMemo(() => {
    const cats = [...new Set(bids.map(b => b.auction?.category).filter(Boolean))];
    return cats.sort();
  }, [bids]);

  // Stats cards
  const stats = useMemo(() => ({
    total:     bids.length,
    leading:   bids.filter(b => deriveBidStatus(b) === 'leading').length,
    accepted:  bids.filter(b => deriveBidStatus(b) === 'accepted').length,
    outbid:    bids.filter(b => deriveBidStatus(b) === 'outbid').length,
    submitted: bids.filter(b => deriveBidStatus(b) === 'submitted').length,
  }), [bids]);

  // Filtrare + sortare
  const filtered = useMemo(() => {
    let result = [...bids];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(b =>
        b.auction?.title?.toLowerCase().includes(q) ||
        b.auction?.category?.toLowerCase().includes(q) ||
        b.auction?.buyer?.companyName?.toLowerCase().includes(q) ||
        b.auction?.buyer?.firstName?.toLowerCase().includes(q) ||
        b.message?.toLowerCase().includes(q)
      );
    }

    // Status ofertă
    if (filterStatus !== 'all') {
      result = result.filter(b => deriveBidStatus(b) === filterStatus);
    }

    // Status licitație
    if (filterAuction !== 'all') {
      result = result.filter(b => b.auction?.status === filterAuction);
    }

    // Categorie
    if (filterCat !== 'all') {
      result = result.filter(b => b.auction?.category === filterCat);
    }

    // Sumă min/max
    if (amountMin !== '') result = result.filter(b => b.amount >= parseFloat(amountMin));
    if (amountMax !== '') result = result.filter(b => b.amount <= parseFloat(amountMax));

    // Sortare
    result.sort((a, b) => {
      switch (sortBy) {
        case 'deadline_asc':
          return new Date(a.auction?.deadline || 9e15) - new Date(b.auction?.deadline || 9e15);
        case 'amount_asc':    return a.amount - b.amount;
        case 'amount_desc':   return b.amount - a.amount;
        case 'active_first':
          return (b.auction?.status === 'active' ? 1 : 0) - (a.auction?.status === 'active' ? 1 : 0);
        case 'leading_first':
          return (deriveBidStatus(b) === 'leading' ? 1 : 0) - (deriveBidStatus(a) === 'leading' ? 1 : 0);
        default: return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    return result;
  }, [bids, search, filterStatus, filterAuction, filterCat, amountMin, amountMax, sortBy]);

  const hasActiveFilters = search || filterStatus !== 'all' || filterAuction !== 'all' || filterCat !== 'all' || amountMin !== '' || amountMax !== '';

  const clearFilters = () => {
    setSearch(''); setFilterStatus('all'); setFilterAuction('all');
    setFilterCat('all'); setAmountMin(''); setAmountMax('');
  };

  if (loading) return (
    <div className="page">
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <div className="spinner" />
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="container">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="page-header" style={{ marginBottom: '1.75rem' }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>📋 Ofertele tale</h1>
            <p className="page-subtitle">Urmărește ofertele trimise și statusul lor în licitațiile active.</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
            🔍 Explorează licitații
          </button>
        </div>

        {/* ── Stats cards ─────────────────────────────────────── */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: '1.75rem' }}>
          <StatCard label="Total oferte"    value={stats.total}     color="var(--action-blue)" />
          <StatCard label="Lider 🏆"       value={stats.leading}   color="var(--success-green)" />
          <StatCard label="Câștigate ✅"    value={stats.accepted}  color="var(--success-green)" />
          <StatCard label="Depășite ⚡"    value={stats.outbid}    color="var(--warning-amber)" />
          <StatCard label="În așteptare"   value={stats.submitted}  color="var(--bid-teal)" />
        </div>

        {bids.length === 0 ? (
          /* ── Empty state ────────────────────────────────────── */
          <div className="empty-state" style={{ padding: '4rem 2rem' }}>
            <div className="empty-state-icon" style={{ fontSize: '3rem' }}>📝</div>
            <p className="empty-state-title">Nu ai trimis încă nicio ofertă</p>
            <p className="empty-state-text">
              Explorează licitațiile active și trimite prima ta ofertă pentru a apărea aici.
            </p>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/dashboard')}>
              🔍 Vezi licitații disponibile
            </button>
          </div>
        ) : (
          <>
            {/* ── Filtre ────────────────────────────────────────── */}
            <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>

                {/* Search */}
                <div style={{ flex: '2 1 220px', minWidth: 180 }}>
                  <label style={labelSt}>Caută</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>🔍</span>
                    <input
                      className="form-input"
                      placeholder="Titlu, categorie, buyer, mesaj..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ paddingLeft: 32 }}
                    />
                  </div>
                </div>

                {/* Status ofertă */}
                <div style={{ flex: '1 1 140px', minWidth: 130 }}>
                  <label style={labelSt}>Status ofertă</label>
                  <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">Toate</option>
                    <option value="leading">Lider</option>
                    <option value="accepted">Câștigată</option>
                    <option value="outbid">Depășită</option>
                    <option value="submitted">Trimisă</option>
                    <option value="expired">Expirată</option>
                    <option value="cancelled">Anulată</option>
                  </select>
                </div>

                {/* Status licitație */}
                <div style={{ flex: '1 1 140px', minWidth: 130 }}>
                  <label style={labelSt}>Status licitație</label>
                  <select className="form-select" value={filterAuction} onChange={e => setFilterAuction(e.target.value)}>
                    <option value="all">Toate</option>
                    <option value="active">Active</option>
                    <option value="closed">Închise</option>
                    <option value="cancelled">Anulate</option>
                  </select>
                </div>

                {/* Categorie */}
                {categories.length > 1 && (
                  <div style={{ flex: '1 1 130px', minWidth: 120 }}>
                    <label style={labelSt}>Categorie</label>
                    <select className="form-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                      <option value="all">Toate</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                {/* Sumă */}
                <div style={{ flex: '1 1 100px', minWidth: 90 }}>
                  <label style={labelSt}>Sumă min (RON)</label>
                  <input className="form-input" type="number" placeholder="0" value={amountMin} onChange={e => setAmountMin(e.target.value)} />
                </div>
                <div style={{ flex: '1 1 100px', minWidth: 90 }}>
                  <label style={labelSt}>Sumă max (RON)</label>
                  <input className="form-input" type="number" placeholder="∞" value={amountMax} onChange={e => setAmountMax(e.target.value)} />
                </div>

                {/* Sortare */}
                <div style={{ flex: '1 1 170px', minWidth: 160 }}>
                  <label style={labelSt}>Sortare</label>
                  <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Active filter chips */}
              {hasActiveFilters && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Filtre active:</span>
                  {search       && <Chip label={`Căutare: "${search}"`}     onRemove={() => setSearch('')} />}
                  {filterStatus !== 'all'  && <Chip label={`Status: ${STATUS_CONFIG[filterStatus]?.label || filterStatus}`} onRemove={() => setFilterStatus('all')} />}
                  {filterAuction !== 'all' && <Chip label={`Licitație: ${filterAuction}`} onRemove={() => setFilterAuction('all')} />}
                  {filterCat !== 'all'     && <Chip label={`Cat: ${filterCat}`}           onRemove={() => setFilterCat('all')} />}
                  {amountMin  && <Chip label={`Min: ${amountMin} RON`}   onRemove={() => setAmountMin('')} />}
                  {amountMax  && <Chip label={`Max: ${amountMax} RON`}   onRemove={() => setAmountMax('')} />}
                  <button onClick={clearFilters} style={{ fontSize: '0.75rem', color: 'var(--action-blue)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-sans)', padding: '2px 4px' }}>
                    Șterge toate filtrele
                  </button>
                </div>
              )}

              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 8, marginBottom: 0 }}>
                {filtered.length} {filtered.length === 1 ? 'ofertă' : 'oferte'} {filtered.length !== bids.length ? `(din ${bids.length} total)` : ''}
              </p>
            </div>

            {/* ── Tabel oferte ─────────────────────────────────── */}
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔎</div>
                <p className="empty-state-title">Niciun rezultat</p>
                <p className="empty-state-text">Încearcă să modifici filtrele sau caută altceva.</p>
                <button className="btn btn-outline" onClick={clearFilters}>Șterge filtrele</button>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="table-wrap mb-bids-hide-mobile">
                  <table className="table">
                    <thead>
                      <tr>
                        {['Licitație', 'Categorie', 'Oferta mea', 'Poziție', 'Status ofertă', 'Status licitație', 'Deadline', 'Trimisă la', 'Acțiuni'].map(h => (
                          <th key={h} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(bid => {
                        const dl      = deadlineLabel(bid.auction?.deadline);
                        const bidSt   = deriveBidStatus(bid);
                        const canView = !!bid.auction?._id;
                        return (
                          <tr key={bid._id} style={{ cursor: 'pointer' }} onClick={() => setDetailBid(bid)}>
                            <td style={{ maxWidth: 200 }}>
                              <p style={{ fontWeight: 600, margin: 0, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {bid.auction?.title || '—'}
                              </p>
                              {bid.message && (
                                <p style={{ margin: '2px 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  💬 {bid.message}
                                </p>
                              )}
                            </td>
                            <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                              <span className="badge badge-blue" style={{ fontSize: '0.6875rem' }}>{bid.auction?.category || '—'}</span>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <p style={{ fontWeight: 700, fontSize: '1rem', margin: 0, color: bidSt === 'leading' || bidSt === 'accepted' ? 'var(--success-green)' : 'var(--bid-teal)' }}>
                                {bid.amount?.toLocaleString('ro-RO')} RON
                              </p>
                              <p style={{ margin: '1px 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                                Curent: {bid.auction?.currentPrice?.toLocaleString('ro-RO')} RON
                              </p>
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '0.8125rem' }}>
                              {bid.rank === 1
                                ? <span style={{ color: '#065F46', fontWeight: 700 }}>🏆 #1</span>
                                : bid.rank
                                  ? <span style={{ color: 'var(--text-muted)' }}>#{bid.rank}/{bid.totalBids}</span>
                                  : '—'}
                            </td>
                            <td><BidStatusBadge bid={bid} /></td>
                            <td><AuctionStatusBadge status={bid.auction?.status} /></td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                              {bid.auction?.deadline
                                ? <span style={{ color: dl.urgent ? 'var(--warning-amber)' : 'var(--text-body)', fontWeight: dl.urgent ? 600 : 400 }}>
                                    {dl.text}{dl.urgent ? ' ⚠️' : ''}
                                  </span>
                                : '—'}
                            </td>
                            <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                              {timeAgo(bid.createdAt)}
                            </td>
                            <td onClick={e => e.stopPropagation()}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  className="btn btn-sm btn-outline"
                                  onClick={() => setDetailBid(bid)}
                                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                >
                                  🔍 Detalii
                                </button>
                                {canView && (
                                  <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => navigate(`/auction/${bid.auction._id}`)}
                                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                  >
                                    👁 Licitație
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="mb-bids-cards">
                  {filtered.map(bid => {
                    const dl    = deadlineLabel(bid.auction?.deadline);
                    const bidSt = deriveBidStatus(bid);
                    return (
                      <div key={bid._id} className="card card-hover" style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => setDetailBid(bid)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-heading)' }}>
                              {bid.auction?.title}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>{bid.auction?.category}</p>
                          </div>
                          <BidStatusBadge bid={bid} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Oferta mea</p>
                            <p style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: bidSt === 'leading' ? 'var(--success-green)' : 'var(--bid-teal)' }}>
                              {bid.amount?.toLocaleString('ro-RO')} RON
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Curent</p>
                            <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--text-heading)' }}>
                              {bid.auction?.currentPrice?.toLocaleString('ro-RO')} RON
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 8, marginTop: 4 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <AuctionStatusBadge status={bid.auction?.status} />
                            {bid.rank === 1 && <span style={{ fontSize: '0.75rem', color: '#065F46', fontWeight: 700 }}>🏆 #1</span>}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: dl.urgent ? 'var(--warning-amber)' : 'var(--text-muted)', fontWeight: dl.urgent ? 600 : 400 }}>
                            {dl.text}{dl.urgent && bid.auction?.status === 'active' ? ' ⚠️' : ''}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                          <button className="btn btn-sm btn-outline" style={{ flex: 1, fontSize: '0.8125rem' }} onClick={() => setDetailBid(bid)}>🔍 Detalii</button>
                          {bid.auction?._id && (
                            <button className="btn btn-sm btn-primary" style={{ flex: 1, fontSize: '0.8125rem' }} onClick={() => navigate(`/auction/${bid.auction._id}`)}>👁 Licitație</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Detail Modal ───────────────────────────────────────── */}
      {detailBid && <BidDetailModal bid={detailBid} onClose={() => setDetailBid(null)} />}

      <style>{CSS}</style>
    </div>
  );
}

/* ── Small components ─────────────────────────────────────────── */
function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <p className="stat-value" style={{ color }}>{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}

function Chip({ label, onRemove }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--ice-blue)', border: '1px solid var(--border)', borderRadius: '999px', fontSize: '0.75rem', color: 'var(--text-body)' }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 1px', lineHeight: 1, fontFamily: 'var(--font-sans)' }}>✕</button>
    </span>
  );
}

const labelSt = { display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' };

const CSS = `
  .mb-bids-hide-mobile { display: block; }
  .mb-bids-cards       { display: none; flex-direction: column; gap: 12px; }
  @media (max-width: 768px) {
    .mb-bids-hide-mobile { display: none; }
    .mb-bids-cards       { display: flex; }
  }
`;
