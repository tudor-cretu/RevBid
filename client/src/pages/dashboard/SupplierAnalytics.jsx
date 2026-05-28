import { useEffect, useState, useMemo } from 'react';
import { useNavigate }                  from 'react-router-dom';
import { useAuth }                      from '../../context/AuthContext';
import StatCard                         from '../../components/StatCard';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { fmtDateOnly }                  from '../../utils/format';
import { API_URL }                      from '../../config';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const fmtRON = (n) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('ro-RO', { maximumFractionDigits: 0 }) + ' RON';
};

const fmtPct = (n) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toFixed(1)}%`;
};

const PERIODS = [
  { value: '30d', label: 'Ultimele 30 zile' },
  { value: '90d', label: 'Ultimele 90 zile' },
  { value: 'all', label: 'Tot istoricul' },
];

const STATUS_LABELS = {
  winning:   'Câștigătoare',
  active:    'În desfășurare',
  lost:      'Pierdute',
  cancelled: 'Anulate',
};

const STATUS_COLORS = {
  winning:   '#17B26A',
  active:    '#0871C4',
  lost:      '#DC3545',
  cancelled: '#6B7C86',
};

export default function SupplierAnalytics() {
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
    fetch(`${API_URL}/api/statistici/furnizor?period=${period}`, {
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

  /* ── Distribuția statusurilor (doughnut) ── */
  const statusChart = useMemo(() => {
    const dist = data?.bidStatusDistribution || [];
    const nonZero = dist.filter(d => d.count > 0);
    if (nonZero.length === 0) return null;
    return {
      data: {
        labels: nonZero.map(d => STATUS_LABELS[d.status] || d.status),
        datasets: [{
          data: nonZero.map(d => d.count),
          backgroundColor: nonZero.map(d => STATUS_COLORS[d.status] || '#6B7C86'),
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#1F3442', font: { size: 12 }, padding: 12, usePointStyle: true },
          },
          tooltip: {
            backgroundColor: '#012B55',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 10,
            cornerRadius: 8,
          },
        },
      },
    };
  }, [data]);

  /* ── Categorii — bar chart ── */
  const categoryChart = useMemo(() => {
    const cats = data?.topCategories || [];
    if (cats.length === 0) return null;
    return {
      data: {
        labels: cats.map(c => c.category),
        datasets: [
          {
            label: 'Oferte trimise',
            data: cats.map(c => c.bidsSubmitted),
            backgroundColor: '#0871C4',
            borderRadius: 6,
          },
          {
            label: 'Licitații câștigate',
            data: cats.map(c => c.auctionsWon),
            backgroundColor: '#17B26A',
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

  if (user?.role !== 'supplier') {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <div className="empty-state-icon">🚫</div>
            <p className="empty-state-title">Acces interzis</p>
            <p className="empty-state-text">Această secțiune este disponibilă doar pentru furnizori.</p>
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
              <h1 className="page-title">Statistici furnizor</h1>
              <p className="page-subtitle">Se încarcă datele...</p>
            </div>
          </div>
          <div className="stats-grid stats-grid-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rb-stat" style={{ opacity: 0.5 }}>
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

  const s   = data.summary;
  const l30 = data.last30Days;
  const noData = s.totalBidsSubmitted === 0;

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Statistici furnizor</h1>
            <p className="page-subtitle">
              Analizează ofertele trimise, rata de câștig și categoriile în care performezi cel mai bine.
            </p>

            {!noData && (
              <div className="rb-insight">
                <span className="rb-insight-pill is-teal">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                  <span>
                    Rată de câștig: <strong>{fmtPct(s.winRate)}</strong>
                  </span>
                </span>
                {s.averageRating !== null && (
                  <span className="rb-insight-pill">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>
                    </svg>
                    <span>
                      <strong>{Number(s.averageRating).toFixed(1)}</strong> / 5 din {s.reviewCount} {s.reviewCount === 1 ? 'review' : 'review-uri'}
                    </span>
                  </span>
                )}
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
              Trimite oferte la licitații active pentru a începe să vezi performanța.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Vezi licitații deschise
            </button>
          </div>
        ) : (
          <>
            {/* Stat cards principale */}
            <div className="stats-grid stats-grid-4">
              <StatCard
                icon="bids" tone="blue"
                value={s.totalBidsSubmitted} label="Oferte trimise"
                hint={`pe ${s.uniqueAuctionsParticipated} licitații unice`}
              />
              <StatCard
                icon="won" tone="green"
                value={s.auctionsWon} label="Licitații câștigate"
                hint={s.uniqueAuctionsParticipated > 0
                  ? `din ${s.uniqueAuctionsParticipated} la care ai participat`
                  : 'Niciuna încă'}
              />
              <StatCard
                icon="best" tone="teal"
                value={fmtPct(s.winRate)} label="Rată de câștig"
                hint="câștigate / participate"
              />
              <StatCard
                icon="total" tone="navy"
                value={fmtRON(s.totalWonValue)} label="Valoare câștigată"
                hint={s.auctionsWon > 0
                  ? `${fmtRON(s.averageWonValue)} pe licitație`
                  : '—'}
              />
            </div>

            {/* Stat cards secundare */}
            <div className="stats-grid stats-grid-3" style={{ marginTop: 16 }}>
              <StatCard
                icon="users" tone="amber"
                value={s.averageRating !== null ? Number(s.averageRating).toFixed(2) : '—'}
                label="Rating mediu"
                hint={`${s.reviewCount} ${s.reviewCount === 1 ? 'review' : 'review-uri'}`}
              />
              <StatCard
                icon="cancelled" tone="red"
                value={s.closeLossCount} label="Oferte pierdute la <5%"
                hint={s.closeLossCount > 0 ? 'Ajustează strategia' : 'Foarte bine!'}
              />
              <StatCard
                icon="clock" tone="gray"
                value={l30.bidsSubmitted} label={`Oferte ${period === 'all' ? 'totale' : period === '30d' ? '(30d)' : '(90d)'}`}
                hint={`${l30.auctionsWon} câștigate · ${fmtRON(l30.wonValue)}`}
              />
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16, marginTop: 24 }}>

              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 12 }}>
                  📂 Performanță pe categorii
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

              <div className="card">
                <h3 className="card-title" style={{ marginBottom: 12 }}>
                  🎯 Distribuție status oferte
                </h3>
                {statusChart ? (
                  <div style={{ height: 260 }}>
                    <Doughnut data={statusChart.data} options={statusChart.options} />
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <p className="empty-state-text" style={{ margin: 0 }}>
                      Nu există încă date pentru distribuție.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Insight bar */}
            <div className="card" style={{
              marginTop: 24,
              background: 'linear-gradient(135deg, #D8F3F1 0%, #EAF4F7 100%)',
              border: '1px solid rgba(0, 169, 157, 0.25)',
            }}>
              <h3 className="card-title" style={{ marginBottom: 14, color: '#012B55' }}>
                💡 Insight {period === 'all' ? '(tot istoricul)' : period === '30d' ? '(ultimele 30 zile)' : '(ultimele 90 zile)'}
              </h3>
              <p style={{ marginBottom: 14, color: '#1F3442' }}>
                {period === '30d' || period === '90d'
                  ? `În ${period === '30d' ? 'ultimele 30 zile' : 'ultimele 90 zile'} ai trimis ${l30.bidsSubmitted} oferte și ai câștigat ${l30.auctionsWon} ${l30.auctionsWon === 1 ? 'licitație' : 'licitații'}.`
                  : `Per total, ai trimis ${s.totalBidsSubmitted} oferte și ai câștigat ${s.auctionsWon} ${s.auctionsWon === 1 ? 'licitație' : 'licitații'}.`}
                {s.closeLossCount > 0 && (
                  <> Ai pierdut <strong>{s.closeLossCount}</strong> {s.closeLossCount === 1 ? 'licitație' : 'licitații'} la o diferență sub 5%. Ajustează ofertele pentru mai multă competitivitate.</>
                )}
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 14,
              }}>
                <InsightStat label="Oferte trimise" value={l30.bidsSubmitted} />
                <InsightStat label="Câștigate"      value={l30.auctionsWon} />
                <InsightStat label="Valoare"        value={fmtRON(l30.wonValue)} />
                <InsightStat label="Rată câștig"    value={fmtPct(l30.winRate)} highlight />
                <InsightStat label="Close losses"   value={l30.closeLossCount} />
              </div>
            </div>

            {/* Close losses */}
            <div className="card" style={{ marginTop: 24 }}>
              <h3 className="card-title" style={{ marginBottom: 14 }}>
                ⚠️ Oferte pierdute la diferență mică (sub 5%)
              </h3>
              {data.closeLosses?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.closeLosses.map((cl) => (
                    <div
                      key={cl.auctionId}
                      onClick={() => navigate(`/auction/${cl.auctionId}`)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto',
                        gap: 14,
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: '#FEF6F6',
                        border: '1px solid #FBDADA',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FDEBEB'}
                      onMouseLeave={e => e.currentTarget.style.background = '#FEF6F6'}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#1F3442', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cl.auctionTitle}
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7C86' }}>
                          {cl.category} · {fmtDateOnly(cl.endedAt)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#6B7C86' }}>Oferta ta</div>
                        <div style={{ fontWeight: 700, color: '#1F3442' }}>{fmtRON(cl.myBid)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#DC3545' }}>Diferență</div>
                        <div style={{ fontWeight: 700, color: '#DC3545' }}>
                          {fmtPct(cl.differencePercent)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p className="empty-state-text" style={{ margin: 0 }}>
                    Nu ai pierdut recent licitații la diferență mică.
                  </p>
                </div>
              )}
            </div>

            {/* Rating distribution */}
            {data.ratingDistribution && s.reviewCount > 0 && (
              <div className="card" style={{ marginTop: 24 }}>
                <h3 className="card-title" style={{ marginBottom: 14 }}>
                  ⭐ Distribuție rating
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const row = data.ratingDistribution.find(r => r.star === star) || { count: 0 };
                    const pct = s.reviewCount > 0 ? (row.count / s.reviewCount) * 100 : 0;
                    return (
                      <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 64, color: '#1F3442', fontSize: 13 }}>
                          {star} ⭐
                        </div>
                        <div style={{
                          flex: 1, height: 8, background: '#EEF2F4',
                          borderRadius: 4, overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: '#F59E0B',
                            transition: 'width 0.4s',
                          }} />
                        </div>
                        <div style={{ width: 48, textAlign: 'right', color: '#6B7C86', fontSize: 13 }}>
                          {row.count}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
