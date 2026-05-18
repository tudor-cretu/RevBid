import { useState } from 'react';
import { useAuth }  from '../context/AuthContext';
import { API_URL }  from '../config';

const FAQ = [
  {
    q: 'Cum creez o licitatie?',
    a: 'Din dashboard-ul tau de cumparator, apasa butonul "+ Licitatie noua". Completeaza titlul, descrierea, pretul de start si deadline-ul. Poti adauga si fotografii si o locatie pe harta.'
  },
  {
    q: 'Cum depun o oferta?',
    a: 'Intra pe pagina unei licitatii active ca furnizor. In coloana din dreapta vei vedea formularul de ofertare. Oferta ta trebuie sa fie mai mica decat pretul curent.'
  },
  {
    q: 'Ce se intampla la sfarsitul licitatiei?',
    a: 'La expirarea deadline-ului, furnizorul cu oferta cea mai mica castiga. Atat cumparatorul cat si furnizorul castigator primesc un email de notificare.'
  },
  {
    q: 'Ce este auto-extend?',
    a: 'Daca activezi optiunea "Auto-extend" la crearea licitatiei, si o oferta vine in ultimele 2 minute, deadline-ul se prelungeste automat cu 5 minute pentru a da sansa tuturor furnizorilor sa reactioneze.'
  },
  {
    q: 'Cum imi verific contul?',
    a: 'La inregistrare cu email, vei primi un cod de 6 cifre. Introdu-l pe pagina de verificare. Codul expira in 15 minute. Daca nu l-ai primit, foloseste butonul "Retrimite".'
  },
  {
    q: 'Pot folosi RevBid pe mobil?',
    a: 'Da, interfata este responsive si functioneaza pe orice dispozitiv cu browser modern.'
  },
];

export default function Support() {
  const { user, token } = useAuth();
  const [openFaq,  setOpenFaq]  = useState(null);
  const [form,     setForm]     = useState({ subject: '', message: '' });
  const [sent,     setSent]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/support`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, email: user.email, name: `${user.firstName} ${user.lastName}` }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
      setForm({ subject: '', message: '' });
    } catch {
      setError('Eroare la trimitere. Incearca din nou.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>Support</h1>
        <p style={styles.subtitle}>Cum te putem ajuta?</p>

        {/* FAQ */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Intrebari frecvente</h2>
          {FAQ.map((item, i) => (
            <div key={i} style={styles.faqItem}>
              <button
                style={styles.faqQ}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{item.q}</span>
                <span style={styles.faqIcon}>{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && (
                <p style={styles.faqA}>{item.a}</p>
              )}
            </div>
          ))}
        </div>

        {/* Formular contact */}
        <div style={{ ...styles.card, marginTop: '1.5rem' }}>
          <h2 style={styles.sectionTitle}>Trimite un mesaj</h2>
          <p style={styles.contactDesc}>
            Nu ai gasit raspunsul? Trimite-ne un mesaj si te vom contacta in maxim 24 ore.
          </p>

          {sent ? (
            <div style={styles.successBox}>
              ✅ Mesajul a fost trimis! Te vom contacta la <strong>{user?.email}</strong> in curand.
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.readonlyField}>
                <span style={styles.readonlyLabel}>De la:</span>
                <span style={styles.readonlyValue}>{user?.firstName} {user?.lastName} · {user?.email}</span>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Subiect</label>
                <input
                  style={styles.input} name="subject"
                  placeholder="ex: Problema la ofertare"
                  value={form.subject} onChange={handleChange} required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Mesaj</label>
                <textarea
                  style={{ ...styles.input, height: '120px', resize: 'vertical' }}
                  name="message"
                  placeholder="Descrie problema sau intrebarea ta..."
                  value={form.message} onChange={handleChange} required
                />
              </div>

              {error && <p style={styles.error}>{error}</p>}

              <button style={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? 'Se trimite...' : 'Trimite mesajul'}
              </button>
            </form>
          )}
        </div>

        {/* Contact direct */}
        <div style={styles.contactCard}>
          <div style={styles.contactItem}>
            <span style={styles.contactIcon}>📧</span>
            <div>
              <p style={styles.contactLabel}>Email support</p>
              <p style={styles.contactValue}>support@revbid.ro</p>
            </div>
          </div>
          <div style={styles.contactItem}>
            <span style={styles.contactIcon}>⏰</span>
            <div>
              <p style={styles.contactLabel}>Program</p>
              <p style={styles.contactValue}>Luni–Vineri, 9:00–18:00</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page:         { minHeight: '100vh', background: '#f7f8fa', padding: '2rem' },
  container:    { maxWidth: '680px', margin: '0 auto' },
  title:        { fontSize: '22px', fontWeight: '700', margin: '0 0 4px' },
  subtitle:     { color: '#718096', fontSize: '14px', marginBottom: '1.5rem' },
  card:         { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' },
  sectionTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '1rem', marginTop: '0' },
  faqItem:      { borderBottom: '1px solid #f0f0f0' },
  faqQ:         { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: '#1a1a1a', textAlign: 'left', gap: '12px' },
  faqIcon:      { fontSize: '18px', color: '#718096', flexShrink: 0 },
  faqA:         { fontSize: '13px', color: '#718096', lineHeight: '1.6', padding: '0 0 12px', margin: '0' },
  contactDesc:  { fontSize: '13px', color: '#718096', marginBottom: '1rem' },
  form:         { display: 'flex', flexDirection: 'column', gap: '12px' },
  formGroup:    { display: 'flex', flexDirection: 'column', gap: '4px' },
  label:        { fontSize: '13px', color: '#4a5568' },
  input:        { padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', width: '100%' },
  readonlyField:{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f7f8fa', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' },
  readonlyLabel:{ color: '#718096' },
  readonlyValue:{ color: '#1a1a1a', fontWeight: '500' },
  submitBtn:    { padding: '10px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' },
  successBox:   { background: '#F0FFF4', border: '1px solid #C6F6D5', borderRadius: '8px', padding: '1rem', fontSize: '14px', color: '#276749' },
  error:        { color: '#e53e3e', fontSize: '13px' },
  contactCard:  { display: 'flex', gap: '16px', marginTop: '1.5rem', flexWrap: 'wrap' },
  contactItem:  { display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', flex: 1 },
  contactIcon:  { fontSize: '24px' },
  contactLabel: { fontSize: '12px', color: '#718096', margin: '0' },
  contactValue: { fontSize: '14px', fontWeight: '500', color: '#1a1a1a', margin: '0' },
};