import { useEffect, useState, useCallback } from 'react';
import { useAuth }    from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_URL }    from '../config';
import { fmtDeadline } from '../utils/format';

// Câmpuri marcate ca importante în diff view (le evidențiem vizual)
const IMPORTANT = new Set(['targetPrice', 'deadline', 'location', 'category', 'description', 'quantity']);

// Label-uri human-readable pentru câmpuri
const FIELD_LABELS = {
  title:       'Titlu',
  description: 'Descriere',
  category:    'Categorie',
  quantity:    'Cantitate',
  tags:        'Taguri',
  targetPrice: 'Preț țintă (RON)',
  deadline:    'Deadline',
  autoExtend:  'Auto-extend',
  location:    'Locație',
};

function formatFieldValue(field, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (field === 'deadline') return fmtDeadline(val, '—');
  if (field === 'autoExtend') return val ? 'Da' : 'Nu';
  if (field === 'tags') return Array.isArray(val) ? val.join(', ') || '—' : val;
  if (field === 'location' && typeof val === 'object') return val.address || val.city || JSON.stringify(val);
  return String(val);
}

/* ─── DiffView — comparatie vizuala vechi vs nou ─────────────── */
function DiffView({ currentData, proposedData, bidCount }) {
  if (!proposedData) return null;
  const changedFields = Object.keys(proposedData).filter(
    f => JSON.stringify(proposedData[f]) !== JSON.stringify(currentData?.[f])
  );
  if (changedFields.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Nicio diferență detectată.</p>;

  return (
    <div>
      {bidCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FEF3C7', borderRadius: 'var(--radius-md)', marginBottom: 12, border: '1px solid #FDE68A' }}>
          <span style={{ fontSize: '1rem' }}>⚠️</span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#92400E' }}>
            Licitația are {bidCount} {bidCount === 1 ? 'ofertă existentă' : 'oferte existente'} — verifică impactul modificărilor
          </span>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr>
            {['Câmp', 'Valoare curentă', 'Valoare propusă'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {changedFields.map(field => {
            const isImportant = IMPORTANT.has(field);
            return (
              <tr key={field} style={{ background: isImportant ? '#FFFBEB' : 'transparent' }}>
                <td style={{ padding: '7px 8px', fontWeight: 600, color: isImportant ? '#92400E' : 'var(--text-heading)', whiteSpace: 'nowrap' }}>
                  {isImportant && '⚠️ '}{FIELD_LABELS[field] || field}
                </td>
                <td style={{ padding: '7px 8px', color: 'var(--text-muted)', maxWidth: 180, wordBreak: 'break-word' }}>
                  <span style={{ background: '#FEE2E2', borderRadius: 4, padding: '1px 5px', textDecoration: 'line-through', color: '#991B1B' }}>
                    {formatFieldValue(field, currentData?.[field])}
                  </span>
                </td>
                <td style={{ padding: '7px 8px', maxWidth: 180, wordBreak: 'break-word' }}>
                  <span style={{ background: '#D1FAE5', borderRadius: 4, padding: '1px 5px', color: '#065F46', fontWeight: 600 }}>
                    {formatFieldValue(field, proposedData[field])}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── RejectModal ─────────────────────────────────────────────── */
function RejectModal({ request, onConfirm, onClose, loading }) {
  const [note, setNote] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 8px' }}>❌ Respinge cererea</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Cerere de <strong>{request.type === 'edit' ? 'editare' : 'ștergere'}</strong> pentru <strong>"{request.auction?.title}"</strong>
        </p>
        <div className="form-group">
          <label className="form-label">Motivul respingerii (opțional)</label>
          <textarea className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Explică buyerului de ce respecți cererea..." style={{ height: 80, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button className="btn btn-outline" onClick={onClose}>Anulează</button>
          <button className="btn btn-danger" onClick={() => onConfirm(note)} disabled={loading}>
            {loading ? 'Se procesează...' : 'Respinge cererea'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── DetailModal — diff view expandat ───────────────────────── */
function DetailModal({ request, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div className="card" style={{ maxWidth: 600, width: '100%', padding: '1.5rem', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>
              {request.type === 'edit' ? '✏️ Cerere editare' : '🗑️ Cerere ștergere'}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              {request.auction?.title} · {new Date(request.createdAt).toLocaleString('ro-RO')}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: '0.8125rem', margin: '0 0 4px' }}><strong>Buyer:</strong> {request.buyer?.firstName} {request.buyer?.lastName} ({request.buyer?.email})</p>
          {request.reason && <p style={{ fontSize: '0.8125rem', margin: '0 0 4px' }}><strong>Motivul buyerului:</strong> {request.reason}</p>}
          {request.adminNote && <p style={{ fontSize: '0.8125rem', margin: '0 0 4px' }}><strong>Nota admin:</strong> {request.adminNote}</p>}
          {request.reviewedBy && <p style={{ fontSize: '0.8125rem', margin: '0 0 4px' }}><strong>Recenzat de:</strong> {request.reviewedBy?.firstName} {request.reviewedBy?.lastName} la {new Date(request.reviewedAt).toLocaleString('ro-RO')}</p>}
        </div>

        {request.type === 'edit' && (
          <>
            <h4 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 10 }}>Modificări propuse</h4>
            <DiffView currentData={request.currentData} proposedData={request.proposedData} bidCount={request.bidCount} />
          </>
        )}

        {request.type === 'delete' && request.bidCount > 0 && (
          <div style={{ padding: '10px 14px', background: '#FEF3C7', borderRadius: 'var(--radius-md)', border: '1px solid #FDE68A' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#92400E' }}>
              ⚠️ Licitația are {request.bidCount} {request.bidCount === 1 ? 'ofertă existentă' : 'oferte existente'}. Ștergerea va fi soft (status = cancelled) — datele se păstrează.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const { token, user } = useAuth();
  const navigate        = useNavigate();
  const [tab,      setTab]      = useState('users');
  const [users,    setUsers]    = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading,  setLoading]  = useState(true);

  // Cereri — filtre
  const [reqTypeFilter,   setReqTypeFilter]   = useState('all');
  const [reqStatusFilter, setReqStatusFilter] = useState('pending');

  // Modals
  const [rejectModal,  setRejectModal]  = useState(null);  // request object
  const [detailModal,  setDetailModal]  = useState(null);  // request object
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/dashboard'); return; }
    if (tab === 'users')    fetchUsers();
    if (tab === 'auctions') fetchAuctions();
    if (tab === 'requests') fetchRequests();
    if (tab === 'invoices') fetchInvoices();
  }, [tab]);

  const fetchUsers    = async () => {
    setLoading(true);
    try {
      // Endpoint paginat — pentru compatibilitate suportăm ambele formate de răspuns
      const res = await fetch(`${API_URL}/api/admin/users?page=1&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : (data.data || []));
    } finally {
      setLoading(false);
    }
  };
  const fetchAuctions = async () => { setLoading(true); try { const res = await fetch(`${API_URL}/api/admin/auctions`, { headers: { Authorization: `Bearer ${token}` } }); setAuctions(await res.json()); } finally { setLoading(false); } };
  const fetchInvoices = async () => { setLoading(true); try { const res = await fetch(`${API_URL}/api/admin/invoices`, { headers: { Authorization: `Bearer ${token}` } }); setInvoices(await res.json()); } finally { setLoading(false); } };

  const downloadAdminInvoice = async (inv) => {
    if (!inv.auction?._id) return;
    try {
      const res = await fetch(`${API_URL}/api/invoices/auction/${inv.auction._id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `RevBid-${inv.invoiceNumber}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  };
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (reqTypeFilter !== 'all')     params.append('type',   reqTypeFilter);
      if (reqStatusFilter !== 'all')   params.append('status', reqStatusFilter);
      const res  = await fetch(`${API_URL}/api/auction-requests?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      setRequests(await res.json());
    } finally { setLoading(false); }
  };

  // Refetch cereri când se schimbă filtrele
  useEffect(() => { if (tab === 'requests') fetchRequests(); }, [reqTypeFilter, reqStatusFilter]);

  const banUser       = async (userId, isBanned) => { await fetch(`${API_URL}/api/admin/users/${userId}/ban`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ isBanned: !isBanned }) }); fetchUsers(); };
  const closeAuction  = async (auctionId) => { await fetch(`${API_URL}/api/admin/auctions/${auctionId}/close`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }); fetchAuctions(); };

  const approveRequest = async (requestId) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auction-requests/${requestId}/approve`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setRequests(prev => prev.map(r => r._id === requestId ? { ...r, status: 'approved' } : r));
      }
    } finally { setActionLoading(false); }
  };

  const rejectRequest = async (requestId, adminNote) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auction-requests/${requestId}/reject`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ adminNote }),
      });
      if (res.ok) {
        setRequests(prev => prev.map(r => r._id === requestId ? { ...r, status: 'rejected', adminNote } : r));
        setRejectModal(null);
      }
    } finally { setActionLoading(false); }
  };

  const roleBadge    = r => ({ buyer: 'badge-blue', supplier: 'badge-teal', admin: 'badge-navy' }[r] || 'badge-gray');
  const statusBadge  = s => ({ active: 'badge-solid-teal', closed: 'badge-solid-gray', cancelled: 'badge-solid-red', draft: 'badge-solid-amber' }[s] || 'badge-solid-gray');
  const reqStatusBadge = s => ({ pending: '#FEF3C7|#92400E', approved: '#D1FAE5|#065F46', rejected: '#FEE2E2|#991B1B', cancelled: '#F3F4F6|#6B7280' }[s] || '#F3F4F6|#6B7280');

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">⚙️ Panou Admin</h1>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/dashboard')}>← Înapoi</button>
        </div>

        {/* Stats */}
        <div className="stats-grid stats-grid-4">
          <div className="stat-card"><p className="stat-value" style={{ color: 'var(--action-blue)' }}>{users.length}</p><p className="stat-label">Total useri</p></div>
          <div className="stat-card"><p className="stat-value" style={{ color: 'var(--error-red)' }}>{users.filter(u => u.isBanned).length}</p><p className="stat-label">Useri banați</p></div>
          <div className="stat-card"><p className="stat-value" style={{ color: 'var(--bid-teal)' }}>{auctions.filter(a => a.status === 'active').length}</p><p className="stat-label">Licitații active</p></div>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setTab('requests')}>
            <p className="stat-value" style={{ color: pendingCount > 0 ? 'var(--warning-amber)' : 'var(--text-muted)' }}>{pendingCount}</p>
            <p className="stat-label">Cereri în așteptare</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn ${tab === 'users'    ? 'active' : ''}`} onClick={() => setTab('users')}>Useri</button>
          <button className={`tab-btn ${tab === 'auctions' ? 'active' : ''}`} onClick={() => setTab('auctions')}>Licitații</button>
          <button className={`tab-btn ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
            Cereri
            {pendingCount > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--warning-amber)', color: '#fff', fontSize: '0.6875rem', fontWeight: 700, borderRadius: '999px', padding: '1px 6px' }}>{pendingCount}</span>
            )}
          </button>
          <button className={`tab-btn ${tab === 'invoices' ? 'active' : ''}`} onClick={() => setTab('invoices')}>Documente</button>
        </div>

        {/* ─── Tab: USERI ─────────────────────────────────────── */}
        {loading && <p className="loading-text">Se încarcă...</p>}

        {!loading && tab === 'users' && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{['Nume','Email','Rol','Înregistrat','Status','Acțiuni'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 500 }}>{u.firstName} {u.lastName}</td>
                    <td>{u.email}</td>
                    <td><span className={`badge ${roleBadge(u.role)}`}>{u.role}</span></td>
                    <td>{new Date(u.createdAt).toLocaleDateString('ro-RO')}</td>
                    <td><span className={`badge ${u.isBanned ? 'badge-solid-red' : 'badge-solid-green'}`}>{u.isBanned ? 'Banat' : 'Activ'}</span></td>
                    <td><button className={`btn btn-sm ${u.isBanned ? 'btn-primary' : 'btn-danger'}`} onClick={() => banUser(u._id, u.isBanned)}>{u.isBanned ? 'Debaneaza' : 'Baneaza'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Tab: LICITAȚII ─────────────────────────────────── */}
        {!loading && tab === 'auctions' && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{['Titlu','Buyer','Preț curent','Status','Deadline','Acțiuni'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {auctions.map(a => (
                  <tr key={a._id}>
                    <td style={{ fontWeight: 500 }}>{a.title}</td>
                    <td>{a.buyer?.firstName} {a.buyer?.lastName}</td>
                    <td style={{ fontWeight: 600, color: 'var(--bid-teal)' }}>{a.currentPrice} RON</td>
                    <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                    <td>{a.deadline ? new Date(a.deadline).toLocaleDateString('ro-RO') : '—'}</td>
                    <td>{a.status === 'active' && <button className="btn btn-danger btn-sm" onClick={() => closeAuction(a._id)}>Închide</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Tab: CERERI ────────────────────────────────────── */}
        {!loading && tab === 'requests' && (
          <div>
            {/* Filtre */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {['all','edit','delete'].map(f => (
                  <button key={f} onClick={() => setReqTypeFilter(f)}
                    style={{ padding: '5px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', background: reqTypeFilter === f ? 'var(--primary-navy)' : 'var(--bg-card)', color: reqTypeFilter === f ? '#fff' : 'var(--text-body)', transition: 'all 0.15s' }}>
                    {f === 'all' ? 'Toate tipurile' : f === 'edit' ? '✏️ Editare' : '🗑️ Ștergere'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['all','pending','approved','rejected','cancelled'].map(f => (
                  <button key={f} onClick={() => setReqStatusFilter(f)}
                    style={{ padding: '5px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)', background: reqStatusFilter === f ? 'var(--action-blue)' : 'var(--bg-card)', color: reqStatusFilter === f ? '#fff' : 'var(--text-body)', transition: 'all 0.15s' }}>
                    {f === 'all' ? 'Toate statusurile' : f === 'pending' ? '⏳ Pending' : f === 'approved' ? '✅ Aprobate' : f === 'rejected' ? '❌ Respinse' : '↩️ Anulate'}
                  </button>
                ))}
              </div>
            </div>

            {requests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p className="empty-state-title">Nicio cerere găsită</p>
                <p className="empty-state-text">Nu există cereri cu filtrele selectate.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      {['Tip','Licitație','Buyer','Oferte','Dată cerere','Status','Acțiuni'].map(h => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => {
                      const [bg, color] = reqStatusBadge(r.status).split('|');
                      return (
                        <tr key={r._id}>
                          <td>
                            <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                              {r.type === 'edit' ? '✏️ Editare' : '🗑️ Ștergere'}
                            </span>
                          </td>
                          <td style={{ maxWidth: 180 }}>
                            <p style={{ fontWeight: 600, margin: 0, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.auction?.title || '—'}
                            </p>
                            {r.reason && <p style={{ margin: '2px 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Motiv: {r.reason}</p>}
                          </td>
                          <td style={{ fontSize: '0.8125rem' }}>
                            {r.buyer?.firstName} {r.buyer?.lastName}
                            <br /><span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{r.buyer?.email}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {r.bidCount > 0 ? (
                              <span style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                                ⚠️ {r.bidCount}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>0</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                            {new Date(r.createdAt).toLocaleDateString('ro-RO')}
                          </td>
                          <td>
                            <span style={{ display: 'inline-block', background: bg, color, borderRadius: 'var(--radius-full)', padding: '3px 9px', fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${color}22` }}>
                              {r.status}
                            </span>
                            {r.adminNote && <p style={{ margin: '2px 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Notă: {r.adminNote}</p>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <button className="btn btn-sm btn-outline" onClick={() => setDetailModal(r)} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                                🔍 Detalii
                              </button>
                              {r.status === 'pending' && (
                                <>
                                  <button className="btn btn-sm" onClick={() => approveRequest(r._id)} disabled={actionLoading}
                                    style={{ background: 'var(--success-green)', color: '#fff', border: 'none', fontSize: '0.75rem', padding: '4px 8px' }}>
                                    ✅ Aprobă
                                  </button>
                                  <button className="btn btn-sm btn-danger" onClick={() => setRejectModal(r)} disabled={actionLoading}
                                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                                    ❌ Respinge
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: DOCUMENTE ─────────────────────────────────── */}
        {!loading && tab === 'invoices' && (
          invoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <p className="empty-state-title">Niciun document de tranzacție</p>
              <p className="empty-state-text">Rezumatele de tranzacție apar automat când licitațiile cu câștigător se finalizează.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr>{['Nr. document','Licitație','Cumpărător','Furnizor','Sumă','Status','Emailuri','Acțiuni'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv._id}>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>{inv.invoiceNumber}</td>
                      <td style={{ maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.auction?.title || inv.auctionTitle || '—'}</td>
                      <td>{inv.buyer ? `${inv.buyer.firstName} ${inv.buyer.lastName}` : (inv.buyerName || '—')}</td>
                      <td>{inv.supplier ? `${inv.supplier.firstName} ${inv.supplier.lastName}` : (inv.supplierName || '—')}</td>
                      <td style={{ fontWeight: 700, color: 'var(--bid-teal)' }}>{Number(inv.amount).toLocaleString('ro-RO')} {inv.currency}</td>
                      <td><span className="badge badge-navy">{inv.status}</span></td>
                      <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        <span title="Email cumpărător">{inv.emailedAtBuyer ? '✅' : '—'} B</span>{'  '}
                        <span title="Email furnizor">{inv.emailedAtSupplier ? '✅' : '—'} F</span>
                      </td>
                      <td>
                        {inv.auction?._id && (
                          <button className="btn btn-sm btn-outline" onClick={() => downloadAdminInvoice(inv)}>⬇ PDF</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ─── Modals ─────────────────────────────────────────────── */}
      {rejectModal && (
        <RejectModal
          request={rejectModal}
          loading={actionLoading}
          onConfirm={(note) => rejectRequest(rejectModal._id, note)}
          onClose={() => setRejectModal(null)}
        />
      )}
      {detailModal && (
        <DetailModal request={detailModal} onClose={() => setDetailModal(null)} />
      )}
    </div>
  );
}