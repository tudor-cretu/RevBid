import { useNavigate } from 'react-router-dom';

export default function AuctionCard({ auction }) {
  const navigate   = useNavigate();
  const timeLeft   = getTimeLeft(auction.deadline);
  const statusColor = {
    active:    '#38a169',
    closed:    '#718096',
    cancelled: '#e53e3e',
    draft:     '#d69e2e',
  };

  return (
    <div style={styles.card} onClick={() => navigate(`/auction/${auction._id}`)}>
      {auction.images?.[0] && (
        <img
          src={auction.images[0].url}
          alt={auction.title}
          style={styles.image}
        />
      )}
      <div style={styles.body}>
        <div style={styles.topRow}>
          <span style={styles.category}>{auction.category}</span>
          <span style={{ ...styles.status, background: statusColor[auction.status] }}>
            {auction.status}
          </span>
        </div>
        <h3 style={styles.title}>{auction.title}</h3>
        <p style={styles.description}>{auction.description}</p>

        <div style={styles.priceRow}>
          <div>
            <p style={styles.priceLabel}>Pret curent</p>
            <p style={styles.price}>{auction.currentPrice} RON</p>
          </div>
          {auction.targetPrice && (
            <div style={{ textAlign: 'right' }}>
              <p style={styles.priceLabel}>Pret tinta</p>
              <p style={{ ...styles.price, color: '#718096' }}>{auction.targetPrice} RON</p>
            </div>
          )}
        </div>

        {auction.deadline && (
          <p style={styles.deadline}>
            ⏰ {timeLeft}
          </p>
        )}

        {auction.location?.city && (
          <p style={styles.location}>📍 {auction.location.city}</p>
        )}
      </div>
    </div>
  );
}

function getTimeLeft(deadline) {
  if (!deadline) return 'Fara deadline';
  const diff = new Date(deadline) - new Date();
  if (diff <= 0) return 'Expirat';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}z ${h % 24}h`;
  if (h > 0)  return `${h}h ${m}m`;
  return `${m}m`;
}

const styles = {
  card: {
    background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: '10px', overflow: 'hidden',
    cursor: 'pointer', transition: 'box-shadow .2s',
    onMouseEnter: e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)',
  },
  image:       { width: '100%', height: '160px', objectFit: 'cover' },
  body:        { padding: '14px' },
  topRow:      { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  category:    { fontSize: '11px', background: '#EBF8FF', color: '#2B6CB0', padding: '2px 8px', borderRadius: '20px' },
  status:      { fontSize: '11px', color: '#fff', padding: '2px 8px', borderRadius: '20px' },
  title:       { fontSize: '15px', fontWeight: '600', marginBottom: '4px', color: '#1a1a1a' },
  description: { fontSize: '12px', color: '#718096', marginBottom: '10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  priceRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' },
  priceLabel:  { fontSize: '11px', color: '#718096', margin: '0' },
  price:       { fontSize: '18px', fontWeight: '700', color: '#e53e3e', margin: '0' },
  deadline:    { fontSize: '12px', color: '#d69e2e', margin: '4px 0 0' },
  location:    { fontSize: '12px', color: '#718096', margin: '4px 0 0' },
};