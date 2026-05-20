import { useNavigate, useLocation }          from 'react-router-dom';
import { useAuth }                     from '../context/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { io }                          from 'socket.io-client';
import { API_URL }                     from '../config';

export default function Navbar() {
  const { user, logout, token } = useAuth();
  const navigate                = useNavigate();
  const location                = useLocation();

  const [notifications, setNotifications] = useState([]);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const socketRef   = useRef(null);
  const dropdownRef = useRef(null);

  // ── Fetch notifications from DB on mount ──────────────────────
  // This ensures offline users see notifications they missed
  useEffect(() => {
    if (!user || !token) return;
    fetchNotifications();
  }, [user, token]);

  const fetchNotifications = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(
        data.map(n => ({
          id:   n._id,
          _id:  n._id,
          type: n.type,
          text: n.text,
          link: n.link,
          time: n.createdAt,
          read: n.read,
        }))
      );
    } catch {}
  };

  // ── Connect socket and listen for live notifications ──────────
  useEffect(() => {
    if (!user || !token) return;
    const s = io(API_URL, { auth: { token } });

    s.on('connect', () => console.log('Navbar socket conectat'));

    s.on('notification', (notif) => {
      setNotifications(prev => {
        // Deduplicate by _id (prevents double-show when DB fetch + socket both deliver)
        if (notif._id && prev.some(n => n._id === notif._id)) return prev;
        return [{
          id:   notif._id || (Date.now() + Math.random()),
          _id:  notif._id || null,
          type: notif.type,
          text: notif.text,
          link: notif.link,
          time: notif.time || new Date(),
          read: notif.read ?? false,
        }, ...prev].slice(0, 50);
      });
    });

    socketRef.current = s;
    return () => s.disconnect();
  }, [user, token]);

  // ── Outside click closes dropdown ─────────────────────────────
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Bell click: show dropdown + mark all as read ──────────────
  const handleBellClick = async () => {
    const wasOpen = showDropdown;
    setShowDropdown(p => !p);

    if (!wasOpen && unreadCount > 0) {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      // Persist to DB
      try {
        await fetch(`${API_URL}/api/notifications/read`, {
          method:  'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
  };

  const handleNotifClick = (notif) => {
    setShowDropdown(false);
    navigate(notif.link);
  };

  // ── Clear all ─────────────────────────────────────────────────
  const clearAll = async () => {
    setNotifications([]);
    try {
      await fetch(`${API_URL}/api/notifications`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const timeAgo = (date) => {
    const diff = Math.floor((new Date() - new Date(date)) / 1000);
    if (diff < 60)    return 'acum';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}z`;
  };

  const notifIcon = (type) => ({
    message:      '💬',
    auction_chat: '🏷️',
    bid:          '💰',
    outbid:       '⚠️',
    auction_closed: '🔒',
  }[type] || '🔔');

  if (!user) return null;

  return (
    <nav className="rb-nav">
      <div className="rb-nav-inner">

        <div className="rb-nav-brand" onClick={() => navigate('/dashboard')}>
          <span className="rb-nav-logo-rev">Rev</span>
          <span className="rb-nav-logo-bid">Bid</span>
        </div>

        {/* Hamburger */}
        <button className="rb-nav-hamburger" onClick={() => setMobileOpen(p => !p)} aria-label="Menu">
          <span className={`rb-hamburger-line ${mobileOpen ? 'open' : ''}`} />
          <span className={`rb-hamburger-line ${mobileOpen ? 'open' : ''}`} />
          <span className={`rb-hamburger-line ${mobileOpen ? 'open' : ''}`} />
        </button>

        <div className={`rb-nav-right ${mobileOpen ? 'open' : ''}`}>
          <button className="rb-nav-link" onClick={() => { navigate('/dashboard'); setMobileOpen(false); }}>Licitații</button>
          {user.role === 'supplier' && (
            <button
              className={`rb-nav-link ${location.pathname === '/my-bids' ? 'rb-nav-link-active' : ''}`}
              onClick={() => { navigate('/my-bids'); setMobileOpen(false); }}
            >
              Oferte
            </button>
          )}
          {user.role === 'admin' && (
            <button className="rb-nav-link" onClick={() => { navigate('/admin'); setMobileOpen(false); }}>Admin</button>
          )}
          <button className="rb-nav-link" onClick={() => { navigate('/support'); setMobileOpen(false); }}>Support</button>
          <button className="rb-nav-link" onClick={() => { navigate('/messages'); setMobileOpen(false); }}>Mesaje</button>

          {/* Bell */}
          <div className="rb-nav-bell-wrap" ref={dropdownRef}>
            <button className="rb-nav-bell" onClick={handleBellClick} title="Notificari">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <span className="rb-nav-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {showDropdown && (
              <div className="rb-notif-dropdown">
                <div className="rb-notif-header">
                  <span className="rb-notif-title">Notificari</span>
                  {notifications.length > 0 && (
                    <button className="rb-notif-clear" onClick={clearAll}>Sterge tot</button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="rb-notif-empty">
                    <p style={{ fontSize: '24px', margin: 0 }}>🔕</p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Nicio notificare</p>
                  </div>
                ) : (
                  <div className="rb-notif-list">
                    {notifications.map(notif => (
                      <div
                        key={notif.id}
                        className={`rb-notif-item ${notif.read ? '' : 'unread'}`}
                        onClick={() => handleNotifClick(notif)}
                      >
                        <span className="rb-notif-icon">{notifIcon(notif.type)}</span>
                        <div className="rb-notif-body">
                          <p className="rb-notif-text">{notif.text}</p>
                          <p className="rb-notif-time">{timeAgo(notif.time)}</p>
                        </div>
                        {!notif.read && <div className="rb-notif-dot" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User */}
          <div className="rb-nav-user" onClick={() => navigate('/settings')}>
            {user.avatar ? (
              <img src={user.avatar} alt="" className="rb-nav-avatar" />
            ) : (
              <div className="rb-nav-avatar-fallback">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
            )}
            <div className="rb-nav-user-info hide-mobile">
              <span className="rb-nav-user-name">{user.firstName}</span>
              <span className="rb-nav-user-role">{user.role}</span>
            </div>
          </div>

          <button className="rb-nav-logout" onClick={handleLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="hide-mobile">Deconectare</span>
          </button>
        </div>
      </div>

      <style>{navbarCSS}</style>
    </nav>
  );
}

const navbarCSS = `
.rb-nav {
  background: var(--primary-navy);
  position: sticky; top: 0; z-index: 100;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}
.rb-nav-inner {
  max-width: 1280px; margin: 0 auto; padding: 0 1.5rem;
  height: 64px; display: flex; align-items: center; justify-content: space-between;
}
.rb-nav-brand {
  font-size: 1.375rem; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; gap: 1px; user-select: none;
}
.rb-nav-logo-rev { color: #FFFFFF; }
.rb-nav-logo-bid { color: var(--bid-teal); }

.rb-nav-right {
  display: flex; align-items: center; gap: 6px;
}
.rb-nav-link {
  background: none; border: none; color: rgba(255,255,255,0.75);
  font-size: 0.8125rem; font-weight: 500; cursor: pointer; padding: 6px 12px;
  border-radius: var(--radius-md); transition: all var(--transition-fast);
  font-family: var(--font-sans);
}
.rb-nav-link:hover { color: #fff; background: rgba(255,255,255,0.1); }
.rb-nav-link-active { color: #fff !important; background: rgba(0,169,157,0.3) !important; border-bottom: 2px solid var(--bid-teal); }

.rb-nav-bell-wrap { position: relative; }
.rb-nav-bell {
  position: relative; background: rgba(255,255,255,0.1); border: none;
  border-radius: var(--radius-md); padding: 7px 9px; cursor: pointer;
  color: rgba(255,255,255,0.85); transition: all var(--transition-fast);
  display: flex; align-items: center;
}
.rb-nav-bell:hover { background: rgba(255,255,255,0.18); color: #fff; }
.rb-nav-bell-badge {
  position: absolute; top: -4px; right: -4px;
  background: var(--error-red); color: #fff;
  font-size: 10px; font-weight: 700; border-radius: 20px;
  padding: 1px 5px; min-width: 16px; text-align: center;
  border: 2px solid var(--primary-navy);
}

.rb-notif-dropdown {
  position: absolute; top: 44px; right: 0; width: 340px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-xl);
  overflow: hidden; animation: slideDown .2s ease;
  z-index: 200;
}
.rb-notif-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px; border-bottom: 1px solid var(--border-light);
}
.rb-notif-title { font-size: 0.875rem; font-weight: 600; color: var(--text-heading); }
.rb-notif-clear { font-size: 0.75rem; color: var(--action-blue); background: none; border: none; cursor: pointer; font-family: var(--font-sans); }
.rb-notif-clear:hover { text-decoration: underline; }
.rb-notif-empty { padding: 2rem; text-align: center; }
.rb-notif-list { max-height: 380px; overflow-y: auto; }
.rb-notif-item {
  display: flex; gap: 10px; padding: 12px 16px; cursor: pointer;
  border-bottom: 1px solid var(--border-light); align-items: flex-start;
  transition: background var(--transition-fast);
}
.rb-notif-item:hover { background: var(--ice-blue); }
.rb-notif-item.unread { background: #F0F9FF; }
.rb-notif-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
.rb-notif-body { flex: 1; min-width: 0; }
.rb-notif-text { font-size: 13px; color: var(--text-body); margin: 0 0 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rb-notif-time { font-size: 11px; color: var(--text-muted); margin: 0; }
.rb-notif-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--action-blue); flex-shrink: 0; margin-top: 4px; }

.rb-nav-user {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 4px 8px; border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}
.rb-nav-user:hover { background: rgba(255,255,255,0.1); }
.rb-nav-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.25); }
.rb-nav-avatar-fallback {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--bid-teal); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  border: 2px solid rgba(255,255,255,0.25);
}
.rb-nav-user-info { display: flex; flex-direction: column; }
.rb-nav-user-name { font-size: 13px; color: #fff; font-weight: 600; line-height: 1.2; }
.rb-nav-user-role { font-size: 10px; color: var(--bid-teal); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }

.rb-nav-logout {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px; border: 1px solid rgba(255,255,255,0.2);
  border-radius: var(--radius-md); background: none;
  color: rgba(255,255,255,0.8); cursor: pointer; font-size: 13px;
  font-weight: 500; transition: all var(--transition-fast);
  font-family: var(--font-sans);
}
.rb-nav-logout:hover { background: rgba(220,53,69,0.15); border-color: rgba(220,53,69,0.4); color: #ff8a8a; }

/* Hamburger */
.rb-nav-hamburger {
  display: none; background: none; border: none; cursor: pointer; padding: 8px;
  flex-direction: column; gap: 4px;
}
.rb-hamburger-line {
  width: 20px; height: 2px; background: rgba(255,255,255,0.85);
  border-radius: 2px; transition: all .25s ease;
}
.rb-hamburger-line.open:nth-child(1) { transform: rotate(45deg) translate(4px,4px); }
.rb-hamburger-line.open:nth-child(2) { opacity: 0; }
.rb-hamburger-line.open:nth-child(3) { transform: rotate(-45deg) translate(4px,-4px); }

@media (max-width: 768px) {
  .rb-nav-hamburger { display: flex; }
  .rb-nav-right {
    display: none; position: absolute; top: 64px; left: 0; right: 0;
    background: var(--primary-navy); flex-direction: column; padding: 1rem;
    gap: 4px; border-top: 1px solid rgba(255,255,255,0.1);
    box-shadow: var(--shadow-lg);
  }
  .rb-nav-right.open { display: flex; animation: slideDown .25s ease; }
  .rb-nav-link { width: 100%; text-align: left; padding: 10px 12px; }
  .rb-nav-user { width: 100%; padding: 10px 12px; }
  .rb-nav-logout { width: 100%; justify-content: center; margin-top: 4px; }
  .rb-nav-bell-wrap { width: 100%; }
  .rb-nav-bell { width: 100%; justify-content: center; padding: 10px; }
  .rb-notif-dropdown { width: calc(100vw - 2rem); right: -1rem; }
}
`;