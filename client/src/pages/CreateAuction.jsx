import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MapPicker from '../components/MapPicker';
import DateTimePicker from '../components/DateTimePicker';
import { API_URL } from '../config';
import { fmtDeadline, toDatetimeLocal } from '../utils/format';

const CATEGORIES = ['IT', 'Constructii', 'Transport', 'Servicii', 'Produse', 'Auto', 'Electronice', 'Mobilier', 'Alimentar', 'Altele'];

/* Câmpuri obligatorii pentru PUBLICARE (drafturile pot fi incomplete). */
const PUBLISH_REQUIRED = [
  { key: 'title',       label: 'Titlu' },
  { key: 'description', label: 'Descriere' },
  { key: 'category',    label: 'Categorie' },
  { key: 'quantity',    label: 'Cantitate' },
  { key: 'startPrice',  label: 'Buget de pornire' },
  { key: 'deadline',    label: 'Deadline' },
];

const emptyForm = () => ({
  title: '', description: '', category: '', quantity: '',
  tags: '', startPrice: '', targetPrice: '', deadline: '', autoExtend: false,
});

/* Determină ce câmpuri obligatorii pentru publicare lipsesc. */
function missingForPublish(form) {
  const miss = [];
  for (const { key, label } of PUBLISH_REQUIRED) {
    const v = form[key];
    if (key === 'startPrice') {
      const n = parseFloat(v);
      if (!v || isNaN(n) || n <= 0) miss.push(label);
    } else if (!String(v || '').trim()) {
      miss.push(label);
    }
  }
  return miss;
}

export default function CreateAuction() {
  const { token }  = useAuth();
  const navigate   = useNavigate();
  const { id }     = useParams();
  const editMode   = !!id;

  const [form, setForm]         = useState(emptyForm());
  const [location, setLocation] = useState({});
  const [images, setImages]     = useState([]);
  const [previews, setPreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [loadingDraft, setLoadingDraft]     = useState(editMode);
  const [busy, setBusy]         = useState('');   // '', 'draft', 'publish'
  const [error, setError]       = useState('');
  const [deadlineError, setDeadlineError] = useState('');

  /* ── Mod editare: încarcă draftul existent ── */
  useEffect(() => {
    if (!editMode) return;
    (async () => {
      try {
        const res  = await fetch(`${API_URL}/api/auctions/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message || 'Nu s-a putut încărca licitația.'); return; }
        if (data.status !== 'draft') {
          // Licitațiile publicate se editează prin approval flow.
          navigate(`/auction/${id}`, { replace: true });
          return;
        }
        setForm({
          title:       data.title       || '',
          description: data.description || '',
          category:    data.category    || '',
          quantity:    data.quantity    || '',
          tags:        (data.tags || []).join(', '),
          startPrice:  data.startPrice  ?? '',
          targetPrice: data.targetPrice ?? '',
          deadline:    toDatetimeLocal(data.deadline),
          autoExtend:  data.autoExtend  || false,
        });
        setLocation(data.location || {});
        setExistingImages(data.images || []);
      } catch {
        setError('Eroare de conexiune.');
      } finally {
        setLoadingDraft(false);
      }
    })();
  }, [id]);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (name === 'deadline') setDeadlineError('');
  };

  const handleImages = e => {
    const files = Array.from(e.target.files);
    if (files.length + existingImages.length > 5) { setError('Maxim 5 imagini per licitație'); return; }
    setError('');
    setImages(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  /* Construiește payload-ul trimis către server. */
  const buildPayload = () => ({
    title:       form.title.trim(),
    description: form.description.trim(),
    category:    form.category,
    quantity:    form.quantity.trim(),
    tags:        form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    startPrice:  form.startPrice === '' ? '' : parseFloat(form.startPrice),
    targetPrice: form.targetPrice ? parseFloat(form.targetPrice) : null,
    deadline:    form.deadline || null,
    autoExtend:  form.autoExtend,
    location,
  });

  /* Încarcă imaginile noi pentru o licitație existentă. */
  const uploadImages = async (auctionId) => {
    if (images.length === 0) return;
    const fd = new FormData();
    images.forEach(img => fd.append('images', img));
    await fetch(`${API_URL}/api/upload/auction/${auctionId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
  };

  /* ── Salvează ca draft ── */
  const saveDraft = async () => {
    setError(''); setDeadlineError(''); setBusy('draft');
    try {
      const payload = buildPayload();
      let auctionId = id;

      if (editMode) {
        const res  = await fetch(`${API_URL}/api/auctions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message || 'Eroare la salvarea draftului.'); return; }
      } else {
        const res  = await fetch(`${API_URL}/api/auctions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...payload, status: 'draft' }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message || 'Eroare la crearea draftului.'); return; }
        auctionId = data._id;
      }

      await uploadImages(auctionId);
      navigate('/dashboard?tab=draft');
    } catch {
      setError('Eroare de conexiune.');
    } finally {
      setBusy('');
    }
  };

  /* ── Publică licitația ── */
  const publish = async () => {
    setError(''); setDeadlineError('');

    // Validare client — câmpuri obligatorii
    const miss = missingForPublish(form);
    if (miss.length > 0) {
      setError(`Pentru publicare completează: ${miss.join(', ')}.`);
      return;
    }
    // Deadline în viitor
    if (new Date(form.deadline).getTime() <= Date.now()) {
      setDeadlineError('Deadline-ul trebuie să fie în viitor.');
      setError('Corectează deadline-ul înainte de publicare.');
      return;
    }

    setBusy('publish');
    try {
      const payload = buildPayload();
      let auctionId = id;

      if (editMode) {
        await uploadImages(id);
        const res  = await fetch(`${API_URL}/api/auctions/${id}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || 'Eroare la publicare.');
          if (data.errors?.deadline) setDeadlineError(data.errors.deadline);
          return;
        }
      } else {
        const res  = await fetch(`${API_URL}/api/auctions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...payload, status: 'active' }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || 'Eroare la publicare.');
          if (data.errors?.deadline) setDeadlineError(data.errors.deadline);
          return;
        }
        auctionId = data._id;
        await uploadImages(auctionId);
      }

      navigate(`/auction/${auctionId}`);
    } catch {
      setError('Eroare de conexiune.');
    } finally {
      setBusy('');
    }
  };

  if (loadingDraft) {
    return (
      <div className="page">
        <div className="container-md" style={{ maxWidth: '720px' }}>
          <p className="loading-text">Se încarcă draftul...</p>
        </div>
      </div>
    );
  }

  const missing       = missingForPublish(form);
  const readyToPublish = missing.length === 0;
  const totalImages   = existingImages.length + images.length;

  return (
    <div className="page">
      <div className="container-md" style={{ maxWidth: '720px' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/dashboard')}>← Inapoi</button>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              {editMode ? '✏️ Editează draftul' : '📋 Licitatie noua'}
            </h1>
          </div>

          <form onSubmit={e => e.preventDefault()}>
            <Section title="Informatii generale">
              <div className="form-group">
                <label className="form-label">Titlu *</label>
                <input className="form-input" name="title" placeholder="ex: Lalele rosii" value={form.title} onChange={handleChange} />
                <span className="form-hint">Pune doar denumirea produsului/serviciului — cantitatea se completeaza separat.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Descriere *</label>
                <textarea className="form-input" name="description" placeholder="Descrie produsul sau serviciul dorit, specificatii tehnice, conditii..." value={form.description} onChange={handleChange} style={{ height: '100px', resize: 'vertical' }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Categorie *</label>
                  <select className="form-select" name="category" value={form.category} onChange={handleChange}>
                    <option value="">Selecteaza...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Cantitate *</label>
                  <input className="form-input" name="quantity" placeholder="ex: 1000 buc" value={form.quantity} onChange={handleChange} maxLength={60} />
                  <span className="form-hint">Ex: 1000 buc, 15 laptopuri, 3 luni, 200 kg</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Taguri (separate prin virgula)</label>
                <input className="form-input" name="tags" placeholder="ex: lalele, flori, decoratiuni" value={form.tags} onChange={handleChange} />
              </div>
            </Section>

            <Section title="Preturi">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Buget de pornire (RON) *</label>
                  <input className="form-input" name="startPrice" type="number" min="1" placeholder="ex: 3000" value={form.startPrice} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Pret tinta (RON) — optional</label>
                  <input className="form-input" name="targetPrice" type="number" min="1" placeholder="Pretul minim acceptat" value={form.targetPrice} onChange={handleChange} />
                  <span className="form-hint">Pretul sub care nu esti dispus sa accepti</span>
                </div>
              </div>
            </Section>

            <Section title="Termen limita">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Deadline *</label>
                  <DateTimePicker
                    value={form.deadline}
                    onChange={val => { setForm(p => ({ ...p, deadline: val })); setDeadlineError(''); }}
                    error={!!deadlineError}
                  />
                  {deadlineError
                    ? <span className="form-hint" style={{ color: 'var(--error-red)' }}>{deadlineError}</span>
                    : <span className="form-hint">
                        {form.deadline
                          ? `Se inchide la: ${fmtDeadline(form.deadline)}`
                          : 'Format: dd/mm/yyyy ora:minut (24h)'}
                      </span>}
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', fontSize: '0.8125rem', color: 'var(--text-body)', cursor: 'pointer', gap: '8px' }}>
                    <input type="checkbox" name="autoExtend" checked={form.autoExtend} onChange={handleChange} style={{ marginTop: '3px', accentColor: 'var(--bid-teal)' }} />
                    Auto-extend (prelungire automata cu 5 min daca vine o oferta in ultimele 2 min)
                  </label>
                </div>
              </div>
            </Section>

            <Section title="Fotografii produs">
              {existingImages.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {existingImages.map((img, i) => (
                    <img key={i} src={img.url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
                  ))}
                </div>
              )}
              <input type="file" accept="image/*" multiple onChange={handleImages} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} />
              <span className="form-hint" style={{ display: 'block', marginTop: '4px' }}>
                Maxim 5 imagini, 5MB fiecare {totalImages > 0 && `· ${totalImages}/5 selectate`}
              </span>
              {previews.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {previews.map((src, i) => (
                    <img key={i} src={src} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
                  ))}
                </div>
              )}
            </Section>

            <Section title="Locatie (optional)">
              <MapPicker value={location} onChange={setLocation} />
            </Section>

            {/* Sumar câmpuri lipsă pentru publicare */}
            <div className={`ca-checklist ${readyToPublish ? 'ok' : ''}`}>
              {readyToPublish ? (
                <p className="ca-checklist-title">✅ Toate câmpurile obligatorii sunt completate — licitația poate fi publicată.</p>
              ) : (
                <>
                  <p className="ca-checklist-title">Câmpuri necesare pentru publicare:</p>
                  <div className="ca-checklist-chips">
                    {PUBLISH_REQUIRED.map(({ key, label }) => (
                      <span key={key} className={`ca-chip ${missing.includes(label) ? 'miss' : 'done'}`}>
                        {missing.includes(label) ? '○' : '✓'} {label}
                      </span>
                    ))}
                  </div>
                  <p className="ca-checklist-note">
                    Poți salva oricând ca draft și reveni mai târziu pentru completare.
                  </p>
                </>
              )}
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <div className="ca-actions">
              <button
                type="button"
                className="btn btn-outline btn-lg"
                onClick={saveDraft}
                disabled={!!busy}
              >
                {busy === 'draft' ? 'Se salveaza...' : '💾 Salveaza ca draft'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={publish}
                disabled={!!busy}
              >
                {busy === 'publish' ? 'Se publica...' : '🚀 Publica licitatia'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <style>{caCSS}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1.75rem' }}>
      <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
      {children}
    </div>
  );
}

const caCSS = `
.ca-checklist {
  background: var(--ice-blue); border: 1px solid var(--border-light);
  border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 1rem;
}
.ca-checklist.ok { background: #ECFDF5; border-color: #A7F3D0; }
.ca-checklist-title {
  font-size: 0.8125rem; font-weight: 600; color: var(--text-heading); margin: 0 0 8px;
}
.ca-checklist.ok .ca-checklist-title { margin: 0; color: #065F46; }
.ca-checklist-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ca-chip {
  font-size: 0.75rem; font-weight: 600; padding: 4px 9px;
  border-radius: var(--radius-full); border: 1px solid transparent;
}
.ca-chip.miss { background: #FEF2F2; color: #991B1B; border-color: #FCA5A5; }
.ca-chip.done { background: #DCFCE7; color: #065F46; border-color: #A7F3D0; }
.ca-checklist-note { font-size: 0.6875rem; color: var(--text-muted); margin: 8px 0 0; }
.ca-actions { display: flex; gap: 10px; }
.ca-actions .btn { flex: 1; }
@media (max-width: 480px) { .ca-actions { flex-direction: column; } }
`;
