import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { fmtDeadline, toDatetimeLocal } from '../utils/format';
import DateTimePicker from '../components/DateTimePicker';

const CATEGORIES = ['IT', 'Constructii', 'Transport', 'Servicii', 'Produse', 'Auto', 'Electronice', 'Mobilier', 'Alimentar', 'Altele'];

export default function AuctionRequestForm() {
  const { id }        = useParams();
  const { token }     = useAuth();
  const navigate      = useNavigate();
  const [auction,  setAuction]  = useState(null);
  const [form,     setForm]     = useState({});
  const [reason,   setReason]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [existing, setExisting] = useState(null); // pending cerere existentă

  useEffect(() => { fetchAuction(); fetchExistingRequest(); }, [id]);

  const fetchAuction = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/auctions/${id}`);
      const data = await res.json();
      setAuction(data);
      // Pre-fill form with current values
      setForm({
        title:       data.title       || '',
        description: data.description || '',
        category:    data.category    || '',
        quantity:    data.quantity    || '',
        tags:        (data.tags || []).join(', '),
        targetPrice: data.targetPrice || '',
        deadline:    toDatetimeLocal(data.deadline),
        autoExtend:  data.autoExtend  || false,
      });
    } catch {
      setError('Nu s-a putut încărca licitația.');
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingRequest = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/auction-requests/for/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const pendingEdit = Array.isArray(data) && data.find(r => r.type === 'edit' && r.status === 'pending');
      if (pendingEdit) setExisting(pendingEdit);
    } catch {}
  };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      const payload = {
        ...form,
        tags:        form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        targetPrice: form.targetPrice ? parseFloat(form.targetPrice) : undefined,
        deadline:    form.deadline || undefined,
        reason,
      };
      const res  = await fetch(`${API_URL}/api/auction-requests/${id}/edit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        return;
      }
      setSuccess(true);
    } catch {
      setError('Eroare de conexiune. Încearcă din nou.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="loading-text">Se încarcă...</p>;
  if (!auction) return <div className="empty-state"><div className="empty-state-icon">❌</div><p>Licitația nu există.</p></div>;

  if (success) {
    return (
      <div className="page">
        <div className="container-sm" style={{ maxWidth: 640 }}>
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ marginBottom: '8px' }}>Cerere trimisă!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Cererea ta de editare pentru <strong>"{auction.title}"</strong> a fost trimisă
              și va fi revizuită de admin. Vei primi o notificare cu rezultatul.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate(`/auction/${id}`)}>
                Înapoi la licitație
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container-sm" style={{ maxWidth: 720 }}>
        <div className="card">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={() => navigate(`/auction/${id}`)}>
              ← Înapoi
            </button>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
              ✏️ Solicită editare licitație
            </h1>
          </div>

          {/* Info banner */}
          <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
            <div>
              <p style={{ fontWeight: 600, margin: '0 0 4px', color: '#1e40af' }}>
                Modificările vor fi aplicate doar după aprobarea adminului
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                Licitația rămâne activă în forma curentă până la aprobare. Nu poți trimite
                o nouă cerere de editare dacă există una în așteptare.
              </p>
            </div>
          </div>

          {/* Pending request warning */}
          {existing && (
            <div className="alert alert-warning" style={{ marginBottom: '1.5rem' }}>
              <div>
                <p style={{ fontWeight: 600, margin: '0 0 4px' }}>
                  ⚠️ Există deja o cerere de editare în așteptare
                </p>
                <p style={{ fontSize: '0.8125rem', margin: '0 0 8px' }}>
                  Trimisă la {new Date(existing.createdAt).toLocaleDateString('ro-RO')}. Anulează cererea existentă înainte de a trimite alta.
                </p>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    await fetch(`${API_URL}/api/auction-requests/${existing._id}`, {
                      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
                    });
                    setExisting(null);
                  }}
                >
                  Anulează cererea existentă
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <Section title="Informații generale">
              <div className="form-group">
                <label className="form-label">Titlu</label>
                <input className="form-input" name="title" value={form.title} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Descriere</label>
                <textarea className="form-input" name="description" value={form.description} onChange={handleChange} style={{ height: 90, resize: 'vertical' }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Categorie</label>
                  <select className="form-select" name="category" value={form.category} onChange={handleChange}>
                    <option value="">Selectează...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Cantitate</label>
                  <input className="form-input" name="quantity" value={form.quantity} onChange={handleChange} placeholder="ex: 1000 buc" maxLength={60} />
                  <span className="form-hint">
                    Curent: <strong>{auction.quantity?.trim() || '—'}</strong>
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Taguri (virgulă)</label>
                <input className="form-input" name="tags" value={form.tags} onChange={handleChange} placeholder="tag1, tag2, ..." />
              </div>
            </Section>

            <Section title="Preț și deadline">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Preț țintă (RON)</label>
                  <input className="form-input" type="number" name="targetPrice" value={form.targetPrice} onChange={handleChange} />
                  <span className="form-hint">
                    Curent: <strong>{auction.targetPrice ? `${auction.targetPrice} RON` : '—'}</strong>
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline</label>
                  <DateTimePicker
                    value={form.deadline}
                    onChange={val => setForm(p => ({ ...p, deadline: val }))}
                  />
                  <span className="form-hint">
                    Curent: <strong>{fmtDeadline(auction.deadline, '—')}</strong>
                    {form.deadline && ` · Nou: ${fmtDeadline(form.deadline)}`}
                  </span>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer' }}>
                <input type="checkbox" name="autoExtend" checked={form.autoExtend} onChange={handleChange} style={{ accentColor: 'var(--bid-teal)' }} />
                Auto-extend (prelungire automată la ofertă în ultimele 2 min)
              </label>
            </Section>

            <Section title="Motivul modificărilor (opțional)">
              <div className="form-group">
                <textarea
                  className="form-input"
                  placeholder="Explică de ce dorești să modifici această licitație..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  style={{ height: 70, resize: 'vertical' }}
                />
              </div>
            </Section>

            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <button
              className="btn btn-primary btn-block btn-lg"
              type="submit"
              disabled={submitting || !!existing}
              style={{ marginTop: '8px' }}
            >
              {submitting ? 'Se trimite...' : '📤 Trimite cererea de editare'}
            </button>
            {existing && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--warning-amber)', textAlign: 'center', marginTop: '8px' }}>
                Anulează cererea existentă pentru a putea trimite una nouă.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
      {children}
    </div>
  );
}
