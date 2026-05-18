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
  const endRef = useRef(null);

  useEffect(() => {
    fetchHistory();

    if (socket) {
      socket.on('auction_chat', (msg) => {
        setMessages(prev => [...prev, msg]);
      });
    }

    return () => socket?.off('auction_chat');
  }, [auctionId, socket]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/auctions/${auctionId}/chat`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const content = input.trim();
    setError('');

    const res  = await fetch(`${API_URL}/api/auctions/${auctionId}/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ content }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.message);
      return;
    }

    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const roleColor = r => ({ buyer: '#2B6CB0', supplier: '#276749', admin: '#805ad5' }[r] || '#718096');
  const roleBg    = r => ({ buyer: '#EBF8FF', supplier: '#F0FFF4', admin: '#FAF5FF' }[r] || '#F7FAFC');

  return (
    <div style={styles.wrap}>
      <h3 style={styles.title}>Chat licitatie</h3>
      <p style={styles.hint}>Cumparatorul si furnizorii care au ofertat pot comunica aici</p>

      {/* Mesaje */}
      <div style={styles.messages}>
        {messages.length === 0 ? (
          <p style={styles.empty}>Niciun mesaj inca. Fii primul!</p>
        ) : (
          messages.map((msg, i) => {
            const isMine = msg.sender?._id === user?.id || msg.sender === user?.id;
            return (
              <div key={msg._id || i} style={{ ...styles.msgRow, flexDirection: isMine ? 'row-reverse' : 'row' }}>
                {/* Avatar */}
                <div style={{ flexShrink: 0, cursor: 'pointer' }}
                     onClick={() => navigate(`/profile/${msg.sender?._id}`)}>
                  {msg.sender?.avatar ? (
                    <img src={msg.sender.avatar} alt="" style={styles.avatar} />
                  ) : (
                    <div style={styles.avatarFallback}>
                      {msg.sender?.firstName?.[0]}{msg.sender?.lastName?.[0]}
                    </div>
                  )}
                </div>

                {/* Bubble */}
                <div style={{ maxWidth: '70%' }}>
                  {/* Nume + rol */}
                  <div style={{ ...styles.senderRow, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    <span
                      style={styles.senderName}
                      onClick={() => navigate(`/profile/${msg.sender?._id}`)}
                    >
                      {msg.sender?.firstName} {msg.sender?.lastName}
                    </span>
                    <span style={{ ...styles.roleTag, background: roleBg(msg.sender?.role), color: roleColor(msg.sender?.role) }}>
                      {msg.sender?.role}
                    </span>
                  </div>

                  <div style={{ ...styles.bubble, ...(isMine ? styles.bubbleMine : styles.bubbleTheirs) }}>
                    <p style={styles.msgText}>{msg.content}</p>
                    <p style={styles.msgTime}>
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

      {/* Eroare */}
      {error && (
        <div style={styles.errorBox}>
          ⚠️ {error}
        </div>
      )}

      {/* Input */}
      <div style={styles.inputRow}>
        <textarea
          style={styles.input}
          placeholder="Scrie un mesaj... (Enter pentru trimite)"
          value={input}
          onChange={e => { setInput(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button style={styles.sendBtn} onClick={sendMessage}>➤</button>
      </div>
    </div>
  );
}

const styles = {
  wrap:          { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '10px' },
  title:         { fontSize: '15px', fontWeight: '600', color: '#1a1a1a', margin: '0' },
  hint:          { fontSize: '12px', color: '#a0aec0', margin: '0' },
  messages:      { height: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' },
  empty:         { textAlign: 'center', color: '#a0aec0', fontSize: '13px', margin: 'auto' },
  msgRow:        { display: 'flex', gap: '8px', alignItems: 'flex-start' },
  avatar:        { width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' },
  avatarFallback:{ width: '32px', height: '32px', borderRadius: '50%', background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' },
  senderRow:     { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' },
  senderName:    { fontSize: '12px', fontWeight: '600', color: '#3182ce', cursor: 'pointer' },
  roleTag:       { fontSize: '10px', padding: '1px 6px', borderRadius: '20px' },
  bubble:        { padding: '8px 12px', borderRadius: '12px', display: 'inline-block', maxWidth: '100%' },
  bubbleMine:    { background: '#1a1a1a', color: '#fff', borderBottomRightRadius: '4px' },
  bubbleTheirs:  { background: '#f0f0f0', color: '#1a1a1a', borderBottomLeftRadius: '4px' },
  msgText:       { fontSize: '13px', margin: '0 0 2px', lineHeight: '1.4', wordBreak: 'break-word' },
  msgTime:       { fontSize: '10px', opacity: 0.5, margin: '0' },
  errorBox:      { background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#C53030' },
  inputRow:      { display: 'flex', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' },
  input:         { flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', resize: 'none', fontFamily: 'inherit' },
  sendBtn:       { padding: '8px 14px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
};