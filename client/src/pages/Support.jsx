import { useState } from 'react';
import { useAuth }  from '../context/AuthContext';
import { API_URL }  from '../config';

const FAQ = [
  { q: 'Cum creez o licitație?', a: 'Din dashboard-ul tău de cumpărător, apasă butonul "+ Licitație nouă". Completează titlul, descrierea, prețul de start și deadline-ul. Poți adăuga și fotografii și o locație pe hartă.' },
  { q: 'Cum depun o ofertă?', a: 'Intră pe pagina unei licitații active ca furnizor. În coloana din dreapta vei vedea formularul de ofertare. Oferta ta trebuie să fie mai mică decât prețul curent.' },
  { q: 'Ce se întâmplă la sfârșitul licitației?', a: 'La expirarea deadline-ului, furnizorul cu oferta cea mai mică câștigă. Atât cumpărătorul cât și furnizorul câștigător primesc un email de notificare.' },
  { q: 'Ce este auto-extend?', a: 'Dacă activezi opțiunea "Auto-extend" la crearea licitației, și o ofertă vine în ultimele 2 minute, deadline-ul se prelungește automat cu 5 minute pentru a da șansa tuturor furnizorilor să reacționeze.' },
  { q: 'Cum îmi verific contul?', a: 'La înregistrare cu email, vei primi un cod de 6 cifre. Introdu-l pe pagina de verificare. Codul expiră în 15 minute. Dacă nu l-ai primit, folosește butonul "Retrimite".' },
  { q: 'Pot folosi RevBid pe mobil?', a: 'Da, interfața este responsive și funcționează pe orice dispozitiv cu browser modern.' },
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
    } catch { setError('Eroare la trimitere. Încearcă din nou.'); } finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div className="container-sm">
        <h1 className="page-title">🛟 Support</h1>
        <p className="page-subtitle" style={{ marginBottom: '1.75rem' }}>Cum te putem ajuta?</p>

        {/* FAQ */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem', color: 'var(--text-heading)' }}>Întrebări frecvente</h2>
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
            Nu ai găsit răspunsul? Trimite-ne un mesaj și te vom contacta în maxim 24 ore.
          </p>

          {sent ? (
            <div className="alert alert-success">✅ Mesajul a fost trimis! Te vom contacta la <strong>{user?.email}</strong> în curând.</div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--ice-blue)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>De la:</span>
                <span style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{user?.firstName} {user?.lastName} · {user?.email}</span>
              </div>
              <div className="form-group"><label className="form-label">Subiect</label><input className="form-input" name="subject" placeholder="ex: Problemă la ofertare" value={form.subject} onChange={handleChange} required /></div>
              <div className="form-group"><label className="form-label">Mesaj</label><textarea className="form-input" name="message" placeholder="Descrie problema sau întrebarea ta..." value={form.message} onChange={handleChange} required style={{ height: '120px', resize: 'vertical' }} /></div>
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