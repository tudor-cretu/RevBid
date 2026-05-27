import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { API_URL } from './config'

/* ── Auto-include credentials pe toate cererile către API-ul RevBid ──
   După migrarea de la JWT-în-localStorage la cookie httpOnly, cookie-ul
   trebuie trimis pe fiecare request — `credentials: 'include'` face asta.
   În loc să modificăm 17+ fișiere care folosesc fetch direct, patch-uim
   global window.fetch o singură dată aici. Sigur: orice URL care nu
   țintește API_URL trece neatins.                                          */
const __origFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input?.url || '');
  if (url.startsWith(API_URL)) {
    if (!init.credentials) init.credentials = 'include';
  }
  return __origFetch(input, init);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
