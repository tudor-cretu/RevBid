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
      if (toId) await openOrCreateConversation(toId);
    };
    init();
    connectSocket();
    return () => socketRef.current?.disconnect();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const connectSocket = () => {
    const s = io(API_URL, { auth: { token } });
    s.on('new_message', ({ conversationId, message }) => {
      if (activeConv?._id === conversationId) {
        setMessages(prev => [...prev, message]);
      }
      setConversations(prev => prev.map(c =>
        c._id === conversationId
          ? { ...c, lastMessage: message.type === 'image' ? '📷 Imagine' : message.content, lastMessageAt: message.createdAt }
          : c
      ));
    });
    socketRef.current = s;
  };

  const fetchConversations = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const openOrCreateConversation = async (recipientId, auctionId = null) => {
    const res  = await fetch(`${API_URL}/api/messages/conversation`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ recipientId, auctionId }),
    });
    const conv = await res.json();
    setActiveConv(conv);
    fetchMessages(conv._id);
    setConversations(prev => {
      const exists = prev.find(c => c._id === conv._id);
      return exists ? prev : [conv, ...prev];
    });
  };

  const fetchMessages = async (convId) => {
    const res  = await fetch(`${API_URL}/api/messages/${convId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setMessages(Array.isArray(data) ? data : []);
  };

  const selectConversation = (conv) => {
    setActiveConv(conv);
    fetchMessages(conv._id);
    setImgPreview(null);
    setImgFile(null);
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !activeConv) return;
    const content = newMsg.trim();
    setNewMsg('');

    const res  = await fetch(`${API_URL}/api/messages/${activeConv._id}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ content }),
    });
    const msg = await res.json();
    setMessages(prev => [...prev, msg]);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImgFile(file);
    setImgPreview(URL.createObjectURL(file));
  };

  const cancelImage = () => {
    setImgFile(null);
    setImgPreview(null);
    fileRef.current.value = '';
  };

  const sendImage = async () => {
    if (!imgFile || !activeConv) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('image', imgFile);

    const res = await fetch(`${API_URL}/api/messages/${activeConv._id}/image`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    formData,
    });
    const msg = await res.json();
    setMessages(prev => [...prev, msg]);
    cancelImage();
    setUploading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getOtherParticipant = (conv) =>
    conv.participants?.find(p => p._id !== user.id);

  const handleDeleteConversation = async (convId) => {
    if (!window.confirm('Stergi aceasta conversatie? Toate mesajele vor fi pierdute.')) return;

    await fetch(`${API_URL}/api/messages/${convId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    setConversations(prev => prev.filter(c => c._id !== convId));
    setActiveConv(null);
    setMessages([]);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Lista conversatii */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h2 style={styles.sidebarTitle}>Mesaje</h2>
          </div>

          {loading ? (
            <p style={styles.empty}>Se incarca...</p>
          ) : conversations.length === 0 ? (
            <p style={styles.empty}>Nicio conversatie inca.</p>
          ) : (
            conversations.map(conv => {
              const other    = getOtherParticipant(conv);
              const isActive = activeConv?._id === conv._id;
              return (
                <div
                  key={conv._id}
                  style={{ ...styles.convItem, ...(isActive ? styles.convActive : {}) }}
                  onClick={() => selectConversation(conv)}
                >
                  {other?.avatar ? (
                    <img src={other.avatar} alt="" style={styles.convAvatar} />
                  ) : (
                    <div style={styles.convAvatarFallback}>
                      {other?.firstName?.[0]}{other?.lastName?.[0]}
                    </div>
                  )}
                  <div style={styles.convInfo}>
                    <p style={styles.convName}>{other?.firstName} {other?.lastName}</p>
                    {conv.auction && (
                      <p style={styles.convAuction}>re: {conv.auction.title}</p>
                    )}
                    <p style={styles.convLast}>{conv.lastMessage || 'Conversatie noua'}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat activ */}
        <div style={styles.chat}>
          {!activeConv ? (
            <div style={styles.noChat}>
              <p style={{ fontSize: '32px' }}>💬</p>
              <p style={{ color: '#718096' }}>Selecteaza o conversatie</p>
            </div>
          ) : (
            <>
              {/* Header chat */}
              <div style={styles.chatHeader}>
                <div style={styles.chatHeaderInfo}>
                  {(() => {
                    const other = getOtherParticipant(activeConv);
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                          {other?.avatar ? (
                            <img src={other.avatar} alt="" style={styles.chatAvatar} />
                          ) : (
                            <div style={{ ...styles.convAvatarFallback, width: '36px', height: '36px', fontSize: '13px' }}>
                              {other?.firstName?.[0]}{other?.lastName?.[0]}
                            </div>
                          )}
                          <div>
                            <p style={styles.chatName} onClick={() => navigate(`/profile/${other?._id}`)}>
                              {other?.firstName} {other?.lastName}
                            </p>
                            {activeConv.auction && (
                              <p style={styles.chatAuction} onClick={() => navigate(`/auction/${activeConv.auction._id}`)}>
                                re: {activeConv.auction.title} →
                              </p>
                            )}
                          </div>
                        </div>
                        <button style={styles.deleteConvBtn} onClick={() => handleDeleteConversation(activeConv._id)}>
                          🗑️ Sterge
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Mesaje */}
              <div style={styles.messages}>
                {messages.map((msg, i) => {
                  const isMine = msg.sender?._id === user.id || msg.sender === user.id;
                  return (
                    <div key={msg._id || i} style={{ ...styles.msgRow, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                      {!isMine && (
                        msg.sender?.avatar ? (
                          <img src={msg.sender.avatar} alt="" style={styles.msgAvatar} />
                        ) : (
                          <div style={{ ...styles.convAvatarFallback, width: '28px', height: '28px', fontSize: '11px', flexShrink: 0 }}>
                            {msg.sender?.firstName?.[0]}{msg.sender?.lastName?.[0]}
                          </div>
                        )
                      )}
                      <div style={{ ...styles.msgBubble, ...(isMine ? styles.msgMine : styles.msgTheirs) }}>
                        {msg.type === 'image' ? (
                          <img
                            src={msg.imageUrl}
                            alt="imagine"
                            style={styles.msgImage}
                            onClick={() => window.open(msg.imageUrl, '_blank')}
                          />
                        ) : (
                          <p style={styles.msgContent}>{msg.content}</p>
                        )}
                        <p style={styles.msgTime}>
                          {new Date(msg.createdAt).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Preview imagine selectata */}
              {imgPreview && (
                <div style={styles.imgPreviewWrap}>
                  <img src={imgPreview} alt="preview" style={styles.imgPreviewImg} />
                  <div style={styles.imgPreviewActions}>
                    <button style={styles.cancelBtn} onClick={cancelImage}>Anuleaza</button>
                    <button style={styles.sendImgBtn} onClick={sendImage} disabled={uploading}>
                      {uploading ? 'Se trimite...' : '📷 Trimite imaginea'}
                    </button>
                  </div>
                </div>
              )}

              {/* Input */}
              <div style={styles.inputRow}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                />
                <button
                  style={styles.imgBtn}
                  onClick={() => fileRef.current.click()}
                  title="Trimite imagine"
                >
                  📷
                </button>
                <textarea
                  style={styles.msgInput}
                  placeholder="Scrie un mesaj... (Enter pentru trimite)"
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button style={styles.sendBtn} onClick={sendMessage}>➤</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page:               { height: 'calc(100vh - 56px)', background: '#f7f8fa', overflow: 'hidden' },
  container:          { display: 'grid', gridTemplateColumns: '300px 1fr', height: '100%', maxWidth: '1100px', margin: '0 auto', background: '#fff', border: '1px solid #e2e8f0', borderTop: 'none' },
  sidebar:            { borderRight: '1px solid #e2e8f0', overflow: 'auto' },
  sidebarHeader:      { padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' },
  sidebarTitle:       { fontSize: '16px', fontWeight: '700', margin: '0' },
  convItem:           { display: 'flex', gap: '10px', padding: '12px 1.25rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0', alignItems: 'flex-start' },
  convActive:         { background: '#EBF8FF' },
  convAvatar:         { width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  convAvatarFallback: { width: '40px', height: '40px', borderRadius: '50%', background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600', flexShrink: 0 },
  convInfo:           { flex: 1, minWidth: 0 },
  convName:           { fontSize: '14px', fontWeight: '600', margin: '0 0 2px', color: '#1a1a1a' },
  convAuction:        { fontSize: '11px', color: '#3182ce', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  convLast:           { fontSize: '12px', color: '#a0aec0', margin: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chat:               { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  noChat:             { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  chatHeader:         { padding: '12px 1.25rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
  chatHeaderInfo:     { display: 'flex', alignItems: 'center', gap: '10px' },
  chatAvatar:         { width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' },
  chatName:           { fontSize: '14px', fontWeight: '600', margin: '0', cursor: 'pointer', color: '#3182ce' },
  chatAuction:        { fontSize: '12px', color: '#718096', margin: '0', cursor: 'pointer' },
  messages:           { flex: 1, overflow: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' },
  msgRow:             { display: 'flex', gap: '8px', alignItems: 'flex-end' },
  msgAvatar:          { width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  msgBubble:          { maxWidth: '65%', padding: '8px 12px', borderRadius: '12px' },
  msgMine:            { background: '#1a1a1a', color: '#fff', borderBottomRightRadius: '4px' },
  msgTheirs:          { background: '#f0f0f0', color: '#1a1a1a', borderBottomLeftRadius: '4px' },
  msgContent:         { fontSize: '14px', margin: '0 0 2px', lineHeight: '1.4' },
  msgImage:           { maxWidth: '220px', maxHeight: '220px', borderRadius: '8px', display: 'block', cursor: 'pointer', marginBottom: '2px' },
  msgTime:            { fontSize: '10px', opacity: 0.6, margin: '0' },
  imgPreviewWrap:     { padding: '8px 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px', background: '#f7f8fa' },
  imgPreviewImg:      { width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' },
  imgPreviewActions:  { display: 'flex', gap: '8px' },
  cancelBtn:          { padding: '6px 12px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', color: '#718096' },
  sendImgBtn:         { padding: '6px 14px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' },
  inputRow:           { display: 'flex', gap: '8px', padding: '12px 1.25rem', borderTop: '1px solid #e2e8f0', flexShrink: 0, alignItems: 'flex-end' },
  imgBtn:             { padding: '8px 10px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', flexShrink: 0 },
  msgInput:           { flex: 1, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', resize: 'none', fontFamily: 'inherit' },
  sendBtn:            { padding: '8px 16px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', flexShrink: 0 },
  empty:              { padding: '1.5rem', textAlign: 'center', color: '#a0aec0', fontSize: '13px' },
  deleteConvBtn:      { padding: '6px 12px', background: 'none', border: '1px solid #FED7D7', borderRadius: '8px', color: '#e53e3e', fontSize: '12px', cursor: 'pointer' },
};