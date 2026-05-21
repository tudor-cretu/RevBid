import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="l-nav">
        <div className="l-nav-inner">
          <Logo size="md" onClick={() => navigate('/')} />
          <div className="l-nav-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/login')}>Autentificare</button>
            <button className="btn btn-primary" onClick={() => navigate('/register')}>Începe gratuit</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="l-hero">
        <div className="l-hero-content">
          <div className="l-hero-badge">
            <span className="badge badge-teal">🚀 Platforma #1 de licitații inverse</span>
          </div>
          <h1 className="l-hero-title">
            Prețurile <span className="l-hero-accent">scad</span>,<br />
            economiile tale <span className="l-hero-accent">cresc</span>
          </h1>
          <p className="l-hero-desc">
            Postează cererea ta și lasă furnizorii să concureze pentru cel mai bun preț.
            RevBid transformă achizițiile într-un avantaj competitiv.
          </p>
          <div className="l-hero-ctas">
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
              Creează cont gratuit
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button className="btn btn-outline btn-lg" onClick={() => navigate('/login')}>
              Am deja cont
            </button>
          </div>
          <div className="l-hero-stats">
            <div className="l-hero-stat"><span className="l-hero-stat-val">500+</span><span className="l-hero-stat-lbl">Licitații finalizate</span></div>
            <div className="l-hero-stat-sep" />
            <div className="l-hero-stat"><span className="l-hero-stat-val">23%</span><span className="l-hero-stat-lbl">Economie medie</span></div>
            <div className="l-hero-stat-sep" />
            <div className="l-hero-stat"><span className="l-hero-stat-val">200+</span><span className="l-hero-stat-lbl">Furnizori activi</span></div>
          </div>
        </div>
        <div className="l-hero-visual">
          <div className="l-hero-card">
            <div className="l-hero-card-header">
              <span className="badge badge-solid-teal">Activă</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--warning-amber)', fontWeight: 600 }}>⏱ 2h 34m</span>
            </div>
            <h4 style={{ margin: '10px 0 6px', fontSize: '0.9375rem', color: 'var(--text-heading)' }}>Laptop Business i7, 16GB RAM</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '14px' }}>Caut laptop performant pentru echipa de dezvoltare...</p>
            <div style={{ background: 'var(--ice-blue)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div><p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', margin: 0, textTransform: 'uppercase', fontWeight: 500 }}>Preț curent</p><p style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--bid-teal)', margin: 0 }}>4,200 RON</p></div>
                <span className="badge badge-teal">↓ 16%</span>
              </div>
            </div>
            <div className="l-hero-bids">
              <div className="l-hero-bid winner"><span>🏆 TechSupply SRL</span><span style={{ color: 'var(--success-green)', fontWeight: 700 }}>4,200 RON</span></div>
              <div className="l-hero-bid"><span>DataPro Solutions</span><span style={{ color: 'var(--bid-teal)', fontWeight: 600 }}>4,350 RON</span></div>
              <div className="l-hero-bid"><span>MegaIT Store</span><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>4,500 RON</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="l-section">
        <div className="l-section-inner">
          <h2 className="l-section-title">Cum funcționează?</h2>
          <p className="l-section-desc">Trei pași simpli către cel mai bun preț</p>
          <div className="l-steps">
            <div className="l-step">
              <div className="l-step-num">1</div>
              <h3>Postează cererea</h3>
              <p>Descrie ce produs sau serviciu cauți, setează un preț de start și un deadline.</p>
            </div>
            <div className="l-step-arrow">→</div>
            <div className="l-step">
              <div className="l-step-num">2</div>
              <h3>Furnizorii ofertează</h3>
              <p>Furnizorii verificați concurează între ei, scăzând prețul în timp real.</p>
            </div>
            <div className="l-step-arrow">→</div>
            <div className="l-step">
              <div className="l-step-num">3</div>
              <h3>Alegi cea mai bună ofertă</h3>
              <p>Compari ofertele, verifici furnizorii și accepți cea mai avantajoasă propunere.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="l-section" style={{ background: 'var(--bg-card)' }}>
        <div className="l-section-inner">
          <h2 className="l-section-title">De ce RevBid?</h2>
          <div className="l-benefits">
            <div className="l-benefit"><span className="l-benefit-icon">📉</span><h4>Prețuri competitive</h4><p>Furnizorii concurează, tu obții cel mai bun preț din piață.</p></div>
            <div className="l-benefit"><span className="l-benefit-icon">⚡</span><h4>Rapid și eficient</h4><p>Primești oferte în minute, nu în zile. Totul în timp real.</p></div>
            <div className="l-benefit"><span className="l-benefit-icon">🔒</span><h4>Transparent și sigur</h4><p>Toate ofertele sunt vizibile. Fără negocieri ascunse.</p></div>
            <div className="l-benefit"><span className="l-benefit-icon">🏆</span><h4>Furnizori verificați</h4><p>Fiecare furnizor are profil, rating și istoric verificabil.</p></div>
            <div className="l-benefit"><span className="l-benefit-icon">💬</span><h4>Comunicare directă</h4><p>Chat integrat cu furnizorii, direct pe pagina licitației.</p></div>
            <div className="l-benefit"><span className="l-benefit-icon">📊</span><h4>Grafice și statistici</h4><p>Urmărește evoluția prețului și analizează ofertele primite.</p></div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="l-cta">
        <div className="l-section-inner" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '12px' }}>Începe să economisești astăzi</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.125rem', marginBottom: '2rem', maxWidth: '500px', margin: '0 auto 2rem' }}>
            Crearea contului este gratuită. Fără card, fără obligații.
          </p>
          <button className="btn btn-lg" style={{ background: 'var(--bid-teal)', color: '#fff', padding: '16px 36px', fontSize: '1rem' }} onClick={() => navigate('/register')}>
            Creează cont gratuit →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="l-footer">
        <div className="l-section-inner">
          <div className="l-footer-top">
            <div>
              <div style={{ marginBottom: '10px' }}>
                <Logo size="md" variant="light" />
              </div>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', maxWidth: '280px' }}>
                Platformă de licitații inverse pentru achiziții inteligente.
              </p>
            </div>
            <div className="l-footer-links">
              <div><h5 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Platforma</h5>
                <a href="#" onClick={e => { e.preventDefault(); navigate('/register'); }}>Înregistrare</a>
                <a href="#" onClick={e => { e.preventDefault(); navigate('/login'); }}>Autentificare</a>
              </div>
              <div><h5 style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Contact</h5>
                <a href="mailto:support@revbid.ro">support@revbid.ro</a>
                <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)' }}>Luni–Vineri, 9–18</span>
              </div>
            </div>
          </div>
          <div className="l-footer-bottom">
            <p>© {new Date().getFullYear()} RevBid. Toate drepturile rezervate.</p>
          </div>
        </div>
      </footer>

      <style>{landingCSS}</style>
    </div>
  );
}

const landingCSS = `
.landing { background: var(--bg-page); }

.l-nav { background: var(--bg-card); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 50; }
.l-nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; height: 64px; display: flex; align-items: center; justify-content: space-between; }
.l-nav-brand { font-size: 1.375rem; font-weight: 800; cursor: pointer; }
.l-nav-actions { display: flex; align-items: center; gap: 8px; }

.l-hero { max-width: 1200px; margin: 0 auto; padding: 4rem 1.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: center; }
.l-hero-badge { margin-bottom: 1.25rem; }
.l-hero-title { font-size: 2.75rem; line-height: 1.15; color: var(--text-heading); margin-bottom: 1.25rem; letter-spacing: -0.03em; }
.l-hero-accent { color: var(--bid-teal); }
.l-hero-desc { font-size: 1.125rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 2rem; max-width: 480px; }
.l-hero-ctas { display: flex; gap: 12px; margin-bottom: 2.5rem; flex-wrap: wrap; }
.l-hero-stats { display: flex; align-items: center; gap: 1.5rem; }
.l-hero-stat { display: flex; flex-direction: column; }
.l-hero-stat-val { font-size: 1.5rem; font-weight: 800; color: var(--text-heading); }
.l-hero-stat-lbl { font-size: 0.75rem; color: var(--text-muted); font-weight: 500; }
.l-hero-stat-sep { width: 1px; height: 36px; background: var(--border); }

.l-hero-visual { display: flex; justify-content: center; }
.l-hero-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 1.5rem; width: 100%; max-width: 380px; box-shadow: var(--shadow-lg); }
.l-hero-card-header { display: flex; justify-content: space-between; align-items: center; }
.l-hero-bids { display: flex; flex-direction: column; gap: 6px; }
.l-hero-bid { display: flex; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-md); font-size: 0.8125rem; color: var(--text-body); transition: background .15s; }
.l-hero-bid.winner { background: #ECFDF5; border-left: 3px solid var(--success-green); }

.l-section { padding: 4rem 1.5rem; }
.l-section-inner { max-width: 1100px; margin: 0 auto; }
.l-section-title { text-align: center; font-size: 2rem; margin-bottom: 8px; color: var(--text-heading); }
.l-section-desc { text-align: center; color: var(--text-muted); font-size: 1.0625rem; margin-bottom: 3rem; }

.l-steps { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 1.5rem; align-items: flex-start; }
.l-step { text-align: center; padding: 1.5rem; }
.l-step-num { width: 48px; height: 48px; border-radius: 50%; background: var(--soft-aqua); color: var(--bid-teal); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800; margin: 0 auto 1rem; }
.l-step h3 { font-size: 1.0625rem; margin-bottom: 8px; color: var(--text-heading); }
.l-step p { font-size: 0.875rem; color: var(--text-muted); line-height: 1.6; }
.l-step-arrow { color: var(--border); font-size: 1.5rem; margin-top: 2.5rem; }

.l-benefits { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
.l-benefit { padding: 1.5rem; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-card); transition: all var(--transition-normal); }
.l-benefit:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); border-color: var(--bid-teal); }
.l-benefit-icon { font-size: 1.75rem; display: block; margin-bottom: 10px; }
.l-benefit h4 { font-size: 1rem; color: var(--text-heading); margin-bottom: 6px; }
.l-benefit p { font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5; }

.l-cta { background: linear-gradient(135deg, var(--primary-navy) 0%, var(--deep-blue) 100%); padding: 4rem 1.5rem; }

.l-footer { background: var(--deep-blue); padding: 3rem 1.5rem 1.5rem; }
.l-footer-top { display: flex; justify-content: space-between; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap; }
.l-footer-links { display: flex; gap: 3rem; }
.l-footer-links a { display: block; color: rgba(255,255,255,0.7); font-size: 0.8125rem; margin-bottom: 8px; text-decoration: none; transition: color .15s; }
.l-footer-links a:hover { color: var(--bid-teal); }
.l-footer-bottom { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1.5rem; }
.l-footer-bottom p { color: rgba(255,255,255,0.4); font-size: 0.8125rem; margin: 0; }

@media (max-width: 900px) {
  .l-hero { grid-template-columns: 1fr; padding: 2.5rem 1.5rem; gap: 2rem; }
  .l-hero-title { font-size: 2rem; }
  .l-hero-visual { order: -1; }
  .l-hero-card { max-width: 100%; }
  .l-steps { grid-template-columns: 1fr; gap: 0.5rem; }
  .l-step-arrow { display: none; }
  .l-benefits { grid-template-columns: 1fr 1fr; }
  .l-hero-stats { flex-wrap: wrap; gap: 1rem; }
}
@media (max-width: 600px) {
  .l-benefits { grid-template-columns: 1fr; }
  .l-hero-title { font-size: 1.75rem; }
}
`;
