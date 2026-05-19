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

  useEffect(() => { fetchMyAuctions(); }, [filter]);

  const fetchMyAuctions = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auctions?status=${filter}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setAuctions(data.filter(a => a.buyer._id === user.id || a.buyer === user.id));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const counts = {
    active:    auctions.filter(a => a.status === 'active').length,
    closed:    auctions.filter(a => a.status === 'closed').length,
    cancelled: auctions.filter(a => a.status === 'cancelled').length,
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Buna, {user.firstName}! 👋</h1>
            <p className="page-subtitle">Gestioneaza licitatiile tale</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/auction/create')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Licitatie noua
          </button>
        </div>

        {/* Stats */}
        <div className="stats-grid stats-grid-3">
          <div className="stat-card">
            <p className="stat-value" style={{ color: 'var(--bid-teal)' }}>{counts.active}</p>
            <p className="stat-label">Active</p>
          </div>
          <div className="stat-card">
            <p className="stat-value" style={{ color: 'var(--action-blue)' }}>{counts.closed}</p>
            <p className="stat-label">Incheiate</p>
          </div>
          <div className="stat-card">
            <p className="stat-value" style={{ color: 'var(--warning-amber)' }}>{counts.cancelled}</p>
            <p className="stat-label">Anulate</p>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-pills">
          {['active', 'closed', 'cancelled', 'draft'].map(s => (
            <button key={s} className={`filter-pill ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
              {s}
            </button>
          ))}
        </div>

        {/* Auctions */}
        {loading ? (
          <p className="loading-text">Se incarca...</p>
        ) : auctions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p className="empty-state-title">Nu ai licitatii cu statusul "{filter}"</p>
            <p className="empty-state-text">Creeaza prima ta licitatie si lasa furnizorii sa concureze pentru cel mai bun pret.</p>
            <button className="btn btn-primary" onClick={() => navigate('/auction/create')}>
              Creeaza prima licitatie
            </button>
          </div>
        ) : (
          <div className="auction-grid">
            {auctions.map(a => <AuctionCard key={a._id} auction={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}