import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav style={styles.nav}>
      <div style={styles.inner}>

        {/* Logo */}
        <span style={styles.logo} onClick={() => navigate('/dashboard')}>
          RevBid
        </span>

        {/* Dreapta */}
        <div style={styles.right}>

          {user.role === 'admin' && (
            <button style={styles.link} onClick={() => navigate('/admin')}>
              Admin
            </button>
          )}

          <button style={styles.link} onClick={() => navigate('/support')}>
            Support
          </button>

          <button style={styles.link} onClick={() => navigate('/messages')}>
            Mesaje
          </button>

          {/* Avatar + nume */}
          <div style={styles.userInfo}>
            {user.avatar ? (
              <img src={user.avatar} alt="" style={styles.avatar} />
            ) : (
              <div style={styles.avatarFallback}>
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
            )}
            <span style={styles.userName}>
              {user.firstName} {user.lastName}
            </span>
            <span style={styles.roleBadge}>{user.role}</span>
          </div>

          {/* Rotita setari */}
          <button style={styles.iconBtn} onClick={() => navigate('/settings')} title="Setari cont">
            ⚙️
          </button>

          {/* Logout */}
          <button style={styles.logoutBtn} onClick={handleLogout}>
            Deconectare
          </button>
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
};