import { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { API_URL } from '../config';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/**
 * PriceChart
 *
 * Sursa de adevăr pentru oferte:
 *  - dacă părintele pasează `bids` (cazul din AuctionDetail, unde ofertele
 *    sunt deja menținute live prin socket `new_bid`), chart-ul reflectă
 *    imediat orice schimbare — fără refresh, fără fetch suplimentar.
 *  - dacă `bids` nu e pasat, facem fallback la fetch propriu (util când
 *    componenta e folosită izolat în alt context).
 */
export default function PriceChart({ auctionId, startPrice, currentPrice, bids: bidsProp }) {
  const [bidsLocal, setBidsLocal] = useState([]);
  /* Dacă părintele controlează ofertele, folosim props; altfel state local. */
  const bids = Array.isArray(bidsProp) ? bidsProp : bidsLocal;

  useEffect(() => {
    /* Skip fetch dacă părintele deja furnizează bids. */
    if (Array.isArray(bidsProp)) return;
    if (!auctionId) return;
    /* Auth via cookie httpOnly — credentials: 'include' adăugat global. */
    fetch(`${API_URL}/api/bids/${auctionId}`)
      .then(r => r.json())
      .then(data => setBidsLocal(Array.isArray(data) ? data : []));
  }, [auctionId, bidsProp]);

  if (bids.length === 0) {
    return (
      <div className="card">
        <div className="empty-state" style={{ padding: '2rem' }}>
          <div className="empty-state-icon">📊</div>
          <p className="empty-state-title">Nicio ofertă încă</p>
          <p className="empty-state-text">Graficul apare după prima ofertă depusă.</p>
        </div>
      </div>
    );
  }

  const sorted = [...bids].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const labels = ['Start', ...sorted.map((_, i) => `Oferta ${i + 1}`)];
  const prices = [startPrice, ...sorted.map(b => b.amount)];
  const dropPercent = Math.round((1 - currentPrice / startPrice) * 100);

  const data = {
    labels,
    datasets: [{
      label: 'Preț (RON)',
      data: prices,
      borderColor: '#00A99D',
      backgroundColor: 'rgba(0, 169, 157, 0.08)',
      borderWidth: 2.5,
      pointBackgroundColor: prices.map((_, i) => i === prices.length - 1 ? '#00A99D' : '#fff'),
      pointBorderColor: '#00A99D',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.35,
      fill: true,
    }],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#012B55',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        cornerRadius: 8,
        callbacks: { label: ctx => `${ctx.parsed.y} RON` }
      }
    },
    scales: {
      y: {
        reverse: true,
        ticks: { callback: v => `${v} RON`, color: '#6B7C86', font: { size: 12, family: 'Inter' } },
        grid: { color: 'rgba(0,0,0,0.04)' },
      },
      x: {
        ticks: { color: '#6B7C86', font: { size: 11, family: 'Inter' } },
        grid: { display: false },
      }
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
        <h3 className="card-title">📉 Evolutia pretului</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Start: <strong style={{ color: 'var(--text-body)' }}>{startPrice} RON</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>→</span>
          <span style={{ color: 'var(--bid-teal)', fontWeight: 600 }}>Curent: {currentPrice} RON</span>
          <span className="badge badge-teal">↓ {dropPercent}%</span>
        </div>
      </div>
      <Line data={data} options={options} />
    </div>
  );
}