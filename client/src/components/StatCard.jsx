const TONES = {
  teal:  { accent: '#00A99D', tint: '#D8F3F1' },
  blue:  { accent: '#0871C4', tint: '#E0F0FF' },
  amber: { accent: '#D97706', tint: '#FEF3C7' },
  green: { accent: '#17B26A', tint: '#DCFCE7' },
  navy:  { accent: '#033667', tint: '#E8EEF4' },
  gray:  { accent: '#6B7C86', tint: '#EEF2F4' },
  red:   { accent: '#DC3545', tint: '#FEE2E2' },
};

const ICONS = {
  auctions: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h5"/></>,
  won:      <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
  cancelled:<><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>,
  draft:    <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></>,
  bids:     <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  total:    <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  best:     <><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></>,
  clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  users:    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
};

export default function StatCard({ icon, value, label, hint, tone = 'teal', onClick }) {
  const { accent, tint } = TONES[tone] || TONES.teal;
  const iconNode = typeof icon === 'string'
    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[icon] || ICONS.auctions}</svg>
    : icon;

  return (
    <div
      className={`rb-stat${onClick ? ' rb-stat-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{ '--stat-accent': accent, '--stat-tint': tint }}
    >
      <span className="rb-stat-icon">{iconNode}</span>
      <div className="rb-stat-main">
        <span className="rb-stat-value">{value}</span>
        <span className="rb-stat-label">{label}</span>
        {hint && <span className="rb-stat-hint">{hint}</span>}
      </div>
    </div>
  );
}
