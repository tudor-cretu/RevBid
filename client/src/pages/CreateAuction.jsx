import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MapPicker from '../components/MapPicker';
import { API_URL } from '../config';

const CATEGORIES = ['IT', 'Constructii', 'Transport', 'Servicii', 'Produse', 'Auto', 'Electronice', 'Mobilier', 'Alimentar', 'Altele'];

export default function CreateAuction() {
  const { token } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', category: '', tags: '', startPrice: '', targetPrice: '', deadline: '', autoExtend: false });
  const [location, setLocation] = useState({});
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleImages = e => {
    const files = Array.from(e.target.files);
    if (files.length > 5) { setError('Maxim 5 imagini'); return; }
    setImages(files); setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleSubmit = async e => {
    e.preventDefault(); setError('');
    if (!form.title || !form.description || !form.category || !form.startPrice) { setError('Completeaza toate campurile obligatorii'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auctions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [], startPrice: parseFloat(form.startPrice), targetPrice: form.targetPrice ? parseFloat(form.targetPrice) : null, deadline: form.deadline || null, location }),
      });
      const auction = await res.json();
      if (!res.ok) { setError(auction.message); return; }
      if (images.length > 0) {
        const formData = new FormData();
        images.forEach(img => formData.append('images', img));
        await fetch(`${API_URL}/api/upload/auction/${auction._id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      }
      navigate('/dashboard');
    } catch { setError('Eroare de conexiune'); } finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div className="container-md" style={{ maxWidth: '720px' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '2rem' }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/dashboard')}>← Inapoi</button>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>📋 Licitatie noua</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <Section title="Informatii generale">
              <div className="form-group">
                <label className="form-label">Titlu *</label>
                <input className="form-input" name="title" placeholder="ex: Caut laptop i5 min 8GB RAM" value={form.title} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Descriere *</label>
                <textarea className="form-input" name="description" placeholder="Descrie produsul sau serviciul dorit, specificatii tehnice, conditii..." value={form.description} onChange={handleChange} required style={{ height: '100px', resize: 'vertical' }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Categorie *</label>
                  <select className="form-select" name="category" value={form.category} onChange={handleChange} required>
                    <option value="">Selecteaza...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Taguri (separate prin virgula)</label>
                  <input className="form-input" name="tags" placeholder="ex: laptop, second-hand, i5" value={form.tags} onChange={handleChange} />
                </div>
              </div>
            </Section>

            <Section title="Preturi">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Pret de start (RON) *</label>
                  <input className="form-input" name="startPrice" type="number" min="1" placeholder="ex: 3000" value={form.startPrice} onChange={handleChange} required />
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
                  <label className="form-label">Deadline</label>
                  <input className="form-input" name="deadline" type="datetime-local" value={form.deadline} onChange={handleChange} />
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
              <input type="file" accept="image/*" multiple onChange={handleImages} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} />
              <span className="form-hint" style={{ display: 'block', marginTop: '4px' }}>Maxim 5 imagini, 5MB fiecare</span>
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

            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
              {loading ? 'Se creeaza...' : 'Creeaza licitatia'}
            </button>
          </form>
        </div>
      </div>
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