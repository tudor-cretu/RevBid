/* RevBid logo — recreat ca SVG vectorial.
   Marca: cerc + 3 furnizori (înălțimi descrescătoare) pe un prag
   care coboară într-o săgeată — sugerează licitația inversă. */

export function LogoMark({ size = 40, variant = 'color' }) {
  const light = variant === 'light';
  const ring  = light ? '#CFE4F2' : '#033667';
  const f1    = light ? '#FFFFFF' : '#033667';
  const f2    = light ? '#7FB6E6' : '#0871C4';
  const f3    = '#00A99D';
  const arrow = light ? '#2BD4C7' : '#00A99D';

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="24" cy="24" r="21" stroke={ring} strokeWidth="3" />
      {/* prag → săgeată descendentă */}
      <path d="M9 30 H28 C33 30 36 33 39 38" stroke={arrow} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <path d="M39 38 L32.6 37.3 M39 38 L38.3 31.5" stroke={arrow} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      {/* furnizori */}
      <circle cx="14.2" cy="10.6" r="2.9" fill={f1} />
      <rect x="11" y="14.2" width="6.4" height="15.8" rx="3.2" fill={f1} />
      <circle cx="21.2" cy="14.6" r="2.9" fill={f2} />
      <rect x="18" y="18.2" width="6.4" height="11.8" rx="3.2" fill={f2} />
      <circle cx="28.2" cy="18.2" r="2.9" fill={f3} />
      <rect x="25" y="21.8" width="6.4" height="8.2" rx="3.2" fill={f3} />
    </svg>
  );
}

export default function Logo({ size = 'md', variant = 'color', onClick }) {
  const markSize = size === 'lg' ? 46 : size === 'sm' ? 28 : 36;
  const fontSize = size === 'lg' ? '1.875rem' : size === 'sm' ? '1.125rem' : '1.4rem';
  const revColor = variant === 'light' ? '#FFFFFF' : '#033667';

  return (
    <div
      className="rb-logo"
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 9, cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}
    >
      <LogoMark size={markSize} variant={variant} />
      <span style={{ fontSize, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
        <span style={{ color: revColor }}>Rev</span>
        <span style={{ color: '#00A99D' }}>Bid</span>
      </span>
    </div>
  );
}
