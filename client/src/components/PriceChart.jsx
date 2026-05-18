import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { API_URL } from '../config';

ChartJS.register(
  CategoryScale, LinearScale,
  PointElement, LineElement,
  Title, Tooltip, Legend, Filler
);

export default function PriceChart({ auctionId, startPrice, currentPrice }) {
  const [bids, setBids] = useState([]);

  useEffect(() => {
    if (!auctionId) return;
    fetch(`${API_URL}/api/bids/${auctionId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('revbid_token')}` }
    })
      .then(r => r.json())
      .then(data => setBids(Array.isArray(data) ? data : []));
  }, [auctionId]);

  if (bids.length === 0) {
    return (
      <div style={styles.empty}>
        <p>Nicio oferta inca — graficul apare dupa prima oferta.</p>
      </div>
    );
  }

  // Sorteaza cronologic si construieste datele
  const sorted = [...bids].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const labels = [
    'Start',
    ...sorted.map((_, i) => `Oferta ${i + 1}`)
  ];

  const prices = [
    startPrice,
    ...sorted.map(b => b.amount)
  ];

  const data = {
    labels,
    datasets: [{
      label:           'Pret (RON)',
      data:            prices,
      borderColor:     '#e53e3e',
      backgroundColor: 'rgba(229, 62, 62, 0.08)',
      borderWidth:     2,
      pointBackgroundColor: prices.map((_, i) =>
        i === prices.length - 1 ? '#e53e3e' : '#fff'
      ),
      pointBorderColor: '#e53e3e',
      pointRadius:      5,
      tension:          0.3,
      fill:             true,
    }],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.parsed.y} RON`,
        }
      }
    },
    scales: {
      y: {
        reverse: true, // pretul scade — axa Y inversata
        ticks: {
          callback: v => `${v} RON`,
          color: '#718096',
          font: { size: 12 },
        },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: {
        ticks: { color: '#718096', font: { size: 11 } },
        grid:  { display: false },
      }
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <h3 style={styles.title}>Evolutia pretului</h3>
        <div style={styles.stats}>
          <span style={styles.statItem}>
            Start: <strong>{startPrice} RON</strong>
          </span>
          <span style={styles.arrow}>→</span>
          <span style={{ ...styles.statItem, color: '#e53e3e' }}>
            Curent: <strong>{currentPrice} RON</strong>
          </span>
          <span style={styles.drop}>
            ↓ {Math.round((1 - currentPrice / startPrice) * 100)}%
          </span>
        </div>
      </div>
      <Line data={data} options={options} />
    </div>
  );
}

const styles = {
  wrap:     { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' },
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' },
  title:    { fontSize: '15px', fontWeight: '600', margin: '0', color: '#1a1a1a' },
  stats:    { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#718096' },
  statItem: { color: '#4a5568' },
  arrow:    { color: '#a0aec0' },
  drop:     { background: '#FFF5F5', color: '#e53e3e', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  empty:    { background: '#f7f8fa', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem', textAlign: 'center', color: '#718096', fontSize: '13px' },
};