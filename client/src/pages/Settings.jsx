import { useState, useRef } from 'react';
import { useNavigate }      from 'react-router-dom';
import { useAuth }          from '../context/AuthContext';
import { API_URL }          from '../config';

export default function Settings() {
  const { user, token, login, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef  = useRef();

  const [form, setForm] = useState({
    firstName:   user?.firstName   || '',
    lastName:    user?.lastName    || '',
    phone:       user?.phone       || '',
    companyName: user?.companyName || '',
    city:        user?.city        || '',
  });

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });

  const [tab,          setTab]          = useState('profile');
  const [msg,          setMsg]          = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePasswordChange = e =>
    setPasswords(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Salveaza profil ────────────────────────────────────────────
  const handleSaveProfile = async e => {
    e.preventDefault();
    setMsg(''); setError(''); setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/settings`, {
        method:  'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      login(data, token);
      setMsg('Profil actualizat cu succes!');
    } catch {
      setError('Eroare de conexiune');
    } finally {
      setLoading(false);
    }
  };

  // ── Upload avatar ──────────────────────────────────────────────
  const handleAvatarUpload = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setMsg(''); setError('');

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res  = await fetch(`${API_URL}/api/auth/avatar`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      login(data, token);
      setMsg('Poza de profil actualizata!');
    } catch {
      setError('Eroare upload');
    }
  };

  // ── Schimba parola ─────────────────────────────────────────────
  const handleChangePassword = async e => {
    e.preventDefault();
    setMsg(''); setError('');

    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Parolele noi nu coincid');
      return;
    }
    if (passwords.newPassword.length < 6) {
      setError('Parola noua trebuie sa aiba minim 6 caractere');
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/auth/change-password`, {
        method:  'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword:     passwords.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setMsg('Parola schimbata cu succes!');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      setError('Eroare de conexiune');
    } finally {
      setLoading(false);
    }
  };

  // ── Sterge cont ────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    try {
      await fetch(`${API_URL}/api/auth/account`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      logout();
      navigate('/login');
    } catch {
      setError('Eroare la stergerea contului');
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Setari cont</h1>

        {/* Tabs */}
        <div style={styles.tabs}>
          {['profile', 'security', 'danger'].map(t => (
            <button
              key={t}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              onClick={() => { setTab(t); setMsg(''); setError(''); }}
            >
              {{ profile: 'Profil', security: 'Securitate', danger: 'Cont' }[t]}
            </button>
          ))}
        </div>

        {msg   && <div style={styles.success}>{msg}</div>}
        {error && <div style={styles.errorBox}>{error}</div>}

        {/* ── TAB PROFIL ─────────────────────────────────────── */}
        {tab === 'profile' && (
          <div style={styles.card}>

            {/* Avatar */}
            <div style={styles.avatarSection}>
              <div style={styles.avatarWrap} onClick={() => fileRef.current.click()}>
                {user?.avatar ? (
                  <img src={user.avatar} alt="" style={styles.avatarImg} />
                ) : (
                  <div style={styles.avatarFallback}>
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                )}
                <div style={styles.avatarOverlay}>📷</div>
              </div>
              <input
                ref={fileRef} type="file" accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarUpload}
              />
              <div>
                <p style={styles.avatarName}>{user?.firstName} {user?.lastName}</p>
                <p style={styles.avatarRole}>{user?.role} · {user?.email}</p>
                <p style={styles.avatarHint}>Click pe poza pentru a o schimba</p>
              </div>
            </div>

            <div style={styles.divider} />

            {/* Form profil */}
            <form onSubmit={handleSaveProfile} style={styles.form}>
              <div style={styles.row}>
                <FormGroup label="Prenume">
                  <input style={styles.input} name="firstName"
                    value={form.firstName} onChange={handleChange} />
                </FormGroup>
                <FormGroup label="Nume">
                  <input style={styles.input} name="lastName"
                    value={form.lastName} onChange={handleChange} />
                </FormGroup>
              </div>

              <FormGroup label="Telefon">
                <input style={styles.input} name="phone" placeholder="+40..."
                  value={form.phone} onChange={handleChange} />
              </FormGroup>

              <FormGroup label="Oras">
                <input style={styles.input} name="city" placeholder="ex: Bucuresti"
                  value={form.city} onChange={handleChange} />
              </FormGroup>

              {user?.role === 'supplier' && (
                <FormGroup label="Nume companie">
                  <input style={styles.input} name="companyName"
                    value={form.companyName} onChange={handleChange} />
                </FormGroup>
              )}

              <button style={styles.saveBtn} type="submit" disabled={loading}>
                {loading ? 'Se salveaza...' : 'Salveaza modificarile'}
              </button>
            </form>
          </div>
        )}

        {/* ── TAB SECURITATE ─────────────────────────────────── */}
        {tab === 'security' && (
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Schimba parola</h3>

            {!user?.passwordHash && user?.googleId ? (
              <div style={styles.infoBox}>
                Contul tau este autentificat prin Google — nu ai o parola setata.
              </div>
            ) : (
              <form onSubmit={handleChangePassword} style={styles.form}>
                <FormGroup label="Parola curenta">
                  <input style={styles.input} type="password" name="currentPassword"
                    value={passwords.currentPassword} onChange={handlePasswordChange} required />
                </FormGroup>
                <FormGroup label="Parola noua">
                  <input style={styles.input} type="password" name="newPassword"
                    value={passwords.newPassword} onChange={handlePasswordChange} required />
                </FormGroup>
                <FormGroup label="Confirma parola noua">
                  <input style={styles.input} type="password" name="confirmPassword"
                    value={passwords.confirmPassword} onChange={handlePasswordChange} required />
                </FormGroup>
                <button style={styles.saveBtn} type="submit" disabled={loading}>
                  {loading ? 'Se schimba...' : 'Schimba parola'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── TAB CONT / DANGER ZONE ─────────────────────────── */}
        {tab === 'danger' && (
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Zona periculoasa</h3>

            <div style={styles.dangerBox}>
              <div>
                <p style={styles.dangerTitle}>Sterge contul</p>
                <p style={styles.dangerDesc}>
                  Aceasta actiune este ireversibila. Toate datele tale vor fi sterse permanent.
                </p>
              </div>
              <button
                style={styles.deleteBtn}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Sterge contul
              </button>
            </div>

            {/* Confirmare stergere */}
            {showDeleteConfirm && (
              <div style={styles.confirmBox}>
                <p style={styles.confirmText}>
                  Esti sigur? Aceasta actiune <strong>nu poate fi anulata</strong>.
                </p>
                <div style={styles.confirmBtns}>
                  <button style={styles.cancelBtn} onClick={() => setShowDeleteConfirm(false)}>
                    Anuleaza
                  </button>
                  <button style={styles.deleteBtn} onClick={handleDeleteAccount}>
                    Da, sterge contul meu
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FormGroup({ label, children }) {
  return (
    <div style={{ marginBottom: '12px', flex: 1 }}>
      <label style={{ fontSize: '13px', color: '#4a5568', display: 'block', marginBottom: '4px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const styles = {
  page:          { minHeight: '100vh', background: '#f7f8fa', padding: '2rem' },
  container:     { maxWidth: '600px', margin: '0 auto' },
  title:         { fontSize: '22px', fontWeight: '700', marginBottom: '1.5rem' },
  tabs:          { display: 'flex', gap: '4px', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' },
  tab:           { padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: '#718096', borderBottom: '2px solid transparent', marginBottom: '-1px' },
  tabActive:     { color: '#1a1a1a', fontWeight: '600', borderBottom: '2px solid #1a1a1a' },
  card:          { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' },
  avatarSection: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' },
  avatarWrap:    { position: 'relative', cursor: 'pointer', flexShrink: 0 },
  avatarImg:     { width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover' },
  avatarFallback:{ width: '72px', height: '72px', borderRadius: '50%', background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '600' },
  avatarOverlay: { position: 'absolute', bottom: 0, right: 0, background: '#1a1a1a', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' },
  avatarName:    { fontSize: '16px', fontWeight: '600', margin: '0 0 2px' },
  avatarRole:    { fontSize: '13px', color: '#718096', margin: '0 0 2px' },
  avatarHint:    { fontSize: '12px', color: '#a0aec0', margin: '0' },
  divider:       { height: '1px', background: '#e2e8f0', margin: '1rem 0' },
  form:          { display: 'flex', flexDirection: 'column', gap: '4px' },
  row:           { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  input:         { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' },
  saveBtn:       { padding: '10px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer', marginTop: '8px' },
  sectionTitle:  { fontSize: '15px', fontWeight: '600', marginBottom: '1rem', marginTop: '0' },
  infoBox:       { background: '#EBF8FF', border: '1px solid #BEE3F8', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#2B6CB0' },
  dangerBox:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', padding: '1rem', gap: '1rem' },
  dangerTitle:   { fontSize: '14px', fontWeight: '600', color: '#C53030', margin: '0 0 4px' },
  dangerDesc:    { fontSize: '13px', color: '#718096', margin: '0' },
  deleteBtn:     { padding: '8px 16px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' },
  confirmBox:    { marginTop: '1rem', background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', padding: '1rem' },
  confirmText:   { fontSize: '14px', color: '#C53030', marginBottom: '12px' },
  confirmBtns:   { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  cancelBtn:     { padding: '8px 16px', background: '#fff', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' },
  success:       { background: '#F0FFF4', border: '1px solid #C6F6D5', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#276749', marginBottom: '1rem' },
  errorBox:      { background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#C53030', marginBottom: '1rem' },
};