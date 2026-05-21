import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

/* ── Metadata pe tip de notificare (icon, titlu, categorie) ─────────
   Folosește exact tipurile emise de backend (notifyUser). */
const TYPE_META = {
  auction_won:         { icon: '🏆', title: 'Licitație câștigată',            cat: 'licitatii' },
  auction_ended:       { icon: '🏁', title: 'Licitație încheiată',            cat: 'licitatii' },
  auction_lost:        { icon: '🤝', title: 'Licitație încheiată',            cat: 'licitatii' },
  auction_watch_ended: { icon: '👀', title: 'Licitație urmărită încheiată',   cat: 'licitatii' },
  auction_closed:      { icon: '🔒', title: 'Licitație închisă',              cat: 'licitatii' },
  bid:                 { icon: '💰', title: 'Ofertă nouă',                    cat: 'oferte' },
  outbid:              { icon: '⚠️', title: 'Ai fost supralicitat',           cat: 'oferte' },
  approval_request:    { icon: '📝', title: 'Cerere de aprobare',             cat: 'approvals' },
  approval_approved:   { icon: '✅', title: 'Cerere aprobată',                cat: 'approvals' },
  approval_rejected:   { icon: '❌', title: 'Cerere respinsă',                cat: 'approvals' },
  message:             { icon: '💬', title: 'Mesaj nou',                      cat: 'mesaje' },
  auction_chat:        { icon: '🏷️', title: 'Mesaj în chatul licitației',     cat: 'mesaje' },
  review_ready:        { icon: '⭐', title: 'Review disponibil',               cat: 'review' },
  review_received:     { icon: '🌟', title: 'Ai primit un review',            cat: 'review' },
  delivery_confirmed:  { icon: '📦', title: 'Livrare confirmată',             cat: 'review' },
  receipt_confirmed:   { icon: '📬', title: 'Primire confirmată',             cat: 'review' },
};
const FALLBACK_META = { icon: '🔔', title: 'Notificare', cat: 'sistem' };
const metaFor = type => TYPE_META[type] || FALLBACK_META;

const CAT_META = {
  licitatii: { label: 'Licitații',  color: '#0871C4', bg: '#E0F0FF' },
  oferte:    { label: 'Oferte',     color: '#00A99D', bg: '#D8F3F1' },
  approvals: { label: 'Aprobări',   color: '#B45309', bg: '#FEF3C7' },
  mesaje:    { label: 'Mesaje',     color: '#033667', bg: '#EAF4F7' },
  review:    { label: 'Review-uri', color: '#17B26A', bg: '#DCFCE7' },
  sistem:    { label: 'Sistem',     color: '#6B7C86', bg: '#EAF4F7' },
};

const FILTERS = [
  { key: 'all',       label: 'Toate' },
  { key: 'unread',    label: 'Necitite' },
  { key: 'read',      label: 'Citite' },
  { key: 'licitatii', label: 'Licitații' },
  { key: 'oferte',    label: 'Oferte' },
  { key: 'approvals', label: 'Aprobări' },
  { key: 'mesaje',    label: 'Mesaje' },
  { key: 'review',    label: 'Review-uri' },
  { key: 'sistem',    label: 'Sistem' },
];

/* Anunță restul aplicației (ex: clopoțelul din Navbar) că s-a schimbat ceva. */
const broadcastChange = () => window.dispatchEvent(new Event('rb-notifications-changed'));

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)    return 'chiar acum';
  if (diff < 3600)  return `acum ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `acum ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'ieri';
  return `acum ${Math.floor(diff / 86400)} zile`;
};
const fullDateTime = (date) => {
  const d = new Date(date);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/* Grupare pe intervale de timp. */
function groupByTime(items) {
  const now = new Date();
  const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const today = startOfDay(now);
  const yesterday = today - 86400000;
  const weekAgo = today - 6 * 86400000;

  const groups = { today: [], yesterday: [], week: [], older: [] };
  for (const n of items) {
    const t = startOfDay(n.createdAt);
    if (t === today)        groups.today.push(n);
    else if (t === yesterday) groups.yesterday.push(n);
    else if (t >= weekAgo)  groups.week.push(n);
    else                    groups.older.push(n);
  }
  return [
    { key: 'today',     label: 'Astăzi',            items: groups.today },
    { key: 'yesterday', label: 'Ieri',              items: groups.yesterday },
    { key: 'week',      label: 'Săptămâna aceasta', items: groups.week },
    { key: 'older',     label: 'Mai vechi',         items: groups.older },
  ].filter(g => g.items.length > 0);
}

export default function Notifications() {
  const { token }   = useAuth();
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedId  = searchParams.get('selected');

  const [items,   setItems]   = useState([]);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [busyId,  setBusyId]  = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast,   setToast]   = useState('');

  const itemRefs = useRef({});
  const scrolledRef = useRef(false);

  /* Debounce pentru search */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  /* Afișează un toast temporar */
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  /* Încarcă o pagină de notificări */
  const fetchPage = useCallback(async (pageNum, replace) => {
    replace ? setLoading(true) : setLoadingMore(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '20', filter });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`${API_URL}/api/notifications/list?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setItems(prev => replace ? data.items : [...prev, ...data.items]);
      setPage(data.page);
      setPages(data.pages);
      setTotal(data.total);
    } catch {
      setError('Nu am putut încărca notificările. Verifică conexiunea și încearcă din nou.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token, filter, debouncedSearch]);

  /* Reîncarcă de la pagina 1 când se schimbă filtrul sau search-ul */
  useEffect(() => {
    scrolledRef.current = false;
    fetchPage(1, true);
  }, [fetchPage]);

  /* Scroll + highlight pentru notificarea selectată din dropdown */
  useEffect(() => {
    if (loading || !selectedId || scrolledRef.current) return;
    const el = itemRefs.current[selectedId];
    if (el) {
      scrolledRef.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Marchează automat ca citită notificarea selectată
      const target = items.find(n => n._id === selectedId);
      if (target && !target.read) markRead(selectedId, true, true);
    }
  }, [loading, items, selectedId]);

  /* ── Acțiuni ── */
  const markRead = async (id, read, silent = false) => {
    if (!silent) setBusyId(id);
    try {
      const res = await fetch(`${API_URL}/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ read }),
      });
      if (!res.ok) { if (!silent) showToast('error:Acțiunea nu a reușit.'); return false; }
      setItems(prev => prev.map(n => n._id === id ? { ...n, read } : n));
      broadcastChange();
      if (!silent) showToast(read ? 'ok:Notificare marcată ca citită.' : 'ok:Notificare marcată ca necitită.');
      return true;
    } catch {
      if (!silent) showToast('error:Eroare de conexiune.');
      return false;
    } finally {
      if (!silent) setBusyId(null);
    }
  };

  const deleteNotif = async (id) => {
    setBusyId(id);
    try {
      const res = await fetch(`${API_URL}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { showToast('error:Nu am putut șterge notificarea.'); return; }
      setItems(prev => prev.filter(n => n._id !== id));
      setTotal(t => Math.max(0, t - 1));
      broadcastChange();
      showToast('ok:Notificare ștearsă.');
    } catch {
      showToast('error:Eroare de conexiune.');
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    setBulkBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { showToast('error:Acțiunea nu a reușit.'); return; }
      setItems(prev => prev.map(n => ({ ...n, read: true })));
      broadcastChange();
      showToast('ok:Toate notificările au fost marcate ca citite.');
      if (filter === 'unread') fetchPage(1, true);
    } catch {
      showToast('error:Eroare de conexiune.');
    } finally {
      setBulkBusy(false);
    }
  };

  /* Click pe notificare → marchează citită + navighează la subiect */
  const openTarget = async (notif) => {
    if (!notif.read) markRead(notif._id, true, true);
    const link = notif.link;
    if (!link || link === '/' || link === '') {
      showToast('info:Această notificare nu are o pagină asociată.');
      return;
    }
    navigate(link);
  };

  const unreadVisible = useMemo(() => items.filter(n => !n.read).length, [items]);
  const groups = useMemo(() => groupByTime(items), [items]);
  const isFiltered = filter !== 'all' || !!debouncedSearch;

  return (
    <div className="page">
      <div className="container-md" style={{ maxWidth: 760 }}>

        {/* Header */}
        <div className="nc-header">
          <div>
            <h1 className="nc-title">Notificări</h1>
            <p className="nc-subtitle">
              Urmărește actualizările importante despre licitații, oferte, documente și contul tău.
            </p>
          </div>
          <div className="nc-header-actions">
            <button className="btn btn-outline btn-sm" onClick={markAllRead} disabled={bulkBusy || items.length === 0}>
              {bulkBusy ? 'Se procesează...' : '✓ Marchează toate citite'}
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`nc-toast nc-toast-${toast.split(':')[0]}`}>
            <span>{toast.replace(/^(ok|error|info):/, '')}</span>
            <button onClick={() => setToast('')} aria-label="Închide">✕</button>
          </div>
        )}

        {/* Filtre + search */}
        <div className="nc-controls">
          <div className="nc-filters">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`nc-filter ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="nc-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Caută în notificări..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="nc-search-clear" onClick={() => setSearch('')} aria-label="Șterge căutarea">✕</button>}
          </div>
        </div>

        {/* Conținut */}
        {loading ? (
          <div className="nc-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="nc-skel">
                <div className="skeleton nc-skel-icon" />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skel-line" style={{ width: '40%' }} />
                  <div className="skeleton skel-line" style={{ width: '85%', marginTop: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <p className="empty-state-title">A apărut o eroare</p>
            <p className="empty-state-text">{error}</p>
            <button className="btn btn-primary" onClick={() => fetchPage(1, true)}>Reîncearcă</button>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{isFiltered ? '🔎' : '🔔'}</div>
            <p className="empty-state-title">
              {isFiltered ? 'Niciun rezultat' : 'Nu ai notificări încă'}
            </p>
            <p className="empty-state-text">
              {isFiltered
                ? 'Încearcă alt filtru sau alt termen de căutare.'
                : 'Actualizările despre licitații, oferte și contul tău vor apărea aici.'}
            </p>
            {isFiltered ? (
              <button className="btn btn-outline" onClick={() => { setFilter('all'); setSearch(''); }}>
                Resetează filtrele
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                Înapoi la dashboard
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="nc-count">
              {total} {total === 1 ? 'notificare' : 'notificări'}
              {unreadVisible > 0 && ` · ${unreadVisible} necitite afișate`}
            </p>

            <div className="nc-list">
              {groups.map(group => (
                <div key={group.key} className="nc-group">
                  <p className="nc-group-label">{group.label}</p>
                  {group.items.map(notif => {
                    const meta = metaFor(notif.type);
                    const cat  = CAT_META[meta.cat] || CAT_META.sistem;
                    const isSelected = notif._id === selectedId;
                    return (
                      <div
                        key={notif._id}
                        ref={el => { itemRefs.current[notif._id] = el; }}
                        className={`nc-item ${notif.read ? '' : 'unread'} ${isSelected ? 'selected' : ''}`}
                        onClick={() => openTarget(notif)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter') openTarget(notif); }}
                      >
                        <span className="nc-item-icon" style={{ background: cat.bg }}>{meta.icon}</span>

                        <div className="nc-item-body">
                          <div className="nc-item-top">
                            <span className="nc-item-title">{meta.title}</span>
                            <span className="nc-item-badge" style={{ background: cat.bg, color: cat.color }}>
                              {cat.label}
                            </span>
                            {!notif.read && <span className="nc-item-dot" title="Necitită" />}
                          </div>
                          <p className="nc-item-text">{notif.text}</p>
                          <div className="nc-item-meta">
                            <span title={fullDateTime(notif.createdAt)}>{timeAgo(notif.createdAt)}</span>
                            <span className="nc-item-cta">Vezi detalii →</span>
                          </div>
                        </div>

                        <div className="nc-item-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className="nc-act-btn"
                            disabled={busyId === notif._id}
                            title={notif.read ? 'Marchează ca necitită' : 'Marchează ca citită'}
                            onClick={() => markRead(notif._id, !notif.read)}
                          >
                            {notif.read ? '○' : '✓'}
                          </button>
                          <button
                            className="nc-act-btn nc-act-del"
                            disabled={busyId === notif._id}
                            title="Șterge notificarea"
                            onClick={() => deleteNotif(notif._id)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {page < pages && (
              <div className="nc-more">
                <button className="btn btn-outline" onClick={() => fetchPage(page + 1, false)} disabled={loadingMore}>
                  {loadingMore ? 'Se încarcă...' : 'Încarcă mai multe'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <style>{ncCSS}</style>
    </div>
  );
}

const ncCSS = `
.nc-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 16px; margin-bottom: 1.25rem; flex-wrap: wrap;
}
.nc-title { font-size: 1.5rem; font-weight: 800; color: var(--primary-navy); margin: 0 0 4px; letter-spacing: -0.02em; }
.nc-subtitle { font-size: 0.875rem; color: var(--text-muted); margin: 0; max-width: 460px; line-height: 1.5; }
.nc-header-actions { display: flex; gap: 8px; flex-shrink: 0; }

.nc-toast {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: var(--radius-md); margin-bottom: 1rem;
  font-size: 0.875rem; border: 1px solid;
}
.nc-toast-ok    { background: #ECFDF5; color: #065F46; border-color: #6EE7B7; }
.nc-toast-error { background: #FEF2F2; color: #991B1B; border-color: #FCA5A5; }
.nc-toast-info  { background: var(--ice-blue); color: var(--primary-navy); border-color: var(--border); }
.nc-toast button { background: none; border: none; cursor: pointer; color: inherit; font-size: 0.875rem; padding: 0 2px; }

.nc-controls { margin-bottom: 1rem; display: flex; flex-direction: column; gap: 10px; }
.nc-filters {
  display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;
  scrollbar-width: thin;
}
.nc-filters::-webkit-scrollbar { height: 4px; }
.nc-filters::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
.nc-filter {
  flex-shrink: 0; padding: 6px 13px; border-radius: var(--radius-full);
  border: 1px solid var(--border); background: var(--bg-card);
  font-size: 0.8125rem; font-weight: 600; color: var(--text-muted); cursor: pointer;
  font-family: var(--font-sans); transition: all var(--transition-fast); white-space: nowrap;
}
.nc-filter:hover { border-color: var(--bid-teal); color: var(--bid-teal); }
.nc-filter.active { background: var(--bid-teal); border-color: var(--bid-teal); color: #fff; }

.nc-search {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-md);
  background: var(--bg-card);
}
.nc-search:focus-within { border-color: var(--bid-teal); box-shadow: 0 0 0 3px rgba(0,169,157,0.12); }
.nc-search svg { color: var(--text-muted); flex-shrink: 0; }
.nc-search input {
  flex: 1; border: none; outline: none; background: none;
  font-size: 0.875rem; font-family: var(--font-sans); color: var(--text-heading);
}
.nc-search-clear { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.8125rem; }

.nc-count { font-size: 0.75rem; color: var(--text-muted); margin: 0 0 10px; font-weight: 600; }

.nc-list { display: flex; flex-direction: column; gap: 16px; }
.nc-group { display: flex; flex-direction: column; gap: 8px; }
.nc-group-label {
  font-size: 0.6875rem; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 2px;
}

.nc-item {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 13px 14px; background: var(--bg-card);
  border: 1px solid var(--border-light); border-radius: var(--radius-md);
  cursor: pointer; transition: background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.nc-item:hover { background: var(--ice-blue); border-color: var(--border); }
.nc-item.unread { background: #F4FBFB; border-color: #BFE9E5; }
.nc-item.selected {
  border-color: var(--bid-teal); background: var(--soft-aqua);
  box-shadow: 0 0 0 3px rgba(0,169,157,0.2);
  animation: ncPulse 2.4s ease;
}
@keyframes ncPulse {
  0%   { box-shadow: 0 0 0 0 rgba(0,169,157,0.5); }
  40%  { box-shadow: 0 0 0 7px rgba(0,169,157,0); }
  100% { box-shadow: 0 0 0 3px rgba(0,169,157,0.2); }
}

.nc-item-icon {
  width: 38px; height: 38px; border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.0625rem; flex-shrink: 0;
}
.nc-item-body { flex: 1; min-width: 0; }
.nc-item-top { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 3px; }
.nc-item-title { font-size: 0.875rem; font-weight: 700; color: var(--text-heading); }
.nc-item-badge {
  font-size: 0.625rem; font-weight: 700; padding: 2px 7px;
  border-radius: var(--radius-full); text-transform: uppercase; letter-spacing: 0.03em;
}
.nc-item-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--bid-teal); flex-shrink: 0; }
.nc-item-text { font-size: 0.8125rem; color: var(--text-body); margin: 0 0 5px; line-height: 1.5; }
.nc-item-meta {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.6875rem; color: var(--text-muted);
}
.nc-item-cta { color: var(--action-blue); font-weight: 600; }

.nc-item-actions { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
.nc-act-btn {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg-card);
  color: var(--text-muted); cursor: pointer; font-size: 0.8125rem;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--transition-fast);
}
.nc-act-btn:hover:not(:disabled) { border-color: var(--bid-teal); color: var(--bid-teal); background: var(--ice-blue); }
.nc-act-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.nc-act-del:hover:not(:disabled) { border-color: var(--error-red); color: var(--error-red); background: #FEF2F2; }

.nc-skel { display: flex; gap: 12px; padding: 13px 14px; border: 1px solid var(--border-light); border-radius: var(--radius-md); }
.nc-skel-icon { width: 38px; height: 38px; border-radius: var(--radius-md); flex-shrink: 0; }

.nc-more { display: flex; justify-content: center; margin-top: 16px; }

@media (max-width: 560px) {
  .nc-header { flex-direction: column; }
  .nc-header-actions { width: 100%; }
  .nc-header-actions .btn { width: 100%; }
  .nc-item-actions { flex-direction: row; }
}
`;
