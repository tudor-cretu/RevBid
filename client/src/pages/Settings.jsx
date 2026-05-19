import { useState, useRef } from 'react';
import { useNavigate }      from 'react-router-dom';
import { useAuth }          from '../context/AuthContext';
import { API_URL }          from '../config';

export default function Settings() {
  const { user, token, login, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef  = useRef();
  const [form, setForm] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '', companyName: user?.companyName || '', city: user?.city || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [tab, setTab] = useState('profile');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handlePasswordChange = e => setPasswords(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSaveProfile = async e => {
    e.preventDefault(); setMsg(''); setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const data = await res.json(); if (!res.ok) { setError(data.message); return; }
      login(data, token); setMsg('Profil actualizat cu succes!');
    } catch { setError('Eroare de conexiune'); } finally { setLoading(false); }
  };

  const handleAvatarUpload = async e => {
    const file = e.target.files[0]; if (!file) return; setMsg(''); setError('');
    const formData = new FormData(); formData.append('avatar', file);
    try {
      const res = await fetch(`${API_URL}/api/auth/avatar`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json(); if (!res.ok) { setError(data.message); return; }
      login(data, token); setMsg('Poza de profil actualizata!');
    } catch { setError('Eroare upload'); }
  };

  const handleChangePassword = async e => {
    e.preventDefault(); setMsg(''); setError('');
    if (passwords.newPassword !== passwords.confirmPassword) { setError('Parolele noi nu coincid'); return; }
    if (passwords.newPassword.length < 6) { setError('Parola noua trebuie sa aiba minim 6 caractere'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }) });
      const data = await res.json(); if (!res.ok) { setError(data.message); return; }
      setMsg('Parola schimbata cu succes!'); setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch { setError('Eroare de conexiune'); } finally { setLoading(false); }
  };

  const handleDeleteAccount = async () => {
    try { await fetch(`${API_URL}/api/auth/account`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); logout(); navigate('/login'); }
    catch { setError('Eroare la stergerea contului'); }
  };

  return (
    <div className="page">
      <div className="container-sm">
        <h1 className="page-title" style={{ marginBottom: '1.5rem' }}>⚙️ Setari cont</h1>

        <div className="tabs">
          {['profile', 'security', 'danger'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setMsg(''); setError(''); }}>
              {{ profile: '👤 Profil', security: '🔒 Securitate', danger: '⚠️ Cont' }[t]}
            </button>
          ))}
        </div>

        {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{msg}</div>}
        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {tab === 'profile' && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} onClick={() => fileRef.current.click()}>
                {user?.avatar ? (
                  <img src={user.avatar} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--soft-aqua)' }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--primary-navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, border: '3px solid var(--soft-aqua)' }}>
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--bid-teal)', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: '2px solid var(--bg-card)' }}>📷</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
              <div>
                <p style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 2px', color: 'var(--text-heading)' }}>{user?.firstName} {user?.lastName}</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0 0 2px' }}>{user?.role} · {user?.email}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click pe poza pentru a o schimba</p>
              </div>
            </div>

            <div className="divider" />

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Prenume</label><input className="form-input" name="firstName" value={form.firstName} onChange={handleChange} /></div>
                <div className="form-group"><label className="form-label">Nume</label><input className="form-input" name="lastName" value={form.lastName} onChange={handleChange} /></div>
              </div>
              <div className="form-group"><label className="form-label">Telefon</label><input className="form-input" name="phone" placeholder="+40..." value={form.phone} onChange={handleChange} /></div>
              <div className="form-group"><label className="form-label">Oras</label><input className="form-input" name="city" placeholder="ex: Bucuresti" value={form.city} onChange={handleChange} /></div>
              {user?.role === 'supplier' && (
                <div className="form-group"><label className="form-label">Nume companie</label><input className="form-input" name="companyName" value={form.companyName} onChange={handleChange} /></div>
              )}
              <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: '8px' }}>
                {loading ? 'Se salveaza...' : 'Salveaza modificarile'}
              </button>
            </form>
          </div>
        )}

        {tab === 'security' && (
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>Schimba parola</h3>
            {!user?.passwordHash && user?.googleId ? (
              <div className="alert alert-info">Contul tau este autentificat prin Google — nu ai o parola setata.</div>
            ) : (
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div className="form-group"><label className="form-label">Parola curenta</label><input className="form-input" type="password" name="currentPassword" value={passwords.currentPassword} onChange={handlePasswordChange} required /></div>
                <div className="form-group"><label className="form-label">Parola noua</label><input className="form-input" type="password" name="newPassword" value={passwords.newPassword} onChange={handlePasswordChange} required /></div>
                <div className="form-group"><label className="form-label">Confirma parola noua</label><input className="form-input" type="password" name="confirmPassword" value={passwords.confirmPassword} onChange={handlePasswordChange} required /></div>
                <button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading ? 'Se schimba...' : 'Schimba parola'}</button>
              </form>
            )}
          </div>
        )}

        {tab === 'danger' && (
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>Zona periculoasa</h3>
            <div className="alert alert-warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontWeight: 600, color: '#92400E', margin: '0 0 4px' }}>Sterge contul</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>Aceasta actiune este ireversibila. Toate datele vor fi sterse.</p>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>Sterge contul</button>
            </div>
            {showDeleteConfirm && (
              <div className="alert alert-error" style={{ marginTop: '1rem' }}>
                <div style={{ width: '100%' }}>
                  <p style={{ fontWeight: 600, marginBottom: '10px' }}>Esti sigur? Aceasta actiune <strong>nu poate fi anulata</strong>.</p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setShowDeleteConfirm(false)}>Anuleaza</button>
                    <button className="btn btn-danger btn-sm" onClick={handleDeleteAccount}>Da, sterge contul meu</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}