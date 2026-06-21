'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ArrowLeft, CheckCheck } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import {
  fetchAllSessions, sendAdminMessage, markUserMessagesRead, resolveSession,
  type ChatSession, type ChatMessage,
} from '@/src/lib/chat';

export default function AdminMessagesPage() {
  const router = useRouter();
  const [sessions,      setSessions]      = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages,      setMessages]      = useState<ChatMessage[]>([]);
  const [input,         setInput]         = useState('');
  const [sending,       setSending]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [adminId,       setAdminId]       = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminId(data.user?.id ?? ''));
  }, []);

  const loadSessions = async () => {
    const data = await fetchAllSessions();
    setSessions(data);
    setLoading(false);
  };

  const openSession = async (session: ChatSession) => {
    setActiveSession(session);
    // Load messages
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });
    setMessages((data as ChatMessage[]) ?? []);
    await markUserMessagesRead(session.id);
    // Refresh session list to clear badge
    loadSessions();
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSession || sending) return;
    setSending(true);
    const optimistic: ChatMessage = {
      id:           String(Date.now()),
      session_id:   activeSession.id,
      order_id:     null,
      user_id:      null,
      admin_id:     adminId,
      message_text: input.trim(),
      message_type: 'admin',
      is_read:      false,
      created_at:   new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    await sendAdminMessage(activeSession.id, adminId, optimistic.message_text);
    setSending(false);
  };

  const handleResolve = async () => {
    if (!activeSession) return;
    if (!confirm('Mark this conversation as resolved?')) return;
    await resolveSession(activeSession.id);
    setActiveSession(null);
    setMessages([]);
    loadSessions();
  };

  // Real-time subscription for active session messages
  useEffect(() => {
    if (!activeSession) return;
    const channel = supabase
      .channel(`admin-chat-${activeSession.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `session_id=eq.${activeSession.id}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => [...prev, msg]);
        if (msg.message_type === 'user') markUserMessagesRead(activeSession.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession]);

  // Poll for new sessions every 15 s
  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 15_000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openSessions   = sessions.filter((s) => s.status === 'open');
  const closedSessions = sessions.filter((s) => s.status === 'resolved');

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#F5F5F5', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#000', borderBottom: '1px solid rgba(232,25,44,0.2)', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={16} /> Admin
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', letterSpacing: 1, color: '#fff' }}>
            Customer Messages
          </div>
          <div style={{ fontSize: '0.6rem', letterSpacing: 2, color: '#F5C300', textTransform: 'uppercase', fontWeight: 700 }}>
            {openSessions.length} open · {closedSessions.length} resolved
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Session list */}
        <div style={{ width: 220, borderRight: '1px solid #1a1a1a', overflowY: 'auto', flexShrink: 0 }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#A0A0A0', fontSize: '0.8rem' }}>Loading…</div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#A0A0A0', fontSize: '0.8rem' }}>No conversations yet.</div>
          ) : (
            <>
              {openSessions.length > 0 && (
                <>
                  <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.65rem', color: '#F5C300', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>Open</div>
                  {openSessions.map((s) => <SessionRow key={s.id} session={s} active={activeSession?.id === s.id} onClick={() => openSession(s)} />)}
                </>
              )}
              {closedSessions.length > 0 && (
                <>
                  <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.65rem', color: '#A0A0A0', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginTop: 8 }}>Resolved</div>
                  {closedSessions.map((s) => <SessionRow key={s.id} session={s} active={activeSession?.id === s.id} onClick={() => openSession(s)} />)}
                </>
              )}
            </>
          )}
        </div>

        {/* Chat pane */}
        {activeSession ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Chat header */}
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{activeSession.user_name ?? 'Customer'}</div>
                <div style={{ fontSize: '0.7rem', color: '#A0A0A0' }}>{activeSession.user_email}</div>
              </div>
              {activeSession.status === 'open' && (
                <button
                  onClick={handleResolve}
                  style={{ background: '#161616', border: '1px solid #262626', color: '#22C55E', padding: '0.3rem 0.75rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  <CheckCheck size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Resolve
                </button>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.message_type === 'admin' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '72%', padding: '0.5rem 0.75rem',
                    borderRadius: msg.message_type === 'admin' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    background: msg.message_type === 'admin' ? '#E8192C' : '#161616',
                    color: '#F5F5F5', fontSize: '0.85rem', lineHeight: 1.5,
                  }}>
                    {msg.message_text}
                    <div style={{ fontSize: '0.65rem', color: msg.message_type === 'admin' ? 'rgba(255,255,255,0.6)' : '#A0A0A0', marginTop: 4, textAlign: 'right' }}>
                      {new Date(msg.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {activeSession.status === 'open' && (
              <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 8 }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a reply…"
                  style={{ flex: 1, background: '#161616', border: '1px solid #262626', borderRadius: 8, padding: '0.625rem 0.875rem', color: '#F5F5F5', outline: 'none', fontSize: '0.875rem' }}
                />
                <button
                  onClick={handleSend} disabled={sending || !input.trim()}
                  style={{ background: '#E8192C', border: 'none', color: '#fff', borderRadius: 8, padding: '0.625rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: sending ? 0.5 : 1 }}
                >
                  <Send size={14} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A0A0A0', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '2rem' }}>💬</div>
            <p style={{ fontSize: '0.875rem' }}>Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionRow({ session, active, onClick }: { session: ChatSession; active: boolean; onClick: () => void }) {
  const hasUnread = (session.unread_count ?? 0) > 0;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', background: active ? 'rgba(232,25,44,0.08)' : 'transparent',
        border: 'none', borderLeft: active ? '2px solid #E8192C' : '2px solid transparent',
        padding: '0.625rem 0.75rem', cursor: 'pointer', transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: hasUnread ? 700 : 400, fontSize: '0.8rem', color: active ? '#fff' : '#F5F5F5', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session.user_name ?? 'Customer'}
        </span>
        {hasUnread && (
          <span style={{ background: '#E8192C', color: '#fff', borderRadius: '50%', fontSize: '0.6rem', fontWeight: 700, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {session.unread_count}
          </span>
        )}
      </div>
      <div style={{ fontSize: '0.7rem', color: '#A0A0A0', marginTop: 2 }}>
        {session.status === 'resolved' ? '✓ Resolved' : 'Open'}
      </div>
    </button>
  );
}
