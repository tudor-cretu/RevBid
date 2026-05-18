import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuth }             from '../../context/AuthContext';
import AuctionCard             from '../../components/AuctionCard';
import { API_URL }             from '../../config';

export default function BuyerDashboard() {
  const { user, token } = useAuth();
  const navigate        = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('active');

  useEffect(() => {
    fetchMyAuctions();
  }, [filter]);

  const fetchMyAuctions = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auctions?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Filtreaza doar licitatiile create de acest buyer
      setAuctions(data.filter(a => a.buyer._id === user.id || a.buyer === user.id));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Buna, {user.firstName}! 👋</h1>
          <p style={styles.subtitle}>Gestioneaza licitatiile tale</p>
        </div>
        <button style={styles.createBtn} onClick={() => navigate('/auction/create')}>
          + Licitatie noua
        </button>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <StatCard label="Active"    value={auctions.filter(a => a.status === 'active').length}    color="#38a169" />
        <StatCard label="Incheiate" value={auctions.filter(a => a.status === 'closed').length}    color="#3182ce" />
        <StatCard label="Anulate"   value={auctions.filter(a => a.status === 'cancelled').length} color="#e53e3e" />
      </div>

      {/* Filtre */}
      <div style={styles.filters}>
        {['active', 'closed', 'cancelled', 'draft'].map(s => (
          <button
            key={s}
            style={{ ...styles.filterBtn, ...(filter === s ? styles.filterActive : {}) }}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Lista licitatii */}
      {loading ? (
        <p style={styles.loading}>Se incarca...</p>
      ) : auctions.length === 0 ? (
        <div style={styles.empty}>
          <p>Nu ai licitatii cu statusul <strong>{filter}</strong>.</p>
          <button style={styles.createBtn} onClick={() => navigate('/auction/create')}>
            Creeaza prima licitatie
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {auctions.map(a => <AuctionCard key={a._id} auction={a} />)}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={styles.statCard}>
      <p style={{ ...styles.statValue, color }}>{value}</p>
      <p style={styles.statLabel}>{label}</p>
    </div>
  );
}

const styles = {
  page:        { maxWidth: '1100px', margin: '0 auto', padding: '2rem' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  title:       { fontSize: '22px', fontWeight: '700', margin: '0' },
  subtitle:    { color: '#718096', fontSize: '14px', margin: '4px 0 0' },
  createBtn:   { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px' },
  statsGrid:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '1.5rem' },
  statCard:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', textAlign: 'center' },
  statValue:   { fontSize: '28px', fontWeight: '700', margin: '0' },
  statLabel:   { fontSize: '13px', color: '#718096', margin: '4px 0 0' },
  filters:     { display: 'flex', gap: '8px', marginBottom: '1.5rem' },
  filterBtn:   { padding: '6px 16px', border: '1px solid #e2e8f0', borderRadius: '20px', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#718096' },
  filterActive:{ background: '#1a1a1a', color: '#fff', borderColor: '#1a1a1a' },
  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  loading:     { textAlign: 'center', color: '#718096', padding: '2rem' },
  empty:       { textAlign: 'center', padding: '3rem', color: '#718096' },
};