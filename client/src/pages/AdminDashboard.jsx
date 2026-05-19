import { useEffect, useState } from 'react';
import { useAuth }             from '../context/AuthContext';
import { useNavigate }         from 'react-router-dom';
import { API_URL }             from '../config';

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const navigate        = useNavigate();
  const [tab,      setTab]      = useState('users');
  const [users,    setUsers]    = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (user?.role !== 'admin') { navigate('/dashboard'); return; }
    if (tab === 'users')    fetchUsers();
    if (tab === 'auctions') fetchAuctions();
  }, [tab]);

  const fetchUsers = async () => {
    setLoading(true);
    try { const res = await fetch(`${API_URL}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } }); setUsers(await res.json()); }
    finally { setLoading(false); }
  };
  const fetchAuctions = async () => {
    setLoading(true);
    try { const res = await fetch(`${API_URL}/api/admin/auctions`, { headers: { Authorization: `Bearer ${token}` } }); setAuctions(await res.json()); }
    finally { setLoading(false); }
  };
  const banUser = async (userId, isBanned) => {
    await fetch(`${API_URL}/api/admin/users/${userId}/ban`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ isBanned: !isBanned }) });
    fetchUsers();
  };
  const closeAuction = async (auctionId) => {
    await fetch(`${API_URL}/api/admin/auctions/${auctionId}/close`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    fetchAuctions();
  };

  const roleBadge = r => ({ buyer: 'badge-blue', supplier: 'badge-teal', admin: 'badge-navy' }[r] || 'badge-gray');
  const statusBadge = s => ({ active: 'badge-solid-teal', closed: 'badge-solid-gray', cancelled: 'badge-solid-red', draft: 'badge-solid-amber' }[s] || 'badge-solid-gray');

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">⚙️ Panou Admin</h1>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/dashboard')}>← Inapoi</button>
        </div>

        <div className="stats-grid stats-grid-4">
          <div className="stat-card"><p className="stat-value" style={{ color: 'var(--action-blue)' }}>{users.length}</p><p className="stat-label">Total useri</p></div>
          <div className="stat-card"><p className="stat-value" style={{ color: 'var(--error-red)' }}>{users.filter(u => u.isBanned).length}</p><p className="stat-label">Useri banati</p></div>
          <div className="stat-card"><p className="stat-value" style={{ color: 'var(--bid-teal)' }}>{auctions.filter(a => a.status === 'active').length}</p><p className="stat-label">Licitatii active</p></div>
          <div className="stat-card"><p className="stat-value" style={{ color: 'var(--text-muted)' }}>{auctions.length}</p><p className="stat-label">Licitatii totale</p></div>
        </div>

        <div className="tabs">
          <button className={`tab-btn ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Useri</button>
          <button className={`tab-btn ${tab === 'auctions' ? 'active' : ''}`} onClick={() => setTab('auctions')}>Licitatii</button>
        </div>

        {loading ? (
          <p className="loading-text">Se incarca...</p>
        ) : tab === 'users' ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{['Nume', 'Email', 'Rol', 'Inregistrat', 'Status', 'Actiuni'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 500 }}>{u.firstName} {u.lastName}</td>
                    <td>{u.email}</td>
                    <td><span className={`badge ${roleBadge(u.role)}`}>{u.role}</span></td>
                    <td>{new Date(u.createdAt).toLocaleDateString('ro-RO')}</td>
                    <td><span className={`badge ${u.isBanned ? 'badge-solid-red' : 'badge-solid-green'}`}>{u.isBanned ? 'Banat' : 'Activ'}</span></td>
                    <td>
                      <button className={`btn btn-sm ${u.isBanned ? 'btn-primary' : 'btn-danger'}`} onClick={() => banUser(u._id, u.isBanned)}>
                        {u.isBanned ? 'Debaneaza' : 'Baneaza'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr>{['Titlu', 'Buyer', 'Pret curent', 'Status', 'Deadline', 'Actiuni'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {auctions.map(a => (
                  <tr key={a._id}>
                    <td style={{ fontWeight: 500 }}>{a.title}</td>
                    <td>{a.buyer?.firstName} {a.buyer?.lastName}</td>
                    <td style={{ fontWeight: 600, color: 'var(--bid-teal)' }}>{a.currentPrice} RON</td>
                    <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                    <td>{a.deadline ? new Date(a.deadline).toLocaleDateString('ro-RO') : '—'}</td>
                    <td>
                      {a.status === 'active' && (
                        <button className="btn btn-danger btn-sm" onClick={() => closeAuction(a._id)}>Inchide</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}