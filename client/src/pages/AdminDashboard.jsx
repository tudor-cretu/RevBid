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
    try {
      const res  = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data);
    } finally { setLoading(false); }
  };

  const fetchAuctions = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/admin/auctions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAuctions(data);
    } finally { setLoading(false); }
  };

  const banUser = async (userId, isBanned) => {
    await fetch(`${API_URL}/api/admin/users/${userId}/ban`, {
      method:  'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({ isBanned: !isBanned }),
    });
    fetchUsers();
  };

  const closeAuction = async (auctionId) => {
    await fetch(`${API_URL}/api/admin/auctions/${auctionId}/close`, {
      method:  'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchAuctions();
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Panou Admin</h1>
        <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>
          ← Inapoi
        </button>
      </div>

      {/* Stats rapide */}
      <div style={styles.statsGrid}>
        <StatCard label="Total useri"     value={users.length}                                        color="#3182ce" />
        <StatCard label="Useri banati"    value={users.filter(u => u.isBanned).length}                color="#e53e3e" />
        <StatCard label="Licitatii active" value={auctions.filter(a => a.status === 'active').length} color="#38a169" />
        <StatCard label="Licitatii totale" value={auctions.length}                                    color="#718096" />
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(tab === 'users' ? styles.tabActive : {}) }}
          onClick={() => setTab('users')}
        >
          Useri
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'auctions' ? styles.tabActive : {}) }}
          onClick={() => setTab('auctions')}
        >
          Licitatii
        </button>
      </div>

      {loading ? (
        <p style={styles.loading}>Se incarca...</p>
      ) : tab === 'users' ? (

        // ── Tabel useri ───────────────────────────────────────────────
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Nume', 'Email', 'Rol', 'Inregistrat', 'Status', 'Actiuni'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} style={styles.tr}>
                  <td style={styles.td}>{u.firstName} {u.lastName}</td>
                  <td style={styles.td}>{u.email}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: roleColor(u.role) }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {new Date(u.createdAt).toLocaleDateString('ro-RO')}
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: u.isBanned ? '#e53e3e' : '#38a169' }}>
                      {u.isBanned ? 'Banat' : 'Activ'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button
                      style={{ ...styles.actionBtn, background: u.isBanned ? '#38a169' : '#e53e3e' }}
                      onClick={() => banUser(u._id, u.isBanned)}
                    >
                      {u.isBanned ? 'Debaneaza' : 'Baneaza'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      ) : (

        // ── Tabel licitatii ───────────────────────────────────────────
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Titlu', 'Buyer', 'Pret curent', 'Status', 'Deadline', 'Actiuni'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auctions.map(a => (
                <tr key={a._id} style={styles.tr}>
                  <td style={styles.td}>{a.title}</td>
                  <td style={styles.td}>{a.buyer?.firstName} {a.buyer?.lastName}</td>
                  <td style={styles.td}>{a.currentPrice} RON</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, background: statusColor(a.status) }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {a.deadline
                      ? new Date(a.deadline).toLocaleDateString('ro-RO')
                      : '—'}
                  </td>
                  <td style={styles.td}>
                    {a.status === 'active' && (
                      <button
                        style={{ ...styles.actionBtn, background: '#e53e3e' }}
                        onClick={() => closeAuction(a._id)}
                      >
                        Inchide
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={styles.statCard}>
      <p style={{ fontSize: '28px', fontWeight: '700', color, margin: '0' }}>{value}</p>
      <p style={{ fontSize: '13px', color: '#718096', margin: '4px 0 0' }}>{label}</p>
    </div>
  );
}

const roleColor   = r => ({ buyer: '#3182ce', supplier: '#38a169', admin: '#805ad5' }[r] || '#718096');
const statusColor = s => ({ active: '#38a169', closed: '#718096', cancelled: '#e53e3e', draft: '#d69e2e' }[s]);

const styles = {
  page:      { maxWidth: '1200px', margin: '0 auto', padding: '2rem' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  title:     { fontSize: '22px', fontWeight: '700', margin: '0' },
  backBtn:   { background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: '#718096' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '1.5rem' },
  statCard:  { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', textAlign: 'center' },
  tabs:      { display: 'flex', gap: '4px', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' },
  tab:       { padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: '#718096', borderBottom: '2px solid transparent', marginBottom: '-1px' },
  tabActive: { color: '#1a1a1a', fontWeight: '600', borderBottom: '2px solid #1a1a1a' },
  tableWrap: { overflowX: 'auto', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th:        { padding: '12px 16px', textAlign: 'left', color: '#718096', fontWeight: '600', borderBottom: '1px solid #e2e8f0', background: '#f7f8fa' },
  tr:        { borderBottom: '1px solid #f0f0f0' },
  td:        { padding: '12px 16px', color: '#1a1a1a' },
  badge:     { fontSize: '11px', color: '#fff', padding: '2px 8px', borderRadius: '20px' },
  actionBtn: { fontSize: '12px', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' },
  loading:   { textAlign: 'center', color: '#718096', padding: '2rem' },
};