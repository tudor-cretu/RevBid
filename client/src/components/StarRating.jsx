import { useState } from 'react';

/**
 * Componentă de rating cu stele — interactivă (input) sau read-only (afișare).
 * Interactivă când se transmite `onChange` și `readOnly` este fals.
 */
export default function StarRating({ value = 0, onChange, size = 22, readOnly = false }) {
  const [hover, setHover] = useState(0);
  const interactive = !readOnly && typeof onChange === 'function';
  const display = interactive && hover ? hover : value;

  if (!interactive) {
    return (
      <span className="sr-stars" style={{ fontSize: size }} aria-label={`${value} din 5 stele`}>
        {[1, 2, 3, 4, 5].map(n => (
          <span key={n} className={`sr-star ${n <= Math.round(value) ? 'on' : ''}`}>★</span>
        ))}
        <style>{starCSS}</style>
      </span>
    );
  }

  return (
    <div className="sr-stars" role="radiogroup" aria-label="Selectează rating de la 1 la 5 stele">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'stea' : 'stele'}`}
          className={`sr-star sr-btn ${n <= display ? 'on' : ''}`}
          style={{ fontSize: size }}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
        >★</button>
      ))}
      <style>{starCSS}</style>
    </div>
  );
}

const starCSS = `
.sr-stars { display: inline-flex; gap: 2px; line-height: 1; }
.sr-star { color: #D8E0E5; }
.sr-star.on { color: #F59E0B; }
.sr-btn {
  background: none; border: none; padding: 0 1px; cursor: pointer;
  transition: transform 0.12s ease;
}
.sr-btn:hover { transform: scale(1.18); }
.sr-btn:focus-visible {
  outline: 2px solid var(--bid-teal, #00A99D);
  outline-offset: 2px; border-radius: 4px;
}
`;
