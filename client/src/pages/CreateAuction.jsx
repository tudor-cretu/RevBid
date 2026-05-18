import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MapPicker from '../components/MapPicker';
import { API_URL } from '../config';

const CATEGORIES = [
  'IT', 'Constructii', 'Transport', 'Servicii', 'Produse',
  'Auto', 'Electronice', 'Mobilier', 'Alimentar', 'Altele'
];

export default function CreateAuction() {
  const { token }  = useAuth();
  const navigate   = useNavigate();

  const [form, setForm] = useState({
    title:       '',
    description: '',
    category:    '',
    tags:        '',
    startPrice:  '',
    targetPrice: '',
    deadline:    '',
    autoExtend:  false,
  });
  const [location, setLocation] = useState({});
  const [images,   setImages]   = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleImages = e => {
    const files = Array.from(e.target.files);
    if (files.length > 5) {
      setError('Maxim 5 imagini');
      return;
    }
    setImages(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!form.title || !form.description || !form.category || !form.startPrice) {
      setError('Completeaza toate campurile obligatorii');
      return;
    }

    setLoading(true);
    try {
      // 1. Creeaza licitatia
      const res = await fetch(`${API_URL}/api/auctions`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          tags:        form.tags ? form.tags.split(',').map(t => t.trim()) : [],
          startPrice:  parseFloat(form.startPrice),
          targetPrice: form.targetPrice ? parseFloat(form.targetPrice) : null,
          deadline:    form.deadline || null,
          location,
        }),
      });

      const auction = await res.json();
      if (!res.ok) {
        setError(auction.message);
        return;
      }

      // 2. Upload imagini daca exista
      if (images.length > 0) {
        const formData = new FormData();
        images.forEach(img => formData.append('images', img));

        await fetch(`${API_URL}/api/upload/auction/${auction._id}`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}` },
          body:    formData,
        });
      }

      navigate('/dashboard');

    } catch (err) {
      setError('Eroare de conexiune');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>
            ← Inapoi
          </button>
          <h1 style={styles.title}>Licitatie noua</h1>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Informatii generale */}
          <Section title="Informatii generale">
            <FormGroup label="Titlu *">
              <input
                style={styles.input} name="title"
                placeholder="ex: Caut laptop i5 min 8GB RAM"
                value={form.title} onChange={handleChange} required
              />
            </FormGroup>

            <FormGroup label="Descriere *">
              <textarea
                style={{ ...styles.input, height: '100px', resize: 'vertical' }}
                name="description"
                placeholder="Descrie produsul sau serviciul dorit, specificatii tehnice, conditii..."
                value={form.description} onChange={handleChange} required
              />
            </FormGroup>

            <div style={styles.row}>
              <FormGroup label="Categorie *">
                <select style={styles.input} name="category" value={form.category} onChange={handleChange} required>
                  <option value="">Selecteaza...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormGroup>

              <FormGroup label="Taguri (separate prin virgula)">
                <input
                  style={styles.input} name="tags"
                  placeholder="ex: laptop, second-hand, i5"
                  value={form.tags} onChange={handleChange}
                />
              </FormGroup>
            </div>
          </Section>

          {/* Preturi */}
          <Section title="Preturi">
            <div style={styles.row}>
              <FormGroup label="Pret de start (RON) *">
                <input
                  style={styles.input} name="startPrice" type="number" min="1"
                  placeholder="ex: 3000"
                  value={form.startPrice} onChange={handleChange} required
                />
              </FormGroup>

              <FormGroup label="Pret tinta (RON) — optional">
                <input
                  style={styles.input} name="targetPrice" type="number" min="1"
                  placeholder="Pretul minim acceptat"
                  value={form.targetPrice} onChange={handleChange}
                />
              </FormGroup>
            </div>
          </Section>

          {/* Deadline */}
          <Section title="Termen limita">
            <div style={styles.row}>
              <FormGroup label="Deadline">
                <input
                  style={styles.input} name="deadline" type="datetime-local"
                  value={form.deadline} onChange={handleChange}
                />
              </FormGroup>

              <FormGroup label="">
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox" name="autoExtend"
                    checked={form.autoExtend} onChange={handleChange}
                    style={{ marginRight: '8px' }}
                  />
                  Auto-extend (prelungire automata cu 5 min daca vine o oferta in ultimele 2 min)
                </label>
              </FormGroup>
            </div>
          </Section>

          {/* Imagini */}
          <Section title="Fotografii produs">
            <input
              type="file" accept="image/*" multiple
              onChange={handleImages}
              style={{ fontSize: '13px', color: '#718096' }}
            />
            <p style={styles.hint}>Maxim 5 imagini, 5MB fiecare</p>

            {previews.length > 0 && (
              <div style={styles.previews}>
                {previews.map((src, i) => (
                  <img key={i} src={src} alt="" style={styles.preview} />
                ))}
              </div>
            )}
          </Section>

          {/* Locatie */}
          <Section title="Locatie (optional)">
            <MapPicker value={location} onChange={setLocation} />
          </Section>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit" style={styles.submitBtn} disabled={loading}
          >
            {loading ? 'Se creeaza...' : 'Creeaza licitatia'}
          </button>

        </form>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#718096', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function FormGroup({ label, children }) {
  return (
    <div style={{ flex: 1, marginBottom: '12px' }}>
      {label && <label style={{ fontSize: '13px', color: '#4a5568', display: 'block', marginBottom: '4px' }}>{label}</label>}
      {children}
    </div>
  );
}

const styles = {
  page:         { minHeight: '100vh', background: '#f7f8fa', padding: '2rem' },
  card:         { maxWidth: '720px', margin: '0 auto', background: '#fff', borderRadius: '12px', padding: '2rem', border: '1px solid #e2e8f0' },
  cardHeader:   { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '2rem' },
  backBtn:      { background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: '#718096' },
  title:        { fontSize: '20px', fontWeight: '700', margin: '0' },
  row:          { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  input:        { width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#fff', color: '#1a1a1a' },
  checkboxLabel:{ display: 'flex', alignItems: 'flex-start', fontSize: '13px', color: '#4a5568', cursor: 'pointer', marginTop: '24px' },
  hint:         { fontSize: '12px', color: '#a0aec0', marginTop: '4px' },
  previews:     { display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' },
  preview:      { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' },
  error:        { color: '#e53e3e', fontSize: '13px', marginBottom: '12px' },
  submitBtn:    { width: '100%', padding: '12px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
};