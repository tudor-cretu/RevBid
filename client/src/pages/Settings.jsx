import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth }          from '../context/AuthContext';
import { API_URL }          from '../config';

/* ── Helpers date companie (pure, în afara componentei) ── */
const TAX_ID_RE  = /^(RO)?\d{2,10}$/i;
const REG_NUM_RE = /^[JFC]\d{1,2}\/\d{1,7}\/\d{4}$/i;

const emptyCompany = () => ({
  legalName: '', taxId: '', tradeRegisterNumber: '',
  country: 'România', county: '', city: '', street: '', number: '',
  building: '', staircase: '', floor: '', apartment: '', postalCode: '',
});

/* API (cu address imbricat) → formular plat */
const toFormShape = (c = {}) => {
  const a = c.address || {};
  return {
    legalName:           c.legalName || '',
    taxId:               c.taxId || '',
    tradeRegisterNumber: c.tradeRegisterNumber || '',
    country:    a.country || 'România',
    county:     a.county || '',
    city:       a.city || '',
    street:     a.street || '',
    number:     a.number || '',
    building:   a.building || '',
    staircase:  a.staircase || '',
    floor:      a.floor || '',
    apartment:  a.apartment || '',
    postalCode: a.postalCode || '',
  };
};

/* Formular plat → payload API (cu address imbricat) */
const toApiShape = f => ({
  legalName:           f.legalName,
  taxId:               f.taxId,
  tradeRegisterNumber: f.tradeRegisterNumber,
  address: {
    country: f.country, county: f.county, city: f.city, street: f.street,
    number: f.number, building: f.building, staircase: f.staircase,
    floor: f.floor, apartment: f.apartment, postalCode: f.postalCode,
  },
});

/* Validare client — oglindește server/utils/company.js */
const validateCompanyClient = f => {
  const errors = {};
  const taxId = (f.taxId || '').replace(/\s+/g, '').toUpperCase();
  const reg   = (f.tradeRegisterNumber || '').replace(/\s+/g, '').toUpperCase();
  const anyFilled = [
    f.legalName, taxId, reg, f.county, f.city, f.street, f.number,
    f.building, f.staircase, f.floor, f.apartment, f.postalCode,
  ].some(v => v && v.trim());

  if (anyFilled && !f.legalName.trim())
    errors.legalName = 'Denumirea completă a firmei este obligatorie.';
  if (taxId && !TAX_ID_RE.test(taxId))
    errors.taxId = 'C.U.I./C.I.F. invalid. Exemplu: 12345678 sau RO12345678.';
  if (reg && !REG_NUM_RE.test(reg))
    errors.tradeRegisterNumber = 'Format invalid. Exemplu: J40/1234/2026.';
  return errors;
};

/* Date suficiente pentru documente/invoice */
const isCompanyComplete = f =>
  Boolean(f.legalName.trim() && f.taxId.trim() && f.city.trim() && f.street.trim());

export default function Settings() {
  const { user, token, login, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileRef  = useRef();

  const [form, setForm] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '', phone: user?.phone || '', companyName: user?.companyName || '', city: user?.city || '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [tab, setTab] = useState(() => (searchParams.get('tab') === 'company' ? 'company' : 'profile'));
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Date companie / date fiscale
  const [companyForm,    setCompanyForm]    = useState(emptyCompany);
  const [companyErrors,  setCompanyErrors]  = useState({});
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companySaving,  setCompanySaving]  = useState(false);

  /* Încarcă datele companiei (fresh de la server — contextul poate fi vechi) */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (data?.company) setCompanyForm(toFormShape(data.company));
        }
      } catch { /* păstrăm formularul gol */ }
      finally { setCompanyLoading(false); }
    })();
  }, [token]);

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handlePasswordChange = e => setPasswords(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleCompanyChange = e => {
    const { name, value } = e.target;
    setCompanyForm(prev => ({ ...prev, [name]: value }));
    if (companyErrors[name]) {
      setCompanyErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
    }
  };

  const handleSaveProfile = async e => {
    e.preventDefault(); setMsg(''); setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(form) });
      const data = await res.json(); if (!res.ok) { setError(data.message); return; }
      login(data, token); setMsg('Profil actualizat cu succes!');
    } catch { setError('Eroare de conexiune'); } finally { setLoading(false); }
  };

  const handleSaveCompany = async e => {
    e.preventDefault(); setMsg(''); setError('');
    const errs = validateCompanyClient(companyForm);
    if (Object.keys(errs).length) {
      setCompanyErrors(errs);
      setError('Verifică câmpurile marcate și încearcă din nou.');
      return;
    }
    setCompanyErrors({});
    setCompanySaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/company`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(toApiShape(companyForm)),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setCompanyErrors(data.errors);
        setError(data.message || 'Nu am putut salva datele. Încearcă din nou.');
        return;
      }
      setCompanyForm(toFormShape(data.company));
      setMsg('Datele companiei au fost salvate cu succes.');
    } catch {
      setError('Nu am putut salva datele. Încearcă din nou.');
    } finally {
      setCompanySaving(false);
    }
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

  /* Câmp formular companie — funcție (nu componentă) pentru a nu remonta input-ul */
  const coField = (name, label, placeholder, help, required = false) => (
    <div className="form-group" key={name}>
      <label className="form-label">
        {label}{required && <span className="co-req"> *</span>}
      </label>
      <input
        className="form-input"
        name={name}
        placeholder={placeholder}
        value={companyForm[name]}
        onChange={handleCompanyChange}
        style={companyErrors[name] ? { borderColor: 'var(--error-red)' } : undefined}
      />
      {companyErrors[name]
        ? <span className="co-err">{companyErrors[name]}</span>
        : help ? <span className="co-help">{help}</span> : null}
    </div>
  );

  const companyComplete = isCompanyComplete(companyForm);

  return (
    <div className="page">
      <div className="container-sm">
        <h1 className="page-title" style={{ marginBottom: '1.5rem' }}>⚙️ Setari cont</h1>

        <div className="tabs">
          {['profile', 'company', 'security', 'danger'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => { setTab(t); setMsg(''); setError(''); }}>
              {{ profile: '👤 Profil', company: '🏢 Date companie', security: '🔒 Securitate', danger: '⚠️ Cont' }[t]}
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

        {tab === 'company' && (
          <div className="card">
            {companyLoading ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
                <p className="loading-text">Se încarcă datele companiei...</p>
              </div>
            ) : (
              <form onSubmit={handleSaveCompany} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {companyComplete ? (
                  <div className="co-ok">
                    <span>✓</span>
                    <p className="co-ok-text">Datele companiei sunt complete și vor fi folosite în documentele generate.</p>
                  </div>
                ) : (
                  <div className="co-warn">
                    <span style={{ fontSize: '1rem' }}>⚠️</span>
                    <p className="co-warn-text">
                      Completează datele companiei pentru ca documentele generate (rezumate tranzacție / invoice-uri)
                      să fie corecte. Datele sunt folosite la finalizarea licitațiilor.
                    </p>
                  </div>
                )}

                <p className="co-section-title">Identificare firmă</p>
                {coField(
                  'legalName', 'Denumirea completă a firmei', 'SC NUME COMPANIE SRL',
                  'Numele oficial al firmei, urmat de forma juridică. Exemplu: SC NUME COMPANIE SRL, NUME COMPANIE SA, PFA NUME PERSOANĂ.',
                )}
                <div className="form-row">
                  {coField('taxId', 'C.U.I. / C.I.F.', 'RO12345678',
                    'Cod Unic de Înregistrare / Cod de Identificare Fiscală. Prefix RO pentru plătitorii de TVA. Exemplu: RO12345678.')}
                  {coField('tradeRegisterNumber', 'Nr. Registrul Comerțului', 'J40/1234/2026',
                    'Numărul oficial de înregistrare. Exemplu: J40/1234/2026.')}
                </div>

                <div className="divider" />

                <p className="co-section-title">Sediu social</p>
                <p className="co-section-note">Adresa oficială înregistrată la Registrul Comerțului.</p>
                <div className="form-row">
                  {coField('country', 'Țară', 'România')}
                  {coField('county', 'Județ', 'ex: Cluj')}
                </div>
                <div className="form-row">
                  {coField('city', 'Localitate', 'ex: Cluj-Napoca')}
                  {coField('postalCode', 'Cod poștal', 'ex: 400001')}
                </div>
                <div className="form-row">
                  {coField('street', 'Stradă', 'ex: Calea Victoriei')}
                  {coField('number', 'Număr', 'ex: 10')}
                </div>
                <div className="form-row">
                  {coField('building', 'Bloc', 'ex: B2')}
                  {coField('staircase', 'Scară', 'ex: A')}
                </div>
                <div className="form-row">
                  {coField('floor', 'Etaj', 'ex: 3')}
                  {coField('apartment', 'Apartament', 'ex: 12')}
                </div>

                <button className="btn btn-primary btn-block" type="submit" disabled={companySaving} style={{ marginTop: '12px' }}>
                  {companySaving ? 'Se salvează...' : 'Salvează datele companiei'}
                </button>
              </form>
            )}
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

      <style>{settingsCSS}</style>
    </div>
  );
}

const settingsCSS = `
.co-section-title { font-size: 0.9375rem; font-weight: 700; color: var(--text-heading); margin: 6px 0 4px; }
.co-section-note  { font-size: 0.75rem; color: var(--text-muted); margin: 0 0 12px; }
.co-help { font-size: 0.6875rem; color: var(--text-muted); margin-top: 4px; display: block; line-height: 1.45; }
.co-err  { font-size: 0.6875rem; color: var(--error-red); margin-top: 4px; display: block; font-weight: 600; }
.co-req  { color: var(--error-red); }
.co-warn {
  display: flex; gap: 10px; align-items: flex-start;
  background: #FFFBEB; border: 1px solid #FDE68A;
  border-radius: var(--radius-md); padding: 11px 13px; margin-bottom: 16px;
}
.co-warn-text { font-size: 0.8125rem; color: #92400E; line-height: 1.5; margin: 0; }
.co-ok {
  display: flex; gap: 8px; align-items: center;
  background: #ECFDF5; border: 1px solid #A7F3D0;
  border-radius: var(--radius-md); padding: 9px 13px; margin-bottom: 16px;
}
.co-ok-text { font-size: 0.8125rem; color: #065F46; margin: 0; font-weight: 500; }
`;
