import { useState } from 'react';
import { useAuth }  from '../context/AuthContext';
import { API_URL }  from '../config';

const FAQ = [
  { q: 'Cum creez o licitatie?', a: 'Din dashboard-ul tau de cumparator, apasa butonul "+ Licitatie noua". Completeaza titlul, descrierea, pretul de start si deadline-ul. Poti adauga si fotografii si o locatie pe harta.' },
  { q: 'Cum depun o oferta?', a: 'Intra pe pagina unei licitatii active ca furnizor. In coloana din dreapta vei vedea formularul de ofertare. Oferta ta trebuie sa fie mai mica decat pretul curent.' },
  { q: 'Ce se intampla la sfarsitul licitatiei?', a: 'La expirarea deadline-ului, furnizorul cu oferta cea mai mica castiga. Atat cumparatorul cat si furnizorul castigator primesc un email de notificare.' },
  { q: 'Ce este auto-extend?', a: 'Daca activezi optiunea "Auto-extend" la crearea licitatiei, si o oferta vine in ultimele 2 minute, deadline-ul se prelungeste automat cu 5 minute pentru a da sansa tuturor furnizorilor sa reactioneze.' },
  { q: 'Cum imi verific contul?', a: 'La inregistrare cu email, vei primi un cod de 6 cifre. Introdu-l pe pagina de verificare. Codul expira in 15 minute. Daca nu l-ai primit, foloseste butonul "Retrimite".' },
  { q: 'Pot folosi RevBid pe mobil?', a: 'Da, interfata este responsive si functioneaza pe orice dispozitiv cu browser modern.' },
];

export default function Support() {
  const { user, token } = useAuth();
  const [openFaq, setOpenFaq] = useState(null);
  const [form, setForm] = useState({ subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/support`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...form, email: user.email, name: `${user.firstName} ${user.lastName}` }) });
      if (!res.ok) throw new Error();
      setSent(true); setForm({ subject: '', message: '' });
    } catch { setError('Eroare la trimitere. Incearca din nou.'); } finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div className="container-sm">
        <h1 className="page-title">🛟 Support</h1>
        <p className="page-subtitle" style={{ marginBottom: '1.75rem' }}>Cum te putem ajuta?</p>

        {/* FAQ */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--text-heading)' }}>Intrebari frecvente</h2>
          {FAQ.map((item, i) => (
            <div key={i} style={{ borderBottom: i < FAQ.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 0', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-heading)', textAlign: 'left', gap: '12px',
                fontFamily: 'var(--font-sans)',
              }}>
                <span>{item.q}</span>
                <span style={{ fontSize: '1.125rem', color: 'var(--bid-teal)', flexShrink: 0, transition: 'transform var(--transition-fast)', transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0)' }}>+</span>
              </button>
              {openFaq === i && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.6, padding: '0 0 14px', margin: 0, animation: 'fadeInUp .2s ease' }}>{item.a}</p>
              )}
            </div>
          ))}
        </div>

        {/* Contact Form */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px', color: 'var(--text-heading)' }}>Trimite un mesaj</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Nu ai gasit raspunsul? Trimite-ne un mesaj si te vom contacta in maxim 24 ore.
          </p>

          {sent ? (
            <div className="alert alert-success">✅ Mesajul a fost trimis! Te vom contacta la <strong>{user?.email}</strong> in curand.</div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--ice-blue)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>De la:</span>
                <span style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{user?.firstName} {user?.lastName} · {user?.email}</span>
              </div>
              <div className="form-group"><label className="form-label">Subiect</label><input className="form-input" name="subject" placeholder="ex: Problema la ofertare" value={form.subject} onChange={handleChange} required /></div>
              <div className="form-group"><label className="form-label">Mesaj</label><textarea className="form-input" name="message" placeholder="Descrie problema sau intrebarea ta..." value={form.message} onChange={handleChange} required style={{ height: '120px', resize: 'vertical' }} /></div>
              {error && <div className="form-error">{error}</div>}
              <button className="btn btn-primary btn-block" type="submit" disabled={loading}>{loading ? 'Se trimite...' : 'Trimite mesajul'}</button>
            </form>
          )}
        </div>

        {/* Contact info */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px' }}>
            <span style={{ fontSize: '1.5rem' }}>📧</span>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Email support</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>support@revbid.ro</p>
            </div>
          </div>
          <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: '200px' }}>
            <span style={{ fontSize: '1.5rem' }}>⏰</span>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Program</p>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>Luni–Vineri, 9:00–18:00</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}