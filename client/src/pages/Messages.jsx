import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { io }       from 'socket.io-client';
import { useAuth }  from '../context/AuthContext';
import { API_URL }  from '../config';

export default function Messages() {
  const { user, token }     = useAuth();
  const navigate            = useNavigate();
  const [params]            = useSearchParams();
  const socketRef           = useRef(null);
  const fileRef             = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [activeConv,    setActiveConv]    = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [newMsg,        setNewMsg]        = useState('');
  const [loading,       setLoading]       = useState(true);
  const [imgPreview,    setImgPreview]    = useState(null);
  const [imgFile,       setImgFile]       = useState(null);
  const [uploading,     setUploading]     = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      await fetchConversations();
      const toId = params.get('to');
      if (toId) {
        await openOrCreateConversation(toId, params.get('auction') || null);
        const prefill = params.get('prefill');
        if (prefill) setNewMsg(prefill);
      }
    };
    init(); connectSocket();
    return () => socketRef.current?.disconnect();
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const connectSocket = () => {
    const s = io(API_URL, { auth: { token } });
    s.on('new_message', ({ conversationId, message }) => {
      if (activeConv?._id === conversationId) setMessages(prev => [...prev, message]);
      setConversations(prev => prev.map(c => c._id === conversationId ? { ...c, lastMessage: message.type === 'image' ? '📷 Imagine' : message.content, lastMessageAt: message.createdAt } : c));
    });
    socketRef.current = s;
  };
  const fetchConversations = async () => {
    try { const res = await fetch(`${API_URL}/api/messages`, { headers: { Authorization: `Bearer ${token}` } }); const data = await res.json(); setConversations(Array.isArray(data) ? data : []); return data; }
    finally { setLoading(false); }
  };
  const openOrCreateConversation = async (recipientId, auctionId = null) => {
    const res = await fetch(`${API_URL}/api/messages/conversation`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ recipientId, auctionId }) });
    const conv = await res.json(); setActiveConv(conv); fetchMessages(conv._id);
    setConversations(prev => { const exists = prev.find(c => c._id === conv._id); return exists ? prev : [conv, ...prev]; });
  };
  const fetchMessages = async (convId) => {
    const res = await fetch(`${API_URL}/api/messages/${convId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json(); setMessages(Array.isArray(data) ? data : []);
  };
  const selectConversation = (conv) => { setActiveConv(conv); fetchMessages(conv._id); setImgPreview(null); setImgFile(null); };
  const sendMessage = async () => {
    if (!newMsg.trim() || !activeConv) return;
    const content = newMsg.trim(); setNewMsg('');
    const res = await fetch(`${API_URL}/api/messages/${activeConv._id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content }) });
    const newMessage = await res.json();
    setMessages(prev => [...prev, newMessage]);
  };
  const handleImageSelect = (e) => { const file = e.target.files[0]; if (!file) return; setImgFile(file); setImgPreview(URL.createObjectURL(file)); };
  const cancelImage = () => { setImgFile(null); setImgPreview(null); fileRef.current.value = ''; };
  const sendImage = async () => {
    if (!imgFile || !activeConv) return; setUploading(true);
    const formData = new FormData(); formData.append('image', imgFile);
    const res = await fetch(`${API_URL}/api/messages/${activeConv._id}/image`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
    const imgMsg = await res.json();
    setMessages(prev => [...prev, imgMsg]); cancelImage(); setUploading(false);
  };
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const getOtherParticipant = (conv) => conv.participants?.find(p => p._id !== user.id);
  const handleDeleteConversation = async (convId) => {
    if (!window.confirm('Stergi aceasta conversatie? Toate mesajele vor fi pierdute.')) return;
    await fetch(`${API_URL}/api/messages/${convId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setConversations(prev => prev.filter(c => c._id !== convId)); setActiveConv(null); setMessages([]);
  };

  return (
    <div className="msg-page">
      <div className="msg-container">
        {/* Sidebar */}
        <div className="msg-sidebar">
          <div className="msg-sidebar-header"><h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-inverse)' }}>💬 Mesaje</h2></div>
          {loading ? <p className="loading-text">Se incarca...</p> : conversations.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}><div className="empty-state-icon">💬</div><p className="empty-state-text">Nicio conversatie inca.</p></div>
          ) : conversations.map(conv => {
            const other = getOtherParticipant(conv); const isAct = activeConv?._id === conv._id;
            return (
              <div key={conv._id} className={`msg-conv-item ${isAct ? 'active' : ''}`} onClick={() => selectConversation(conv)}>
                {other?.avatar ? <img src={other.avatar} alt="" className="msg-conv-avatar" /> : (
                  <div className="msg-conv-avatar-fb">{other?.firstName?.[0]}{other?.lastName?.[0]}</div>
                )}
                <div className="msg-conv-info">
                  <p className="msg-conv-name">{other?.firstName} {other?.lastName}</p>
                  {conv.auction && <p className="msg-conv-auction">re: {conv.auction.title}</p>}
                  <p className="msg-conv-last">{conv.lastMessage || 'Conversatie noua'}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chat */}
        <div className="msg-chat">
          {!activeConv ? (
            <div className="empty-state" style={{ flex: 1, justifyContent: 'center' }}><div className="empty-state-icon">💬</div><p className="empty-state-title">Selecteaza o conversatie</p></div>
          ) : (<>
            <div className="msg-chat-header">
              {(() => { const other = getOtherParticipant(activeConv); return (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  {other?.avatar ? <img src={other.avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} /> : (
                    <div className="msg-conv-avatar-fb" style={{ width: 36, height: 36, fontSize: 13 }}>{other?.firstName?.[0]}{other?.lastName?.[0]}</div>
                  )}
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0, color: 'var(--action-blue)', cursor: 'pointer' }} onClick={() => navigate(`/profile/${other?._id}`)}>{other?.firstName} {other?.lastName}</p>
                    {activeConv.auction && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, cursor: 'pointer' }} onClick={() => navigate(`/auction/${activeConv.auction._id}`)}>re: {activeConv.auction.title} →</p>}
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" style={{ color: 'var(--error-red)', borderColor: 'var(--error-border)' }} onClick={() => handleDeleteConversation(activeConv._id)}>🗑️ Sterge</button>
              </>); })()}
            </div>

            <div className="msg-messages">
              {messages.map((msg, i) => { const isMine = msg.sender?._id === user.id || msg.sender === user.id; return (
                <div key={msg._id || i} className={`msg-row ${isMine ? 'mine' : ''}`}>
                  {!isMine && (msg.sender?.avatar ? <img src={msg.sender.avatar} alt="" className="msg-msg-avatar" /> : (
                    <div className="msg-conv-avatar-fb" style={{ width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>{msg.sender?.firstName?.[0]}{msg.sender?.lastName?.[0]}</div>
                  ))}
                  <div className={`msg-bubble ${isMine ? 'mine' : ''}`}>
                    {msg.type === 'image' ? <img src={msg.imageUrl} alt="imagine" className="msg-img" onClick={() => window.open(msg.imageUrl, '_blank')} /> : <p className="msg-text">{msg.content}</p>}
                    <p className="msg-time">{new Date(msg.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ); })}
              <div ref={messagesEndRef} />
            </div>

            {imgPreview && (
              <div style={{ padding: '8px 1.25rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--ice-blue)' }}>
                <img src={imgPreview} alt="preview" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }} />
                <button className="btn btn-outline btn-sm" onClick={cancelImage}>Anuleaza</button>
                <button className="btn btn-primary btn-sm" onClick={sendImage} disabled={uploading}>{uploading ? 'Se trimite...' : '📷 Trimite'}</button>
              </div>
            )}

            <div className="msg-input-row">
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
              <button className="btn-icon" onClick={() => fileRef.current.click()} title="Trimite imagine">📷</button>
              <textarea className="form-input" placeholder="Scrie un mesaj... (Enter pentru trimite)" value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyDown={handleKeyDown} rows={1} style={{ flex: 1, resize: 'none' }} />
              <button className="btn btn-primary btn-sm" onClick={sendMessage}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </>)}
        </div>
      </div>

      <style>{`
        .msg-page { height: calc(100vh - 64px); overflow: hidden; }
        .msg-container { display: grid; grid-template-columns: 320px 1fr; height: 100%; max-width: 1200px; margin: 0 auto; background: var(--bg-card); border-inline: 1px solid var(--border); }
        .msg-sidebar { border-right: 1px solid var(--border); overflow: auto; }
        .msg-sidebar-header { padding: 1rem 1.25rem; background: var(--primary-navy); }
        .msg-conv-item { display: flex; gap: 10px; padding: 14px 1.25rem; cursor: pointer; border-bottom: 1px solid var(--border-light); align-items: flex-start; transition: background var(--transition-fast); }
        .msg-conv-item:hover { background: var(--ice-blue); }
        .msg-conv-item.active { background: var(--soft-aqua); border-left: 3px solid var(--bid-teal); }
        .msg-conv-avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .msg-conv-avatar-fb { width: 42px; height: 42px; border-radius: 50%; background: var(--primary-navy); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
        .msg-conv-info { flex: 1; min-width: 0; }
        .msg-conv-name { font-size: 0.875rem; font-weight: 600; margin: 0 0 2px; color: var(--text-heading); }
        .msg-conv-auction { font-size: 0.6875rem; color: var(--action-blue); margin: 0 0 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .msg-conv-last { font-size: 0.75rem; color: var(--text-muted); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .msg-chat { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
        .msg-chat-header { padding: 12px 1.25rem; border-bottom: 1px solid var(--border-light); flex-shrink: 0; display: flex; align-items: center; gap: 10px; }
        .msg-messages { flex: 1; overflow: auto; padding: 1rem; display: flex; flex-direction: column; gap: 8px; }
        .msg-row { display: flex; gap: 8px; align-items: flex-end; }
        .msg-row.mine { flex-direction: row-reverse; }
        .msg-msg-avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .msg-bubble { max-width: 65%; padding: 10px 14px; border-radius: 14px; background: var(--ice-blue); color: var(--text-body); border-bottom-left-radius: 4px; }
        .msg-bubble.mine { background: var(--deep-blue); color: #fff; border-bottom-left-radius: 14px; border-bottom-right-radius: 4px; }
        .msg-text { font-size: 0.875rem; margin: 0 0 2px; line-height: 1.4; }
        .msg-img { max-width: 220px; max-height: 220px; border-radius: var(--radius-md); display: block; cursor: pointer; margin-bottom: 2px; }
        .msg-time { font-size: 0.625rem; opacity: 0.6; margin: 0; }
        .msg-input-row { display: flex; gap: 8px; padding: 12px 1.25rem; border-top: 1px solid var(--border-light); flex-shrink: 0; align-items: flex-end; }
        @media (max-width: 768px) {
          .msg-container { grid-template-columns: 1fr; }
          .msg-sidebar { display: ${''} ; }
        }
      `}</style>
    </div>
  );
}