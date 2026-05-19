import { useNavigate }                   from 'react-router-dom';
import { useAuth }                       from '../context/AuthContext';
import { useEffect, useState, useRef }   from 'react';
import { io }                            from 'socket.io-client';
import { API_URL }                       from '../config';

export default function Navbar() {
  const { user, logout, token } = useAuth();
  const navigate                = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [showDropdown,  setShowDropdown]  = useState(false);
  const socketRef   = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!user || !token) return;

    const s = io(API_URL, { auth: { token } });

    s.on('connect', () => {
      console.log('Navbar socket conectat');
    });

    // Toate notificarile personale vin pe acest event
    s.on('notification', (notif) => {
      setNotifications(prev => [{
        id:   Date.now() + Math.random(),
        ...notif,
        read: false,
      }, ...prev].slice(0, 30));
    });

    socketRef.current = s;
    return () => s.disconnect();
  }, [user, token]);

  // Inchide dropdown la click afara
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

  const handleBellClick = () => {
    setShowDropdown(p => !p);
    if (!showDropdown) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleNotifClick = (notif) => {
    setShowDropdown(false);
    navigate(notif.link);
  };

  const clearAll = () => setNotifications([]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
  }[type] || '🔔');

  if (!user) return null;

  return (
    <nav style={styles.nav}>
      <div style={styles.inner}>

        <span style={styles.logo} onClick={() => navigate('/dashboard')}>RevBid</span>

        <div style={styles.right}>
          {user.role === 'admin' && (
            <button style={styles.link} onClick={() => navigate('/admin')}>Admin</button>
          )}
          <button style={styles.link} onClick={() => navigate('/support')}>Support</button>
          <button style={styles.link} onClick={() => navigate('/messages')}>Mesaje</button>

          {/* Clopotel notificari */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button style={styles.bellBtn} onClick={handleBellClick} title="Notificari">
              🔔
              {unreadCount > 0 && (
                <span style={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {showDropdown && (
              <div style={styles.dropdown}>
                <div style={styles.dropdownHeader}>
                  <span style={styles.dropdownTitle}>Notificari</span>
                  {notifications.length > 0 && (
                    <button style={styles.clearBtn} onClick={clearAll}>Sterge tot</button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div style={styles.emptyNotif}>
                    <p style={{ fontSize: '24px', margin: '0' }}>🔕</p>
                    <p style={{ fontSize: '13px', color: '#a0aec0', margin: '4px 0 0' }}>Nicio notificare</p>
                  </div>
                ) : (
                  <div style={styles.notifList}>
                    {notifications.map(notif => (
                      <div
                        key={notif.id}
                        style={{ ...styles.notifItem, background: notif.read ? '#fff' : '#EBF8FF' }}
                        onClick={() => handleNotifClick(notif)}
                      >
                        <span style={styles.notifIcon}>{notifIcon(notif.type)}</span>
                        <div style={styles.notifBody}>
                          <p style={styles.notifText}>{notif.text}</p>
                          <p style={styles.notifTime}>{timeAgo(notif.time)}</p>
                        </div>
                        {!notif.read && <div style={styles.unreadDot} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Avatar + nume */}
          <div style={styles.userInfo}>
            {user.avatar ? (
              <img src={user.avatar} alt="" style={styles.avatar} />
            ) : (
              <div style={styles.avatarFallback}>
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
            )}
            <span style={styles.userName}>{user.firstName} {user.lastName}</span>
            <span style={styles.roleBadge}>{user.role}</span>
          </div>

          <button style={styles.iconBtn} onClick={() => navigate('/settings')} title="Setari cont">⚙️</button>
          <button style={styles.logoutBtn} onClick={handleLogout}>Deconectare</button>
        </div>
      </div>
    </nav>
  );
}

const styles = {
  nav:            { background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 },
  inner:          { maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logo:           { fontSize: '18px', fontWeight: '700', cursor: 'pointer', color: '#1a1a1a' },
  right:          { display: 'flex', alignItems: 'center', gap: '12px' },
  link:           { background: 'none', border: 'none', fontSize: '14px', color: '#718096', cursor: 'pointer', padding: '4px 8px' },
  userInfo:       { display: 'flex', alignItems: 'center', gap: '8px' },
  avatar:         { width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' },
  avatarFallback: { width: '30px', height: '30px', borderRadius: '50%', background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' },
  userName:       { fontSize: '14px', color: '#1a1a1a', fontWeight: '500' },
  roleBadge:      { fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: '#F7FAFC', color: '#718096', border: '1px solid #e2e8f0' },
  iconBtn:        { background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '16px' },
  logoutBtn:      { padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#e53e3e', fontWeight: '500' },
  bellBtn:        { position: 'relative', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '16px' },
  badge:          { position: 'absolute', top: '-6px', right: '-6px', background: '#e53e3e', color: '#fff', fontSize: '10px', fontWeight: '700', borderRadius: '20px', padding: '1px 5px', minWidth: '16px', textAlign: 'center' },
  dropdown:       { position: 'absolute', top: '44px', right: '0', width: '320px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' },
  dropdownHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' },
  dropdownTitle:  { fontSize: '14px', fontWeight: '600', color: '#1a1a1a' },
  clearBtn:       { fontSize: '12px', color: '#718096', background: 'none', border: 'none', cursor: 'pointer' },
  emptyNotif:     { padding: '2rem', textAlign: 'center' },
  notifList:      { maxHeight: '360px', overflowY: 'auto' },
  notifItem:      { display: 'flex', gap: '10px', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', alignItems: 'flex-start' },
  notifIcon:      { fontSize: '18px', flexShrink: 0, marginTop: '1px' },
  notifBody:      { flex: 1, minWidth: 0 },
  notifText:      { fontSize: '13px', color: '#1a1a1a', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  notifTime:      { fontSize: '11px', color: '#a0aec0', margin: '0' },
  unreadDot:      { width: '8px', height: '8px', borderRadius: '50%', background: '#3182ce', flexShrink: 0, marginTop: '4px' },
};