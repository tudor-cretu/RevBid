/* Utilitare de formatare partajate — RevBid. */

const pad = n => String(n).padStart(2, '0');

/**
 * Formatează un deadline în standardul aplicației: `dd/mm/yyyy HH:mm`
 * (24h, zero-padding). Întoarce un fallback pentru valori lipsă/invalide.
 */
export function fmtDeadline(d, fallback = 'Fără deadline') {
  if (!d) return fallback;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return fallback;
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} `
       + `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

/** Doar data, fără oră: `dd/mm/yyyy`. */
export function fmtDateOnly(d, fallback = '—') {
  if (!d) return fallback;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return fallback;
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

/**
 * Convertește o valoare de dată într-un string compatibil cu
 * `<input type="datetime-local">` (`yyyy-MM-ddTHH:mm`), în ora locală.
 */
export function toDatetimeLocal(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
       + `T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
