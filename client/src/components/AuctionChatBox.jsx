import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }     from '../context/AuthContext';
import { API_URL }     from '../config';

export default function AuctionChatBox({ auctionId, socket }) {
  const { user, token } = useAuth();
  const navigate        = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [error,    setError]    = useState('');
  const [sending,  setSending]  = useState(false);
  const endRef     = useRef(null);
  // Keep a ref to the latest socket so the effect closure stays fresh
  const socketRef  = useRef(socket);

  useEffect(() => { socketRef.current = socket; }, [socket]);

  // Load history whenever auctionId changes
  useEffect(() => {
    fetchHistory();
  }, [auctionId]);

  // Attach / detach the socket listener whenever the socket instance changes
  useEffect(() => {
    if (!socket) return;

    const handleChat = (msg) => {
      setMessages(prev => {
        // Deduplicate by _id to avoid double-adds when sender also gets own echo
        if (msg._id && prev.some(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };

    socket.on('auction_chat', handleChat);
    return () => socket.off('auction_chat', handleChat);
  }, [socket]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchHistory = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/auctions/${auctionId}/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    setError('');
    setSending(true);
    const content = input.trim();
    setInput(''); // Clear immediately for UX

    try {
      const res  = await fetch(`${API_URL}/api/auctions/${auctionId}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message);
        setInput(content); // Restore if failed
        return;
      }
      // Add own message immediately (the server broadcasts to OTHERS via socket,
      // but we get the persisted message back from the REST response — add it locally)
      setMessages(prev => {
        if (data._id && prev.some(m => m._id === data._id)) return prev;
        return [...prev, data];
      });
    } catch (err) {
      setError('Eroare de conexiune');
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const roleBadge = r => ({
    buyer:    'badge-blue',
    supplier: 'badge-teal',
    admin:    'badge-navy',
  }[r] || 'badge-gray');

  return (
    <div className="card chat-box">
      <div className="card-header">
        <h3 className="card-title">💬 Chat licitație</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Cumpărătorul și furnizorii care au ofertat pot comunica aici
        </span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div className="empty-state-icon">💬</div>
            <p className="empty-state-text">Niciun mesaj încă. Fii primul!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const senderId = msg.sender?._id ?? msg.sender;
            const isMine   = senderId === user?.id;
            return (
              <div key={msg._id || i} className={`chat-msg-row ${isMine ? 'mine' : ''}`}>
                <div className="chat-msg-avatar" onClick={() => navigate(`/profile/${msg.sender?._id ?? msg.sender}`)}>
                  {msg.sender?.avatar ? (
                    <img src={msg.sender.avatar} alt="" className="chat-avatar-img" />
                  ) : (
                    <div className="chat-avatar-fallback">
                      {msg.sender?.firstName?.[0]}{msg.sender?.lastName?.[0]}
                    </div>
                  )}
                </div>
                <div className="chat-msg-content">
                  <div className={`chat-msg-sender ${isMine ? 'mine' : ''}`}>
                    <span
                      className="chat-sender-name"
                      onClick={() => navigate(`/profile/${msg.sender?._id ?? msg.sender}`)}
                    >
                      {msg.sender?.firstName} {msg.sender?.lastName}
                    </span>
                    <span className={`badge ${roleBadge(msg.sender?.role)}`}>{msg.sender?.role}</span>
                  </div>
                  <div className={`chat-bubble ${isMine ? 'mine' : ''}`}>
                    <p className="chat-msg-text">{msg.content}</p>
                    <p className="chat-msg-time">
                      {new Date(msg.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="alert alert-error" style={{ margin: '8px 0 0' }}>⚠️ {error}</div>}

      <div className="chat-input-row">
        <textarea
          className="form-input"
          placeholder="Scrie un mesaj... (Enter pentru a trimite)"
          value={input}
          onChange={e => { setInput(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ resize: 'none', flex: 1 }}
          disabled={sending}
        />
        <button className="btn btn-primary btn-sm" onClick={sendMessage} disabled={sending || !input.trim()}>
          {sending ? (
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>
      </div>

      <style>{chatCSS}</style>
    </div>
  );
}

const chatCSS = `
.chat-box .card-header { flex-direction: column; align-items: flex-start; gap: 2px; }
.chat-messages { height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 12px 0; }
.chat-msg-row { display: flex; gap: 8px; align-items: flex-start; }
.chat-msg-row.mine { flex-direction: row-reverse; }
.chat-msg-avatar { flex-shrink: 0; cursor: pointer; }
.chat-avatar-img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.chat-avatar-fallback { width: 32px; height: 32px; border-radius: 50%; background: var(--primary-navy); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
.chat-msg-content { max-width: 70%; }
.chat-msg-sender { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
.chat-msg-sender.mine { justify-content: flex-end; }
.chat-sender-name { font-size: 12px; font-weight: 600; color: var(--action-blue); cursor: pointer; }
.chat-sender-name:hover { text-decoration: underline; }
.chat-bubble { padding: 8px 14px; border-radius: 12px; display: inline-block; background: var(--ice-blue); color: var(--text-body); border-bottom-left-radius: 4px; }
.chat-bubble.mine { background: var(--deep-blue); color: #fff; border-bottom-left-radius: 12px; border-bottom-right-radius: 4px; }
.chat-msg-text { font-size: 13px; margin: 0 0 2px; line-height: 1.4; word-break: break-word; }
.chat-msg-time { font-size: 10px; opacity: 0.6; margin: 0; }
.chat-input-row { display: flex; gap: 8px; border-top: 1px solid var(--border-light); padding-top: 12px; align-items: flex-end; }
`;