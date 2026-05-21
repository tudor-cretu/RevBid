import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate }      from 'react-router-dom';
import { io }                          from 'socket.io-client';
import { useAuth }                     from '../context/AuthContext';
import PriceChart                      from '../components/PriceChart';
import { API_URL }                     from '../config';
import AuctionChatBox                  from '../components/AuctionChatBox';
import MapView                         from '../components/MapView';
import AuctionEndModal                 from '../components/AuctionEndModal';
import AuctionOutcome                  from '../components/AuctionOutcome';
import ReviewModal                     from '../components/ReviewModal';
import { fireConfetti }                from '../utils/confetti';
import { fmtDeadline }                 from '../utils/format';

const fmtNum = n => (n === null || n === undefined ? '—' : Number(n).toLocaleString('ro-RO'));
/* Deadline standardizat dd/mm/yyyy HH:mm. */
const fmtDateTime = d => fmtDeadline(d, '—');
const relTime = d => {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d)) / 1000);
  if (diff < 60)    return 'acum';
  if (diff < 3600)  return `acum ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `acum ${Math.floor(diff / 3600)} h`;
  return `acum ${Math.floor(diff / 86400)} zile`;
};

export default function AuctionDetail() {
  const { id }          = useParams();
  const { user, token } = useAuth();
  const navigate        = useNavigate();

  const [auction,  setAuction]  = useState(null);
  const [bids,     setBids]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [amount,   setAmount]   = useState('');
  const [message,  setMessage]  = useState('');
  const [error,    setError]    = useState('');
  const [status,   setStatus]   = useState('');
  const socketRef = useRef(null);
  const [subscribed,   setSubscribed]   = useState(false);
  const [subLoading,   setSubLoading]   = useState(false);
  const [segments,     setSegments]     = useState([]);
  const [expired,      setExpired]      = useState(false);
  const [activeImg,    setActiveImg]    = useState(0);

  // Approval requests state (buyer)
  const [myRequests,   setMyRequests]   = useState([]);
  const [deleteModal,  setDeleteModal]  = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting,     setDeleting]     = useState(false);
  const [requestToast, setRequestToast] = useState('');

  // Pop-up live la finalizarea licitației
  const [endModal,     setEndModal]     = useState(null);
  const endHandledRef = useRef(false);

  // Invoice / Rezumat tranzacție
  const [invoiceMeta,        setInvoiceMeta]        = useState(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  // Workflow post-licitație (confirmări livrare/primire + review)
  const [completion,      setCompletion]      = useState(null);
  const [confirming,      setConfirming]      = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError,     setReviewError]     = useState('');
  // Ref cu date "live" — handler-ul socket citește mereu valorile curente
  const liveRef = useRef({ userId: null, bids: [], buyerId: null });

  useEffect(() => {
    liveRef.current = {
      userId:  user?.id || null,
      bids,
      buyerId: auction?.buyer?._id || auction?.buyer || null,
    };
  }, [user, bids, auction]);

  useEffect(() => {
    fetchAuction(); fetchSubscription(); fetchBids(); connectSocket();
    if (user?.role === 'buyer') fetchMyRequests();
    return () => socketRef.current?.disconnect();
  }, [id]);

  /* Când licitația este închisă, încărcăm metadata documentului de tranzacție.
     Endpoint-ul răspunde doar pentru buyer / câștigător / admin. */
  useEffect(() => {
    if (auction?.status === 'closed') { fetchInvoiceMeta(); fetchCompletion(); }
  }, [auction?.status]);

  const fetchInvoiceMeta = async () => {
    try {
      const res = await fetch(`${API_URL}/api/invoices/auction/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setInvoiceMeta(await res.json());
    } catch {}
  };

  /* Starea workflow-ului post-licitație (confirmări + review-uri). */
  const fetchCompletion = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auctions/${id}/completion`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCompletion(await res.json());
    } catch {}
  };

  const confirmDelivery = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`${API_URL}/api/auctions/${id}/confirm-delivery`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setRequestToast('error:' + (data.message || 'Eroare la confirmare.')); return; }
      await fetchCompletion();
      setRequestToast(data.readyForReview
        ? 'ok:Colaborarea este pregătită pentru review.'
        : 'ok:Livrarea a fost confirmată.');
    } catch {
      setRequestToast('error:Eroare de conexiune.');
    } finally { setConfirming(false); }
  };

  const confirmReceipt = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`${API_URL}/api/auctions/${id}/confirm-receipt`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setRequestToast('error:' + (data.message || 'Eroare la confirmare.')); return; }
      await fetchCompletion();
      setRequestToast(data.readyForReview
        ? 'ok:Colaborarea este pregătită pentru review.'
        : 'ok:Primirea a fost confirmată.');
    } catch {
      setRequestToast('error:Eroare de conexiune.');
    } finally { setConfirming(false); }
  };

  const submitReview = async (rating, comment) => {
    setSubmittingReview(true); setReviewError('');
    try {
      const res = await fetch(`${API_URL}/api/auctions/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) { setReviewError(data.message || 'Nu am putut trimite review-ul.'); return; }
      setReviewModalOpen(false);
      await fetchCompletion();
      setRequestToast('ok:Review-ul a fost trimis. Mulțumim!');
    } catch {
      setReviewError('Eroare de conexiune. Încearcă din nou.');
    } finally { setSubmittingReview(false); }
  };

  const downloadInvoice = async () => {
    setDownloadingInvoice(true);
    try {
      const res = await fetch(`${API_URL}/api/invoices/auction/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setRequestToast('error:Nu s-a putut descărca documentul.'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `RevBid-${invoiceMeta?.invoiceNumber || 'rezumat-tranzactie'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setRequestToast('error:Eroare la descărcarea documentului.');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const messageCounterparty = (outcomeRole) => {
    const cp = invoiceMeta?.counterparty;
    if (!cp?._id) { navigate('/messages'); return; }
    const prefill = outcomeRole === 'buyer'
      ? `Salut! Felicitări pentru oferta câștigătoare la licitația "${auction.title}". Aș vrea să discutăm pașii următori.`
      : `Salut! Am câștigat licitația "${auction.title}". Sunt disponibil să discutăm detaliile pentru livrare/execuție.`;
    navigate(`/messages?to=${cp._id}&auction=${id}&prefill=${encodeURIComponent(prefill)}`);
  };

  const messageBuyer = () => {
    const buyer = auction?.buyer;
    if (!buyer?._id) { navigate('/messages'); return; }
    const prefill = `Bună ziua! Am văzut licitația dumneavoastră "${auction.title}" și aș dori să pun câteva întrebări înainte de a depune o ofertă.`;
    navigate(`/messages?to=${buyer._id}&auction=${id}&prefill=${encodeURIComponent(prefill)}`);
  };

  useEffect(() => {
    if (!auction?.deadline) return;
    const pad = n => String(n).padStart(2, '0');
    const tick = () => {
      const diff = new Date(auction.deadline) - Date.now();
      if (diff <= 0) { setSegments([]); setExpired(true); return; }
      setExpired(false);
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setSegments(d > 0
        ? [['zile', pad(d)], ['ore', pad(h)], ['min', pad(m)], ['sec', pad(s)]]
        : [['ore', pad(h)], ['min', pad(m)], ['sec', pad(s)]]);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [auction?.deadline]);

  const fetchAuction = async () => {
    try { const res = await fetch(`${API_URL}/api/auctions/${id}`); setAuction(await res.json()); }
    finally { setLoading(false); }
  };
  const fetchBids = async () => {
    try { const res = await fetch(`${API_URL}/api/bids/${id}`, { headers: { Authorization: `Bearer ${token}` } }); const d = await res.json(); setBids(Array.isArray(d) ? d : []); } catch {}
  };
  const fetchSubscription = async () => {
    try { const res = await fetch(`${API_URL}/api/subscriptions/check/${id}`, { headers: { Authorization: `Bearer ${token}` } }); const d = await res.json(); setSubscribed(d.subscribed); } catch {}
  };
  const toggleSubscription = async () => {
    setSubLoading(true);
    try { const res = await fetch(`${API_URL}/api/subscriptions/${id}`, { method: subscribed ? 'DELETE' : 'POST', headers: { Authorization: `Bearer ${token}` } }); const d = await res.json(); setSubscribed(d.subscribed); }
    finally { setSubLoading(false); }
  };

  const fetchMyRequests = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/auction-requests/for/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMyRequests(Array.isArray(data) ? data : []);
    } catch {}
  };

  const submitDeleteRequest = async () => {
    setDeleting(true);
    try {
      const res  = await fetch(`${API_URL}/api/auction-requests/${id}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:   JSON.stringify({ reason: deleteReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRequestToast('error:' + data.message);
      } else {
        setDeleteModal(false); setDeleteReason('');
        setRequestToast('ok:Cererea de ștergere a fost trimisă către admin.');
        fetchMyRequests();
      }
    } catch { setRequestToast('error:Eroare de conexiune.'); }
    finally { setDeleting(false); }
  };

  const cancelRequest = async (requestId) => {
    try {
      await fetch(`${API_URL}/api/auction-requests/${requestId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fetchMyRequests();
    } catch {}
  };
  const [socketReady, setSocketReady] = useState(false);

  const connectSocket = () => {
    const s = io(API_URL, { auth: { token } });
    s.on('connect', () => {
      s.emit('join_auction', id);
      setStatus('conectat');
      setSocketReady(true);
    });
    s.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message);
      setStatus('deconectat');
    });
    s.on('disconnect', () => setStatus('deconectat'));
    s.on('new_bid', ({ bid, currentPrice }) => {
      setBids(prev => {
        // Deduplicate
        if (bid._id && prev.some(b => b._id === bid._id)) return prev;
        return [...prev, bid];
      });
      setAuction(prev => prev ? { ...prev, currentPrice } : prev);
    });
    s.on('auction_closed', () => {
      setAuction(prev => prev ? { ...prev, status: 'closed' } : prev);
    });
    /* Finalizare licitație — pop-up live + confetti pentru câștigător */
    s.on('auction_finalized', (payload) => {
      setAuction(prev => prev
        ? { ...prev, status: payload.status || 'closed', currentPrice: payload.finalPrice ?? prev.currentPrice }
        : prev);

      if (endHandledRef.current) return;   // o singură dată per eveniment
      endHandledRef.current = true;

      const { userId, bids: liveBids } = liveRef.current;
      const myBidObj = liveBids
        .filter(b => (b.supplier?._id || b.supplier) === userId)
        .sort((a, b) => a.amount - b.amount)[0];

      let variant = 'generic';
      if (userId && payload.winnerId && userId === payload.winnerId)     variant = 'won';
      else if (userId && payload.buyerId && userId === payload.buyerId)  variant = 'buyer';
      else if (userId && myBidObj)                                       variant = 'lost';
      else if (userId)                                                   variant = 'watcher';

      setEndModal({
        variant,
        finalPrice: payload.finalPrice,
        winnerName: payload.winnerName,
        bidCount:   payload.bidCount,
        myBid:      myBidObj?.amount ?? null,
        hasInvoice: !!payload.hasInvoice,
      });

      if (variant === 'won') fireConfetti();
    });
    s.on('deadline_extended', ({ newDeadline }) => {
      setAuction(prev => prev ? { ...prev, deadline: newDeadline } : prev);
    });
    socketRef.current = s;
  };

  const placeBid = () => {
    if (!socketRef.current || !amount) return;
    setError('');
    socketRef.current.emit(
      'place_bid',
      { auctionId: id, amount: parseFloat(amount), message },
      (res) => {
        if (res.error) {
          setError(res.error);
        } else {
          setAmount('');
          setMessage('');
          // Supplier-ul s-a abonat automat — reflecta in UI
          setSubscribed(true);
        }
      }
    );
  };

  if (loading) return <div className="loading-state" style={{ padding: '4rem 0', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /><p className="loading-text">Se încarcă licitația...</p></div>;
  if (!auction) return <div className="empty-state"><div className="empty-state-icon">❌</div><p className="empty-state-title">Licitația nu există.</p></div>;

  const isActive   = auction.status === 'active';
  const isSupplier = user?.role === 'supplier';
  const isBuyer    = auction.buyer?._id === user?.id || auction.buyer === user?.id;

  const statusCls = { active: 'badge-solid-teal', closed: 'badge-solid-gray', cancelled: 'badge-solid-red', draft: 'badge-solid-amber' }[auction.status] || 'badge-solid-gray';
  const statusLabel = { active: 'Activă', closed: 'Închisă', cancelled: 'Anulată', draft: 'Draft' }[auction.status] || auction.status;

  /* ── Derived ── */
  const sortedBids = [...bids].sort((a, b) => a.amount - b.amount);
  const bestBid    = sortedBids[0] || null;
  const bidCount   = bids.length;
  const startPrice = auction.startPrice ?? auction.currentPrice;
  const savingsPct = startPrice && auction.currentPrice < startPrice
    ? Math.round(((startPrice - auction.currentPrice) / startPrice) * 100) : 0;
  const deadlineMs = auction.deadline ? new Date(auction.deadline) - Date.now() : null;
  const isUrgent   = deadlineMs !== null && deadlineMs > 0 && deadlineMs <= 24 * 3600000;

  const editPending   = myRequests.find(r => r.type === 'edit'   && r.status === 'pending');
  const deletePending = myRequests.find(r => r.type === 'delete' && r.status === 'pending');
  const rejectedReq   = myRequests.find(r => r.status === 'rejected');

  /* ── Rezultat post-licitație ── */
  const isClosed = auction.status === 'closed';
  const didBid   = bids.some(b => (b.supplier?._id || b.supplier) === user?.id);
  const isWinner = isClosed && !!bestBid && bestBid.supplier?._id === user?.id;
  let outcomeRole = null;
  if (isClosed && bestBid) {
    if (isBuyer)       outcomeRole = 'buyer';
    else if (isWinner) outcomeRole = 'winner';
    else if (didBid)   outcomeRole = 'loser';
  }

  /* ── Auction intelligence ── */
  const insights = [];
  if (isActive) {
    if (bidCount > 0)
      insights.push({ tone: 'info', text: `Licitația are ${bidCount} ${bidCount === 1 ? 'ofertă activă' : 'oferte active'} din partea furnizorilor.` });
    else
      insights.push({ tone: 'muted', text: 'Nu există încă oferte — promovează licitația sau ajustează detaliile pentru a atrage furnizori.' });
    if (savingsPct > 0)
      insights.push({ tone: 'good', text: `Prețul curent este cu ${savingsPct}% sub prețul de pornire.` });
    if (expired)
      insights.push({ tone: 'bad', text: 'Deadline-ul a fost depășit — licitația așteaptă închiderea.' });
    else if (isUrgent)
      insights.push({ tone: 'warn', text: 'Deadline-ul se apropie — mai puțin de 24 de ore rămase.' });
  } else {
    insights.push({ tone: 'muted', text: `Licitația este ${auction.status === 'closed' ? 'închisă' : 'anulată'} și nu mai acceptă oferte noi.` });
  }

  /* ── Timeline ── */
  const timeline = [
    { icon: '📢', title: 'Licitație publicată', sub: 'Disponibilă pentru ofertare', time: auction.createdAt },
    ...bids.map(b => ({
      icon: '💰',
      title: `Ofertă primită — ${fmtNum(b.amount)} RON`,
      sub: `${b.supplier?.firstName || ''} ${b.supplier?.lastName || ''}`.trim() || 'Furnizor',
      time: b.createdAt,
    })),
  ];
  if (auction.status === 'closed')    timeline.push({ icon: '🔒', title: 'Licitația a fost închisă', sub: 'Nu mai acceptă oferte',  time: auction.updatedAt });
  if (auction.status === 'cancelled') timeline.push({ icon: '🚫', title: 'Licitația a fost anulată', sub: 'Retrasă din platformă', time: auction.updatedAt });
  timeline.sort((a, b) => new Date(b.time) - new Date(a.time));
  const timelineShown = timeline.slice(0, 6);

  return (
    <div className="page">
      <div className="container">

        {/* Header */}
        <div className="ad-header">
          <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>← Înapoi</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-sm"
              onClick={toggleSubscription}
              disabled={subLoading}
              title={subscribed ? 'Ești abonat — click pentru dezabonare' : 'Abonează-te pentru a primi notificări'}
              style={subscribed
                ? { background: 'var(--bid-teal)', color: '#fff', border: '1px solid var(--bid-teal)' }
                : { color: 'var(--bid-teal)', background: 'transparent', border: '1px solid var(--bid-teal)' }}
            >
              {subLoading ? '...' : subscribed ? '✓ Abonat' : '🔔 Abonează-te'}
            </button>
            <span className={`badge ${statusCls}`} style={{ fontSize: '0.75rem', padding: '5px 14px' }}>{statusLabel}</span>
          </div>
        </div>

        {/* Toast feedback cereri */}
        {requestToast && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 16px', borderRadius: 'var(--radius-md)', marginBottom: '1rem',
            background: requestToast.startsWith('ok:') ? '#ECFDF5' : '#FEF2F2',
            color:      requestToast.startsWith('ok:') ? '#065F46' : '#991B1B',
            border:     `1px solid ${requestToast.startsWith('ok:') ? '#6EE7B7' : '#FCA5A5'}`,
            fontSize: '0.875rem',
          }}>
            <span>{requestToast.startsWith('ok:') ? '✅ ' : '❌ '}{requestToast.replace(/^(ok:|error:)/, '')}</span>
            <button onClick={() => setRequestToast('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', color: 'inherit' }}>✕</button>
          </div>
        )}

        {/* Modal confirmare ștergere */}
        {deleteModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="card" style={{ maxWidth: 460, width: '100%', padding: '1.5rem', boxShadow: 'var(--shadow-xl)' }}>
              <h3 style={{ margin: '0 0 8px', color: 'var(--text-heading)' }}>🗑️ Solicită ștergerea licitației</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                <strong>"{auction.title}"</strong> va rămâne activă până când adminul aprobă cererea. Cererea de ștergere poate fi anulată înainte de aprobare.
              </p>
              <div className="form-group">
                <label className="form-label">Motivul ștergerii (opțional)</label>
                <textarea
                  className="form-input"
                  placeholder="Ex: Proiectul a fost anulat, nu mai am nevoie de oferte..."
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  style={{ height: 80, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="btn btn-outline" onClick={() => { setDeleteModal(false); setDeleteReason(''); }}>Anulează</button>
                <button className="btn btn-danger" onClick={submitDeleteRequest} disabled={deleting}>
                  {deleting ? 'Se trimite...' : 'Trimite cererea de ștergere'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pop-up live la finalizarea licitației */}
        {endModal && (
          <AuctionEndModal
            variant={endModal.variant}
            finalPrice={endModal.finalPrice}
            winnerName={endModal.winnerName}
            bidCount={endModal.bidCount}
            myBid={endModal.myBid}
            hasInvoice={endModal.hasInvoice}
            downloadingInvoice={downloadingInvoice}
            onDownloadInvoice={downloadInvoice}
            onMessage={(endModal.variant === 'won' || endModal.variant === 'buyer')
              ? () => { setEndModal(null); messageCounterparty(endModal.variant === 'won' ? 'winner' : 'buyer'); }
              : undefined}
            onClose={() => setEndModal(null)}
            onExplore={() => { setEndModal(null); navigate('/dashboard'); }}
          />
        )}

        {/* Modal review post-licitație */}
        {reviewModalOpen && (
          <ReviewModal
            revieweeRole={outcomeRole === 'buyer' ? 'supplier' : 'buyer'}
            revieweeName={invoiceMeta?.counterparty
              ? `${invoiceMeta.counterparty.firstName || ''} ${invoiceMeta.counterparty.lastName || ''}`.trim()
              : (outcomeRole === 'buyer' ? 'Furnizorul câștigător' : 'Cumpărătorul')}
            onSubmit={submitReview}
            onClose={() => setReviewModalOpen(false)}
            submitting={submittingReview}
            error={reviewError}
          />
        )}

        <div className="ad-layout">
          {/* ═══ LEFT ═══ */}
          <div className="ad-left">

            {/* Galerie */}
            {auction.images?.length > 0 ? (
              <div className="ad-gallery">
                <div className="ad-gallery-main">
                  <img
                    key={activeImg}
                    src={auction.images[activeImg]?.url}
                    alt={auction.title}
                    className="ad-gallery-main-img"
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                  <div className="ad-gallery-placeholder" style={{ display: 'none' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--muted-gray)" strokeWidth="1.2">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                    </svg>
                    <span>Imagine indisponibilă</span>
                  </div>
                  {auction.images.length > 1 && (
                    <span className="ad-gallery-counter">{activeImg + 1} / {auction.images.length}</span>
                  )}
                </div>
                {auction.images.length > 1 && (
                  <div className="ad-gallery-thumbs">
                    {auction.images.map((img, i) => (
                      <button
                        key={i}
                        className={`ad-gallery-thumb ${i === activeImg ? 'active' : ''}`}
                        onClick={() => setActiveImg(i)}
                        aria-label={`Imaginea ${i + 1}`}
                        title={`Imaginea ${i + 1}`}
                      >
                        <img
                          src={img.url}
                          alt={`${auction.title} — ${i + 1}`}
                          className="ad-gallery-thumb-img"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="ad-gallery-empty">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--muted-gray)" strokeWidth="1.2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                </svg>
                <span>Fără imagini</span>
              </div>
            )}

            {/* Overview */}
            <div className="card">
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span className="badge badge-blue">{auction.category}</span>
                {auction.tags?.map(t => <span key={t} className="badge badge-gray">{t}</span>)}
              </div>
              <h1 className="ad-title">{auction.title}</h1>
              <p className="ad-posted">
                Postat de{' '}
                <span className="ad-posted-link" onClick={() => navigate(`/profile/${auction.buyer?._id}`)}>
                  {auction.buyer?.firstName} {auction.buyer?.lastName}
                </span>
                {auction.buyer?.companyName && ` · ${auction.buyer.companyName}`}
                {' · '}{relTime(auction.createdAt)}
              </p>
            </div>

            {/* Detalii licitație */}
            <div className="card">
              <div className="ad-card-head">
                <span className="ad-card-icon">📋</span>
                <h3 className="card-title">Detalii licitație</h3>
              </div>
              <p className="ad-section-title">Descriere</p>
              <p className="ad-description">{auction.description}</p>

              <div className="ad-detail-grid">
                <div className="ad-detail-item">
                  <span className="ad-detail-label">🏷️ Categorie</span>
                  <span className="ad-detail-value">{auction.category || '—'}</span>
                </div>
                <div className="ad-detail-item">
                  <span className="ad-detail-label">📦 Cantitate</span>
                  <span className="ad-detail-value">{auction.quantity?.trim() || '—'}</span>
                </div>
                <div className="ad-detail-item">
                  <span className="ad-detail-label">📍 Locație</span>
                  <span className="ad-detail-value">{auction.location?.city || auction.location?.address || 'Nespecificată'}</span>
                </div>
                <div className="ad-detail-item">
                  <span className="ad-detail-label">⏰ Deadline</span>
                  <span className="ad-detail-value">{auction.deadline ? fmtDateTime(auction.deadline) : 'Fără deadline'}</span>
                </div>
                <div className="ad-detail-item">
                  <span className="ad-detail-label">💰 Buget de pornire</span>
                  <span className="ad-detail-value">{fmtNum(startPrice)} RON</span>
                </div>
                <div className="ad-detail-item">
                  <span className="ad-detail-label">🎯 Preț țintă</span>
                  <span className="ad-detail-value">{auction.targetPrice ? `${fmtNum(auction.targetPrice)} RON` : '—'}</span>
                </div>
                <div className="ad-detail-item">
                  <span className="ad-detail-label">🔄 Auto-extend</span>
                  <span className="ad-detail-value">{auction.autoExtend ? 'Activat' : 'Dezactivat'}</span>
                </div>
              </div>
            </div>

            {/* Hartă */}
            {auction.location?.lat && (
              <div className="card">
                <div className="ad-card-head">
                  <span className="ad-card-icon">🗺️</span>
                  <h3 className="card-title">Locație</h3>
                </div>
                {auction.location.address && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    📍 {auction.location.address}
                  </p>
                )}
                <MapView location={auction.location} />
              </div>
            )}

            <PriceChart auctionId={id} startPrice={auction.startPrice} currentPrice={auction.currentPrice} />
            <AuctionChatBox auctionId={id} socket={socketRef.current} />
          </div>

          {/* ═══ RIGHT ═══ */}
          <div className="ad-right">

            {/* Status licitație */}
            <div className="card">
              <div className="ad-card-head">
                <span className="ad-card-icon">📊</span>
                <h3 className="card-title">Status licitație</h3>
              </div>

              <div className="ad-price-hero">
                <span className="ad-price-hero-label">{bidCount > 0 ? 'Cea mai bună ofertă' : 'Preț curent'}</span>
                <div className="ad-price-hero-row">
                  <span className={`ad-price-hero-value ${bidCount > 0 ? 'good' : ''}`}>
                    {fmtNum(auction.currentPrice)} <span className="ad-price-cur">RON</span>
                  </span>
                  {savingsPct > 0 && <span className="ad-savings-tag">▼ {savingsPct}%</span>}
                </div>
              </div>

              <div className="ad-meta-list">
                <div className="ad-meta-row">
                  <span className="ad-meta-key">Status</span>
                  <span className={`badge ${statusCls}`}>{statusLabel}</span>
                </div>
                <div className="ad-meta-row">
                  <span className="ad-meta-key">Cantitate</span>
                  <span className="ad-meta-val">{auction.quantity?.trim() || '—'}</span>
                </div>
                <div className="ad-meta-row">
                  <span className="ad-meta-key">Deadline</span>
                  <span className={`ad-meta-val ${isUrgent || expired ? 'urgent' : ''}`}>
                    {auction.deadline ? fmtDateTime(auction.deadline) : 'Fără deadline'}
                  </span>
                </div>
                <div className="ad-meta-row">
                  <span className="ad-meta-key">Buget de pornire</span>
                  <span className="ad-meta-val">{fmtNum(startPrice)} RON</span>
                </div>
                <div className="ad-meta-row">
                  <span className="ad-meta-key">Preț țintă</span>
                  <span className="ad-meta-val">{auction.targetPrice ? `${fmtNum(auction.targetPrice)} RON` : '—'}</span>
                </div>
                <div className="ad-meta-row">
                  <span className="ad-meta-key">Oferte primite</span>
                  <span className="ad-meta-val">{bidCount}</span>
                </div>
                <div className="ad-meta-row">
                  <span className="ad-meta-key">Cea mai bună ofertă</span>
                  <span className="ad-meta-val good">{bestBid ? `${fmtNum(bestBid.amount)} RON` : '—'}</span>
                </div>
              </div>

              {/* Countdown */}
              {isActive && !expired && segments.length > 0 && (
                <div className="ad-countdown">
                  {segments.map(([lbl, val]) => (
                    <div key={lbl} className="ad-cd-seg">
                      <span className="ad-cd-val">{val}</span>
                      <span className="ad-cd-lbl">{lbl}</span>
                    </div>
                  ))}
                </div>
              )}
              {isActive && expired && (
                <p className="ad-expired-note">⏱ Deadline expirat — licitația se va închide automat.</p>
              )}
            </div>

            {/* Analiză licitație */}
            <div className="card">
              <div className="ad-card-head">
                <span className="ad-card-icon">💡</span>
                <h3 className="card-title">Analiză licitație</h3>
              </div>
              <div className="ad-insights">
                {insights.map((ins, i) => (
                  <div key={i} className={`ad-insight tone-${ins.tone}`}>
                    <span className="ad-insight-dot" />
                    <span>{ins.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact cumpărător — vizibil furnizorilor în timpul licitației */}
            {isActive && isSupplier && !isBuyer && auction?.buyer && (
              <div className="card">
                <div className="ad-card-head">
                  <span className="ad-card-icon">🤝</span>
                  <h3 className="card-title">Contact cumpărător</h3>
                </div>
                <div className="ao-contact">
                  {auction.buyer.avatar ? (
                    <img src={auction.buyer.avatar} alt="" className="ao-contact-avatar" />
                  ) : (
                    <div className="ao-contact-avatar-fb">
                      {auction.buyer.firstName?.[0]}{auction.buyer.lastName?.[0]}
                    </div>
                  )}
                  <div className="ao-contact-info">
                    <p className="ao-contact-name">
                      {auction.buyer.firstName} {auction.buyer.lastName}
                    </p>
                    <p className="ao-contact-meta">
                      Cumpărător
                      {auction.buyer.companyName ? ` · ${auction.buyer.companyName}` : ''}
                      {auction.buyer.rating > 0 ? ` · ★ ${auction.buyer.rating.toFixed(1)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="ao-contact-rows">
                  {auction.buyer.email && (
                    <div className="ao-contact-row">
                      <span>✉️</span>
                      <a href={`mailto:${auction.buyer.email}`}>{auction.buyer.email}</a>
                    </div>
                  )}
                  {auction.buyer.phone && (
                    <div className="ao-contact-row">
                      <span>📞</span>
                      <a href={`tel:${auction.buyer.phone}`}>{auction.buyer.phone}</a>
                    </div>
                  )}
                </div>
                <div className="ao-contact-actions">
                  <button className="btn btn-primary btn-block btn-sm" onClick={messageBuyer}>
                    💬 Trimite mesaj
                  </button>
                  <button
                    className="btn btn-outline btn-block btn-sm"
                    onClick={() => navigate(`/profile/${auction.buyer._id}`)}
                  >
                    Vezi profilul
                  </button>
                </div>
              </div>
            )}

            {/* Depune ofertă — supplier */}
            {isActive && isSupplier && !isBuyer && (
              <div className="card">
                <div className="ad-card-head">
                  <span className="ad-card-icon">📝</span>
                  <h3 className="card-title">Depune oferta</h3>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Oferta ta trebuie să fie sub <strong style={{ color: 'var(--bid-teal)' }}>{fmtNum(auction.currentPrice)} RON</strong>
                </p>
                <input className="form-input" type="number" placeholder={`Sub ${fmtNum(auction.currentPrice)} RON`} value={amount} onChange={e => setAmount(e.target.value)} style={{ marginBottom: '8px' }} />
                <textarea className="form-input" placeholder="Mesaj opțional pentru cumpărător..." value={message} onChange={e => setMessage(e.target.value)} style={{ height: '70px', resize: 'none', marginBottom: '8px' }} />
                {error && <div className="alert alert-error" style={{ marginBottom: '8px' }}>{error}</div>}
                <button className="btn btn-primary btn-block" onClick={placeBid}>Depune oferta</button>
              </div>
            )}

            {/* Rezultat post-licitație — documente, pași următori, contact */}
            {outcomeRole ? (
              <AuctionOutcome
                role={outcomeRole}
                auction={auction}
                invoiceMeta={invoiceMeta}
                counterparty={invoiceMeta?.counterparty}
                companyComplete={invoiceMeta?.myCompanyComplete}
                completion={completion}
                confirming={confirming}
                onConfirmDelivery={confirmDelivery}
                onConfirmReceipt={confirmReceipt}
                onOpenReview={() => { setReviewError(''); setReviewModalOpen(true); }}
                onDownloadInvoice={downloadInvoice}
                downloadingInvoice={downloadingInvoice}
                onMessage={() => messageCounterparty(outcomeRole)}
              />
            ) : auction.status === 'draft' ? (
              isBuyer && (
                <div className="card" style={{ textAlign: 'center', background: 'var(--ice-blue)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📝</div>
                  <p style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: '4px' }}>
                    Licitație în lucru (draft)
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Acest draft nu este vizibil furnizorilor. Completează datele și publică-l pentru a primi oferte.
                  </p>
                  <button className="btn btn-primary btn-block" onClick={() => navigate(`/auction/${id}/edit`)}>
                    ✏️ Continuă editarea
                  </button>
                </div>
              )
            ) : !isActive && (
              <div className="card" style={{ textAlign: 'center', background: 'var(--ice-blue)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔒</div>
                <p style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: '4px' }}>
                  Licitație {auction.status === 'cancelled' ? 'anulată' : 'închisă'}
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Preț final: <strong style={{ color: 'var(--bid-teal)' }}>{fmtNum(auction.currentPrice)} RON</strong>
                </p>
              </div>
            )}

            {/* Acțiuni — buyer */}
            {isBuyer && isActive && (
              <div className="card">
                <div className="ad-card-head">
                  <span className="ad-card-icon">⚙️</span>
                  <h3 className="card-title">Acțiuni</h3>
                </div>

                {(editPending || deletePending || rejectedReq) && (
                  <div className="ad-req-status">
                    {editPending && <span className="ad-req-badge pending">⏳ Editare în așteptarea aprobării</span>}
                    {deletePending && <span className="ad-req-badge pending">⏳ Ștergere în așteptarea aprobării</span>}
                    {rejectedReq && <span className="ad-req-badge rejected">❌ {rejectedReq.type === 'edit' ? 'Editare' : 'Ștergere'} respinsă</span>}
                  </div>
                )}

                <div className="ad-action-btns">
                  {editPending ? (
                    <button
                      className="btn btn-sm btn-block"
                      style={{ borderColor: 'var(--warning-amber)', color: 'var(--warning-amber)', border: '1px solid var(--warning-amber)', background: 'transparent' }}
                      onClick={() => cancelRequest(editPending._id)}
                    >
                      ✕ Anulează cererea de editare
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-block"
                      style={{ borderColor: 'var(--action-blue)', color: 'var(--action-blue)', border: '1px solid var(--action-blue)', background: 'transparent' }}
                      onClick={() => navigate(`/auction/${id}/edit-request`)}
                    >
                      ✏️ Solicită editare
                    </button>
                  )}
                  {deletePending ? (
                    <button
                      className="btn btn-sm btn-block"
                      style={{ borderColor: 'var(--warning-amber)', color: 'var(--warning-amber)', border: '1px solid var(--warning-amber)', background: 'transparent' }}
                      onClick={() => cancelRequest(deletePending._id)}
                    >
                      ✕ Anulează cererea de ștergere
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-danger btn-block" onClick={() => setDeleteModal(true)}>
                      🗑️ Solicită ștergere
                    </button>
                  )}
                </div>
                <p className="ad-action-note">Modificările licitației necesită aprobarea unui administrator.</p>
              </div>
            )}

            {/* Oferte */}
            <div className="card">
              <div className="ad-card-head">
                <span className="ad-card-icon">💬</span>
                <h3 className="card-title">Oferte ({bidCount})</h3>
                <span className="ad-conn" style={{ color: status === 'conectat' ? 'var(--success-green)' : 'var(--text-muted)' }}>
                  ● {status || '...'}
                </span>
              </div>
              {bidCount === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
                  <div className="empty-state-icon">💰</div>
                  <p className="empty-state-text">Nicio ofertă încă — fii primul care ofertează!</p>
                </div>
              ) : (
                <div className="ad-bids">
                  {sortedBids.map((bid, i) => (
                    <div key={bid._id || i} className={`ad-bid-row ${i === 0 ? 'best' : ''}`}>
                      <div className="ad-bid-info">
                        <p className="ad-bid-name">
                          {i === 0 && <span className="ad-bid-crown">🏆</span>}
                          <span className="ad-bid-link" onClick={() => navigate(`/profile/${bid.supplier?._id}`)}>
                            {bid.supplier?.firstName} {bid.supplier?.lastName}
                          </span>
                        </p>
                        {bid.message && <p className="ad-bid-msg">{bid.message}</p>}
                        <p className="ad-bid-time">{relTime(bid.createdAt)}</p>
                      </div>
                      <p className={`ad-bid-amount ${i === 0 ? 'best' : ''}`}>{fmtNum(bid.amount)} RON</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activitate recentă */}
            <div className="card">
              <div className="ad-card-head">
                <span className="ad-card-icon">🕑</span>
                <h3 className="card-title">Activitate recentă</h3>
              </div>
              <div className="ad-timeline">
                {timelineShown.map((ev, i) => (
                  <div key={i} className="ad-tl-item">
                    <div className="ad-tl-marker">
                      <span className="ad-tl-icon">{ev.icon}</span>
                      {i < timelineShown.length - 1 && <span className="ad-tl-line" />}
                    </div>
                    <div className="ad-tl-body">
                      <p className="ad-tl-title">{ev.title}</p>
                      {ev.sub && <p className="ad-tl-sub">{ev.sub}</p>}
                      <p className="ad-tl-time">{relTime(ev.time)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{adCSS}</style>
    </div>
  );
}

const adCSS = `
/* ── Header ── */
.ad-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1.25rem; gap: 12px; flex-wrap: wrap;
}

/* ── Layout ── */
.ad-layout { display: grid; grid-template-columns: 1fr 350px; gap: 1.25rem; align-items: start; }
.ad-left   { display: flex; flex-direction: column; gap: 1.25rem; min-width: 0; }
.ad-right  { display: flex; flex-direction: column; gap: 1.25rem; }
@media (max-width: 920px) { .ad-layout { grid-template-columns: 1fr; } }

/* ── Card head ── */
.ad-card-head {
  display: flex; align-items: center; gap: 9px;
  margin-bottom: 14px; padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}
.ad-card-head .card-title { margin: 0; flex: 1; }
.ad-card-icon {
  width: 30px; height: 30px; border-radius: var(--radius-md);
  background: var(--ice-blue); display: flex; align-items: center; justify-content: center;
  font-size: 0.9375rem; flex-shrink: 0;
}
.ad-conn { font-size: 0.6875rem; font-weight: 600; white-space: nowrap; }

/* ── Overview ── */
.ad-title { font-size: 1.375rem; font-weight: 700; margin: 0 0 6px; color: var(--text-heading); line-height: 1.3; }
.ad-posted { font-size: 0.8125rem; color: var(--text-muted); }
.ad-posted-link { font-weight: 600; cursor: pointer; color: var(--action-blue); }
.ad-posted-link:hover { text-decoration: underline; }

/* ── Detalii ── */
.ad-section-title {
  font-size: 0.6875rem; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;
}
.ad-description { font-size: 0.875rem; color: var(--text-body); line-height: 1.65; margin-bottom: 16px; }
.ad-detail-grid {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px;
  background: var(--border-light); border: 1px solid var(--border-light);
  border-radius: var(--radius-md); overflow: hidden;
}
.ad-detail-item {
  background: var(--bg-card); padding: 11px 14px;
  display: flex; flex-direction: column; gap: 3px;
}
.ad-detail-label { font-size: 0.6875rem; color: var(--text-muted); font-weight: 600; }
.ad-detail-value { font-size: 0.875rem; color: var(--text-heading); font-weight: 600; }
@media (max-width: 480px) { .ad-detail-grid { grid-template-columns: 1fr; } }

/* ── Galerie ── */
.ad-gallery { display: flex; flex-direction: column; gap: 10px; }
.ad-gallery-main {
  position: relative; width: 100%; height: 340px;
  background: var(--ice-blue); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden;
}
.ad-gallery-main-img { width: 100%; height: 100%; object-fit: cover; display: block; animation: fadeIn .25s ease; }
.ad-gallery-placeholder {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; color: var(--muted-gray); font-size: 0.8125rem;
}
.ad-gallery-counter {
  position: absolute; bottom: 10px; right: 12px;
  background: rgba(3,54,103,0.6); color: white; font-size: 0.6875rem; font-weight: 600;
  padding: 3px 9px; border-radius: var(--radius-full); backdrop-filter: blur(4px);
}
.ad-gallery-thumbs {
  display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px;
  scrollbar-width: thin; scrollbar-color: var(--border) transparent;
}
.ad-gallery-thumbs::-webkit-scrollbar { height: 4px; }
.ad-gallery-thumbs::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
.ad-gallery-thumb {
  flex-shrink: 0; width: 72px; height: 72px;
  border-radius: var(--radius-md); overflow: hidden;
  border: 2px solid #DCE8EC; cursor: pointer; padding: 0; background: var(--ice-blue);
  transition: border-color var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast);
}
.ad-gallery-thumb:hover { border-color: var(--bid-teal); transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,169,157,0.18); }
.ad-gallery-thumb.active { border-color: var(--bid-teal); box-shadow: 0 0 0 3px rgba(0,169,157,0.18); }
.ad-gallery-thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ad-gallery-empty {
  width: 100%; height: 240px;
  background: var(--ice-blue); border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; color: var(--muted-gray); font-size: 0.8125rem;
}
@media (max-width: 600px) {
  .ad-gallery-main { height: 230px; }
  .ad-gallery-thumb { width: 60px; height: 60px; }
}

/* ── Price hero ── */
.ad-price-hero {
  background: var(--ice-blue); border: 1px solid var(--border-light);
  border-radius: var(--radius-md); padding: 12px 14px; margin-bottom: 14px;
}
.ad-price-hero-label {
  font-size: 0.625rem; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.05em; font-weight: 700;
}
.ad-price-hero-row { display: flex; align-items: baseline; gap: 10px; margin-top: 2px; }
.ad-price-hero-value { font-size: 1.625rem; font-weight: 800; color: var(--primary-navy); letter-spacing: -0.02em; }
.ad-price-hero-value.good { color: var(--success-green); }
.ad-price-cur { font-size: 0.8125rem; font-weight: 600; color: var(--text-muted); }
.ad-savings-tag {
  font-size: 0.6875rem; font-weight: 700; color: var(--success-green);
  background: #DCFCE7; padding: 3px 8px; border-radius: var(--radius-full);
}

/* ── Meta list ── */
.ad-meta-list { display: flex; flex-direction: column; }
.ad-meta-row {
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  padding: 8px 0; border-bottom: 1px solid var(--border-light);
}
.ad-meta-row:last-child { border-bottom: none; }
.ad-meta-key { font-size: 0.8125rem; color: var(--text-muted); }
.ad-meta-val { font-size: 0.8125rem; font-weight: 600; color: var(--text-heading); text-align: right; }
.ad-meta-val.good { color: var(--success-green); }
.ad-meta-val.urgent { color: var(--warning-amber); }

/* ── Countdown ── */
.ad-countdown { display: flex; gap: 6px; margin-top: 14px; }
.ad-cd-seg {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  background: var(--primary-navy); border-radius: var(--radius-md); padding: 8px 4px;
}
.ad-cd-val { font-size: 1.125rem; font-weight: 800; color: #fff; line-height: 1; }
.ad-cd-lbl { font-size: 0.5625rem; color: var(--bid-teal); text-transform: uppercase; letter-spacing: 0.04em; margin-top: 3px; font-weight: 600; }
.ad-expired-note { font-size: 0.75rem; color: var(--error-red); font-weight: 600; margin-top: 12px; text-align: center; }

/* ── Insights ── */
.ad-insights { display: flex; flex-direction: column; gap: 9px; }
.ad-insight {
  display: flex; gap: 9px; align-items: flex-start;
  font-size: 0.8125rem; line-height: 1.5; color: var(--text-body);
  padding: 9px 11px; border-radius: var(--radius-md);
  background: var(--ice-blue); border: 1px solid var(--border-light);
}
.ad-insight-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; background: var(--muted-gray); }
.ad-insight.tone-info  { background: #EFF6FF; border-color: #BFDBFE; }
.ad-insight.tone-info  .ad-insight-dot { background: var(--action-blue); }
.ad-insight.tone-good  { background: #ECFDF5; border-color: #A7F3D0; }
.ad-insight.tone-good  .ad-insight-dot { background: var(--success-green); }
.ad-insight.tone-warn  { background: #FFFBEB; border-color: #FDE68A; }
.ad-insight.tone-warn  .ad-insight-dot { background: var(--warning-amber); }
.ad-insight.tone-bad   { background: #FEF2F2; border-color: #FECACA; }
.ad-insight.tone-bad   .ad-insight-dot { background: var(--error-red); }

/* ── Contact buyer (active auction) ── */
.ao-contact { display: flex; align-items: center; gap: 11px; margin-bottom: 12px; }
.ao-contact-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
.ao-contact-avatar-fb {
  width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
  background: var(--bid-teal); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.9375rem; font-weight: 700;
}
.ao-contact-info { min-width: 0; }
.ao-contact-name { font-size: 0.9375rem; font-weight: 700; color: var(--text-heading); margin: 0; }
.ao-contact-meta { font-size: 0.75rem; color: var(--text-muted); margin: 2px 0 0; }
.ao-contact-rows { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.ao-contact-row { display: flex; align-items: center; gap: 7px; font-size: 0.8125rem; }
.ao-contact-row a { color: var(--action-blue); font-weight: 500; word-break: break-all; }
.ao-contact-actions { display: flex; flex-direction: column; gap: 7px; }

/* ── Acțiuni buyer ── */
.ad-req-status { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.ad-req-badge {
  font-size: 0.75rem; font-weight: 600; padding: 5px 10px;
  border-radius: var(--radius-md); text-align: center;
}
.ad-req-badge.pending  { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
.ad-req-badge.rejected { background: #FEF2F2; color: #991B1B; border: 1px solid #FCA5A5; }
.ad-action-btns { display: flex; flex-direction: column; gap: 8px; }
.ad-action-note { font-size: 0.6875rem; color: var(--text-muted); margin-top: 10px; text-align: center; }

/* ── Bids ── */
.ad-bids { display: flex; flex-direction: column; gap: 6px; max-height: 360px; overflow-y: auto; }
.ad-bid-row {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-md);
  background: var(--bg-card); border: 1px solid var(--border-light);
}
.ad-bid-row.best { background: #ECFDF5; border-color: #A7F3D0; }
.ad-bid-info { min-width: 0; }
.ad-bid-name { font-size: 0.8125rem; font-weight: 600; color: var(--text-heading); margin: 0; }
.ad-bid-crown { margin-right: 3px; }
.ad-bid-link { cursor: pointer; color: var(--action-blue); }
.ad-bid-link:hover { text-decoration: underline; }
.ad-bid-msg { font-size: 0.75rem; color: var(--text-muted); margin: 2px 0 0; }
.ad-bid-time { font-size: 0.6875rem; color: var(--text-muted); margin: 2px 0 0; }
.ad-bid-amount { font-size: 0.9375rem; font-weight: 700; color: var(--bid-teal); margin: 0; white-space: nowrap; }
.ad-bid-amount.best { color: var(--success-green); }

/* ── Timeline ── */
.ad-timeline { display: flex; flex-direction: column; }
.ad-tl-item { display: flex; gap: 11px; }
.ad-tl-marker { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.ad-tl-icon {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--ice-blue); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; flex-shrink: 0;
}
.ad-tl-line { width: 2px; flex: 1; background: var(--border-light); margin: 3px 0; min-height: 14px; }
.ad-tl-body { padding-bottom: 14px; min-width: 0; }
.ad-tl-title { font-size: 0.8125rem; font-weight: 600; color: var(--text-heading); margin: 0; line-height: 1.4; }
.ad-tl-sub { font-size: 0.75rem; color: var(--text-muted); margin: 1px 0 0; }
.ad-tl-time { font-size: 0.6875rem; color: var(--text-muted); margin: 2px 0 0; }
.ad-tl-item:last-child .ad-tl-body { padding-bottom: 0; }
`;
