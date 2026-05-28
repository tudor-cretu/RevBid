import { useEffect, useState, useMemo } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { useAuth }                      from '../../context/AuthContext';
import StatCard                         from '../../components/StatCard';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { fmtDateOnly }                  from '../../utils/format';
import { API_URL }                      from '../../config';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

/* Formatare RON cu separator de mii. */
const fmtRON = (n) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('ro-RO', { maximumFractionDigits: 0 }) + ' RON';
};

/* Formatare procent. */
const fmtPct = (n) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toFixed(1)}%`;
};

/* Convertește minute → "Xh Ym" / "Xm" / "<1m". */
function fmtMinutes(min) {
  if (!min || !Number.isFinite(min) || min <= 0) return '—';
  if (min < 1) return '<1 minut';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

const PERIODS = [
  { value: '30d', label: 'Ultimele 30 zile' },
  { value: '90d', label: 'Ultimele 90 zile' },
  { value: 'all', label: 'Tot istoricul' },
];

export default function BuyerAnalytics() {
  const { token, user } = useAuth();
  const navigate        = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [period, setPeriod]   = useState('30d');

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/statistici/cumparator?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).message || 'Eroare la încărcare');
        return r.json();
      })
      .then(d => { if (!cancel) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancel) { setError(e.message); setLoading(false); } });
    return () => { cancel = true; };
  }, [token, period]);

  /* ── Chart: savings trend ── */
  const savingsChart = useMemo(() => {
    const trend = data?.savingsTrend || [];
    if (trend.length === 0) return null;
    return {
      data: {
        labels: trend.map(t => fmtDateOnly(t.date)),
        datasets: [{
          label: 'Economii (RON)',
          data: trend.map(t => t.saved),
          borderColor: '#00A99D',
          backgroundColor: 'rgba(0, 169, 157, 0.12)',
          borderWidth: 2.5,
          pointBackgroundColor: '#00A99D',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          tension: 0.35,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#012B55',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 10,
            cornerRadius: 8,
            callbacks: { label: ctx => `${ctx.parsed.y} RON` },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => `${v} RON`, color: '#6B7C86', font: { size: 11 } },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          x: {
            ticks: {
              color: '#6B7C86',
              font: { size: 10 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
            },
            grid: { display: false },
          },
        },
      },
    };
  }, [data]);

  /* ── Chart: top categorii (bar) ── */
  const categoryChart = useMemo(() => {
    const cats = data?.topCategories || [];
    if (cats.length === 0) return null;
    return {
      data: {
        labels: cats.map(c => c.category),
        datasets: [
          {
            label: 'Licitații',
            data: cats.map(c => c.auctionCount),
            backgroundColor: '#0871C4',
            borderRadius: 6,
          },
          {
            label: 'Oferte primite',
            data: cats.map(c => c.bidCount),
            backgroundColor: '#00A99D',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: '#1F3442', font: { size: 12 } } },
          tooltip: {
            backgroundColor: '#012B55',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: {
          y: { beginAtZero: true, ticks: { color: '#6B7C86', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
          x: { ticks: { color: '#6B7C86', font: { size: 11 } }, grid: { display: false } },
        },
      },
    };
  }, [data]);

  if (user?.role !== 'buyer') {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state-icon">🚫</div>
            <p className="empty-state-title">Acces interzis</p>
            <p className="empty-state-text">Această secțiune este disponibilă doar pentru cumpărători.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="page-header">
            <div>
              <h1 className="page-title">Statistici cumpărător</h1>
              <p className="page-subtitle">Se încarcă datele...</p>
            </div>
          </div>
          <div className="stats-grid stats-grid-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rb-stat" style={{ opacity: 0.5, animation: 'pulse 1.5s infinite' }}>
                <span className="rb-stat-icon">⏳</span>
                <div className="rb-stat-main">
                  <span className="rb-stat-value">—</span>
                  <span className="rb-stat-label">Se calculează</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <p className="empty-state-title">Nu am putut încărca statisticile</p>
            <p className="empty-state-text">{error}</p>
            <button className="btn btn-outline" onClick={() => window.location.reload()}>
              Reîncearcă
            </button>
          </div>
        </div>
      </div>
    );
  }

  const s        = data.summary;
  const l30      = data.last30Days;
  const noData   = s.totalAuctionsPublished === 0;

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Statistici cumpărător</h1>
            <p className="page-subtitle">
              Urmărește economiile, performanța licitațiilor și furnizorii cu care colaborezi cel mai des.
            </p>

            {!noData && s.averageSavingsPercent > 0 && (
              <div className="rb-insight">
                <span className="rb-insight-pill is-teal">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
                  </svg>
                  <span>
                    Ai economisit <strong>{fmtPct(l30.savedPercent)}</strong> față de buget {period === 'all' ? 'în total' : 'în ' + PERIODS.find(p => p.value === period)?.label.toLowerCase()}
                  </span>
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="rb-select"
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #D5DEE5',
                background: '#fff',
                color: '#1F3442',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
              ← Înapoi la dashboard
            </button>
          </div>
        </div>

        {noData ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <p className="empty-state-title">Nu există încă suficiente date pentru statistici</p>
            <p className="empty-state-text">
              Creează și finalizează primele licitații pentru a vedea economiile și performanța.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/auction/create')}>
              Creează prima licitație
            </button>
          </div>
        ) : (
          <>
            {/* Stat cards principale */}
            <div className="stats-grid stats-grid-4">
              <StatCard
                icon="won" tone="teal"
                value={fmtRON(s.totalSaved)} label="Total economisit"
                hint={`${fmtPct(s.averageSavingsPercent)} economie medie`}
              />
              <StatCard
                icon="total" tone="navy"
                value={fmtRON(s.totalPublishedBudget)} label="Buget total publicat"
                hint={`${s.totalAuctionsPublished} licitații publicate`}
              />
              <StatCard
                icon="bids" tone="blue"
                value={s.averageBidsPerAuction.toFixed(1)} label="Oferte medii / licitație"
                hint={`${s.bidCountReceived} oferte în total`}
              />
              <StatCard
                icon="clock" tone="amber"
                value={fmtMinutes(s.averageTimeToFirstBidMinutes)} label="Timp până la prima ofertă"
                hint={`${s.auctionsWithBids} licitații cu oferte`}
              />
            </div>

            {/* Stat cards secundare */}
            <div className="stats-grid stats-grid-3" style={{ marginTop: 16 }}>
              <StatCard
                icon="auctions" tone="green"
                value={fmtRON(s.averageFinalPrice)} label="Preț final mediu"
                hint={`vs. ${fmtRON(s.averageBudget)} buget mediu`}
              />
              <StatCard
                icon="won" tone="teal"
                value={s.finalizedWithWinner} label="Licitații finalizate"
                hint="Cu furnizor câștigător"
              />
              <StatCard
                icon="users" tone="blue"
                value={data.favoriteSuppliers?.length || 0} label="Furnizori colaboratori"
                hint="Cu care ai finalizat licitații"
              />
            </div>

            {/* Trend savings + categorii */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16, marginTop: 24 }}>

              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 12 }}>
                  📈 Economii în {period === 'all' ? 'tot istoricul' : 'ultima perioadă'}
                </h3>
                {savingsChart ? (
                  <div style={{ height: 260 }}>
                    <Line data={savingsChart.data} options={savingsChart.options} />
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <p className="empty-state-text" style={{ margin: 0 }}>
                      Nu există încă date suficiente pentru graficul de economii.
                    </p>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 12 }}>
                  📂 Categorii active
                </h3>
                {categoryChart ? (
                  <div style={{ height: 260 }}>
                    <Bar data={categoryChart.data} options={categoryChart.options} />
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <p className="empty-state-text" style={{ margin: 0 }}>
                      Nu există încă licitații categorizate.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Insight pe ultima perioadă */}
            <div className="card" style={{
              marginTop: 24,
              background: 'linear-gradient(135deg, #D8F3F1 0%, #EAF4F7 100%)',
              border: '1px solid rgba(0, 169, 157, 0.25)',
            }}>
              <h3 className="card-title" style={{ marginBottom: 14, color: '#012B55' }}>
                💡 Insight {period === 'all' ? '(tot istoricul)' : period === '30d' ? '(ultimele 30 zile)' : '(ultimele 90 zile)'}
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 14,
              }}>
                <InsightStat label="Licitații create"   value={l30.auctionsCreated} />
                <InsightStat label="Licitații finalizate" value={l30.auctionsCompleted} />
                <InsightStat label="Oferte primite"    value={l30.bidsReceived} />
                <InsightStat label="Economisit"        value={fmtRON(l30.savedAmount)} />
                <InsightStat label="Economisit %"      value={fmtPct(l30.savedPercent)} highlight />
              </div>
            </div>

            {/* Furnizori preferați */}
            <div className="card" style={{ marginTop: 24 }}>
              <h3 className="card-title" style={{ marginBottom: 14 }}>
                ⭐ Furnizori preferați
              </h3>
              {data.favoriteSuppliers?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.favoriteSuppliers.map((sup, idx) => (
                    <div
                      key={sup.supplierId}
                      onClick={() => navigate(`/profile/${sup.supplierId}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: '#F7FAFC',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#EAF4F7'}
                      onMouseLeave={e => e.currentTarget.style.background = '#F7FAFC'}
                    >
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: '#033667', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 14,
                      }}>
                        {sup.avatar
                          ? <img src={sup.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          : (idx + 1)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#1F3442', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sup.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7C86' }}>
                          {sup.collaborations} {sup.collaborations === 1 ? 'colaborare' : 'colaborări'}
                          {sup.averageRating !== null && (
                            <> · ⭐ {Number(sup.averageRating).toFixed(1)} ({sup.reviewCount})</>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 700, color: '#00A99D', whiteSpace: 'nowrap' }}>
                        {fmtRON(sup.totalValue)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p className="empty-state-text" style={{ margin: 0 }}>
                    Furnizorii preferați vor apărea după ce finalizezi colaborări.
                  </p>
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  );
}

function InsightStat({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#6B7C86', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{
        fontSize: highlight ? 26 : 22,
        fontWeight: 700,
        color: highlight ? '#00A99D' : '#012B55',
      }}>
        {value}
      </div>
    </div>
  );
}
