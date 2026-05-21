import { useState, useRef, useEffect } from 'react';

/**
 * DateTimePicker — selector custom de dată + oră pentru RevBid.
 *
 * Afișează ÎNTOTDEAUNA formatul `dd/mm/yyyy HH:mm` (24h, fără AM/PM),
 * indiferent de limba browserului. Înlocuiește `<input datetime-local>`.
 *
 * value/onChange folosesc formatul `yyyy-MM-ddTHH:mm` (compatibil cu
 * restul aplicației — același pe care îl producea datetime-local).
 */

const MONTHS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];

const pad = n => String(n).padStart(2, '0');

function parseValue(v) {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return { year: +m[1], month: +m[2] - 1, day: +m[3], hour: +m[4], minute: +m[5] };
}
const buildValue = (y, mo, d, h, mi) => `${y}-${pad(mo + 1)}-${pad(d)}T${pad(h)}:${pad(mi)}`;
const displayValue = sel => sel
  ? `${pad(sel.day)}/${pad(sel.month + 1)}/${sel.year} ${pad(sel.hour)}:${pad(sel.minute)}`
  : '';

export default function DateTimePicker({ value, onChange, error = false, placeholder = 'dd/mm/yyyy HH:mm' }) {
  const sel = parseValue(value);
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [view, setView] = useState({
    year:  sel?.year  ?? now.getFullYear(),
    month: sel?.month ?? now.getMonth(),
  });
  const rootRef = useRef(null);

  // Sincronizează luna afișată când se schimbă valoarea din exterior.
  useEffect(() => {
    if (sel) setView({ year: sel.year, month: sel.month });
  }, [value]);

  // Închide popover-ul la click în afară.
  useEffect(() => {
    if (!open) return;
    const onDocClick = e => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onEsc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  /* Emite o valoare nouă, păstrând părțile neschimbate. */
  const emit = (parts) => {
    const base = sel || {
      year: now.getFullYear(), month: now.getMonth(), day: now.getDate(),
      hour: 9, minute: 0,
    };
    const next = { ...base, ...parts };
    onChange(buildValue(next.year, next.month, next.day, next.hour, next.minute));
  };

  const pickDay = (day) => {
    emit({ year: view.year, month: view.month, day });
  };

  const shiftMonth = (delta) => {
    setView(v => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  /* Construiește grila zilelor pentru luna afișată. */
  const firstDow = (new Date(view.year, view.month, 1).getDay() + 6) % 7; // Luni = 0
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = d => d && view.year === today.getFullYear()
    && view.month === today.getMonth() && d === today.getDate();
  const isSelected = d => d && sel && sel.year === view.year
    && sel.month === view.month && sel.day === d;

  const hours   = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="dtp" ref={rootRef}>
      <button
        type="button"
        className={`dtp-field ${error ? 'dtp-field-error' : ''} ${open ? 'dtp-field-open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={sel ? 'dtp-value' : 'dtp-placeholder'}>
          {sel ? displayValue(sel) : placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="dtp-pop">
          {/* Navigare lună */}
          <div className="dtp-nav">
            <button type="button" className="dtp-nav-btn" onClick={() => shiftMonth(-1)} aria-label="Luna anterioară">‹</button>
            <span className="dtp-nav-label">{MONTHS[view.month]} {view.year}</span>
            <button type="button" className="dtp-nav-btn" onClick={() => shiftMonth(1)} aria-label="Luna următoare">›</button>
          </div>

          {/* Zilele săptămânii */}
          <div className="dtp-grid dtp-weekdays">
            {WEEKDAYS.map(w => <span key={w} className="dtp-wd">{w}</span>)}
          </div>

          {/* Grila zilelor */}
          <div className="dtp-grid">
            {cells.map((d, i) => (
              <button
                key={i}
                type="button"
                className={`dtp-day ${!d ? 'dtp-day-empty' : ''} ${isSelected(d) ? 'dtp-day-sel' : ''} ${isToday(d) ? 'dtp-day-today' : ''}`}
                disabled={!d}
                onClick={() => d && pickDay(d)}
              >
                {d || ''}
              </button>
            ))}
          </div>

          {/* Selectare oră (24h) */}
          <div className="dtp-time">
            <span className="dtp-time-label">Ora</span>
            <select
              className="dtp-select"
              value={sel ? sel.hour : ''}
              onChange={e => emit({ hour: +e.target.value })}
            >
              {!sel && <option value="" disabled>--</option>}
              {hours.map(h => <option key={h} value={h}>{pad(h)}</option>)}
            </select>
            <span className="dtp-time-colon">:</span>
            <select
              className="dtp-select"
              value={sel ? sel.minute - (sel.minute % 5) : ''}
              onChange={e => emit({ minute: +e.target.value })}
            >
              {!sel && <option value="" disabled>--</option>}
              {minutes.map(m => <option key={m} value={m}>{pad(m)}</option>)}
            </select>
            <span className="dtp-time-hint">24h</span>
          </div>

          {/* Acțiuni */}
          <div className="dtp-actions">
            <button
              type="button"
              className="dtp-action"
              onClick={() => {
                const n = new Date();
                onChange(buildValue(n.getFullYear(), n.getMonth(), n.getDate(), n.getHours(), n.getMinutes() - (n.getMinutes() % 5)));
                setView({ year: n.getFullYear(), month: n.getMonth() });
              }}
            >
              Acum
            </button>
            {sel && (
              <button type="button" className="dtp-action dtp-action-clear" onClick={() => { onChange(''); }}>
                Șterge
              </button>
            )}
            <button type="button" className="dtp-action dtp-action-done" onClick={() => setOpen(false)}>
              Gata
            </button>
          </div>
        </div>
      )}

      <style>{dtpCSS}</style>
    </div>
  );
}

const dtpCSS = `
.dtp { position: relative; }
.dtp-field {
  width: 100%; display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 9px 12px; cursor: pointer;
  background: var(--bg-input, #fff); color: var(--text-body);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  font-family: var(--font-sans); font-size: 0.875rem;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.dtp-field:hover { border-color: var(--bid-teal); }
.dtp-field-open { border-color: var(--bid-teal); box-shadow: 0 0 0 3px rgba(0,169,157,0.15); }
.dtp-field-error { border-color: var(--error-red); }
.dtp-field svg { color: var(--text-muted); flex-shrink: 0; }
.dtp-value { color: var(--text-heading); font-weight: 600; }
.dtp-placeholder { color: var(--muted-gray); }

.dtp-pop {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 2000;
  width: 290px; background: #fff;
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl); padding: 12px;
  animation: fadeIn .12s ease;
}

.dtp-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.dtp-nav-label { font-size: 0.875rem; font-weight: 700; color: var(--primary-navy); }
.dtp-nav-btn {
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--ice-blue);
  color: var(--primary-navy); font-size: 1rem; cursor: pointer; line-height: 1;
  transition: all var(--transition-fast);
}
.dtp-nav-btn:hover { background: var(--bid-teal); color: #fff; border-color: var(--bid-teal); }

.dtp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.dtp-weekdays { margin-bottom: 4px; }
.dtp-wd {
  text-align: center; font-size: 0.625rem; font-weight: 700;
  color: var(--text-muted); text-transform: uppercase; padding: 4px 0;
}
.dtp-day {
  aspect-ratio: 1; border: none; background: transparent;
  border-radius: var(--radius-sm); cursor: pointer;
  font-size: 0.8125rem; color: var(--text-body); font-family: var(--font-sans);
  transition: all var(--transition-fast);
}
.dtp-day:hover:not(:disabled) { background: var(--ice-blue); }
.dtp-day-empty { cursor: default; }
.dtp-day-today { font-weight: 700; color: var(--bid-teal); }
.dtp-day-sel {
  background: var(--bid-teal) !important; color: #fff !important; font-weight: 700;
}

.dtp-time {
  display: flex; align-items: center; gap: 6px;
  margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-light);
}
.dtp-time-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin-right: 2px; }
.dtp-time-colon { font-weight: 700; color: var(--text-heading); }
.dtp-time-hint { font-size: 0.625rem; color: var(--muted-gray); margin-left: auto; }
.dtp-select {
  padding: 5px 6px; border: 1px solid var(--border); border-radius: var(--radius-sm);
  font-size: 0.8125rem; font-family: var(--font-sans); color: var(--text-heading);
  background: #fff; cursor: pointer;
}
.dtp-select:focus { outline: none; border-color: var(--bid-teal); }

.dtp-actions { display: flex; gap: 6px; margin-top: 10px; }
.dtp-action {
  flex: 1; padding: 7px 8px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--ice-blue);
  color: var(--primary-navy); font-size: 0.75rem; font-weight: 600; cursor: pointer;
  font-family: var(--font-sans); transition: all var(--transition-fast);
}
.dtp-action:hover { border-color: var(--bid-teal); color: var(--bid-teal); }
.dtp-action-clear { color: var(--error-red); }
.dtp-action-clear:hover { border-color: var(--error-red); color: var(--error-red); background: #FEF2F2; }
.dtp-action-done { background: var(--bid-teal); color: #fff; border-color: var(--bid-teal); }
.dtp-action-done:hover { background: #009688; color: #fff; }
`;
