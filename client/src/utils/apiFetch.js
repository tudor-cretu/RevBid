/**
 * apiFetch — wrapper minimal peste fetch care:
 *  1. Setează `credentials: 'include'` automat — astfel cookie-ul
 *     httpOnly cu JWT-ul este trimis la fiecare request fără ca codul
 *     să fie nevoit să-l atașeze manual.
 *  2. Mai acceptă tokenul ca Bearer header (pentru compatibilitate
 *     tranzitorie cu codul vechi care încă îl pasează din context).
 *
 * Folosire:
 *   apiFetch(`${API_URL}/api/foo`)                    // GET
 *   apiFetch(url, { method: 'POST', body: ... })      // POST
 *   apiFetch(url, { token })                          // include Bearer
 *
 * Notă: NU configurăm Content-Type — apelantul îl setează când vrea JSON
 * (sau îl omite explicit pentru FormData).
 */
export async function apiFetch(url, options = {}) {
  const { token, headers = {}, ...rest } = options;

  const finalHeaders = { ...headers };
  /* Adăugăm Bearer doar dacă apelantul a pasat un token explicit.
     Cookie-ul httpOnly e sursă primară — Bearer-ul e fallback.       */
  if (token && !finalHeaders.Authorization) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    credentials: 'include',
    ...rest,
    headers: finalHeaders,
  });
}

export default apiFetch;
