import { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../config';

const AuthContext = createContext(null);

/* JWT-ul nu mai trăiește în localStorage — e setat de server ca cookie
   httpOnly și e trimis automat la fiecare request care folosește
   `credentials: 'include'`. Stocăm doar tokenul în memorie pentru
   compatibilitate tranzitorie (ex: socket.io care îl primește în
   handshake.auth). La refresh, încercăm restaurarea sesiunii din cookie. */

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('revbid_user');
    return saved ? JSON.parse(saved) : null;
  });

  /* Tokenul: doar în memorie. NU în localStorage. */
  const [token, setToken] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  /* La mount: dacă există cookie-ul httpOnly setat de server,
     /api/auth/me ne va întoarce userul. Asta restabilește sesiunea
     după refresh fără să stocăm tokenul în localStorage.              */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const me = await res.json();
          if (!cancelled && me?._id) {
            const payload = {
              id:          me._id,
              firstName:   me.firstName,
              lastName:    me.lastName,
              email:       me.email,
              role:        me.role,
              isVerified:  me.isVerified,
              avatar:      me.avatar,
              companyName: me.companyName,
              company:     me.company || {},
            };
            setUser(payload);
            localStorage.setItem('revbid_user', JSON.stringify(payload));
          }
        } else if (res.status === 401) {
          /* Cookie absent sau expirat — curățăm starea locală. */
          if (!cancelled) {
            setUser(null);
            localStorage.removeItem('revbid_user');
          }
        }
      } catch { /* network down — păstrăm starea cached din localStorage */ }
      finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem('revbid_user', JSON.stringify(userData));
    /* Cookie-ul httpOnly e deja setat de server. Tokenul îl ținem doar
       în memorie pentru compatibilitate cu socket.io.                    */
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('revbid_user');
    /* Curățăm rămășițe vechi (versiuni anterioare salvau și tokenul). */
    localStorage.removeItem('revbid_token');
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method:      'POST',
        credentials: 'include',
      });
    } catch { /* network down — cookie-ul oricum expiră în 7 zile */ }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, bootstrapped }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
