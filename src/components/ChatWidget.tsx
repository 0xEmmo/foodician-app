"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import {
  getOrCreateSession, fetchMessages, sendUserMessage,
  markAdminMessagesRead,
  type ChatSession, type ChatMessage,
} from "@/src/lib/chat";
import { useAppStore } from "@/src/store/useAppStore";
import ChatPanel from "@/src/components/ChatPanel";

export default function ChatWidget() {
  const sessionUser = useAppStore((s) => s.sessionUser);

  const [isOpen,      setIsOpen]      = useState(false);
  const [session,     setSession]     = useState<ChatSession | null>(null);
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast,       setToast]       = useState<{ text: string; id: number } | null>(null);
  const [input,       setInput]       = useState("");
  const [sending,     setSending]     = useState(false);

  const isOpenRef    = useRef(isOpen);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  useEffect(() => {
    if (!sessionUser) return;
    (async () => {
      const sess = await getOrCreateSession(sessionUser.id);
      if (!sess) return;
      setSession(sess);
      const msgs = await fetchMessages(sess.id);
      setMessages(msgs);
      setUnreadCount(msgs.filter((m) => m.message_type === "admin" && !m.is_read).length);
    })();
  }, [sessionUser]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel(`chat-widget-${session.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `session_id=eq.${session.id}`,
      }, (payload) => {
        const msg = payload.new as ChatMessage;
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        if (msg.message_type === "admin") {
          if (!isOpenRef.current) {
            setUnreadCount((c) => c + 1);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            setToast({ text: msg.message_text.slice(0, 80), id: Date.now() });
            toastTimerRef.current = setTimeout(() => setToast(null), 5000);
          } else {
            markAdminMessagesRead(session.id);
          }
        }
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [session]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
    setToast(null);
    if (session) markAdminMessagesRead(session.id);
  }, [session]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !session || !sessionUser || sending) return;
    const text  = input.trim();
    const tempId = `temp-${Date.now()}`;
    setInput("");
    setSending(true);
    const optimistic: ChatMessage = {
      id: tempId, session_id: session.id, order_id: null,
      user_id: sessionUser.id, admin_id: null, message_text: text,
      message_type: "user", is_read: false, created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const saved = await sendUserMessage(session.id, sessionUser.id, text);
    if (saved) setMessages((prev) => prev.map((m) => m.id === tempId ? saved : m));
    setSending(false);
  }, [input, session, sessionUser, sending]);

  if (!sessionUser) return null;

  return (
    <>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.button
            key={toast.id}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            onClick={handleOpen}
            className="fixed right-4 z-[90] bg-[#0F0F0F] border border-[#E8192C]/30 text-white rounded-2xl px-4 py-3 max-w-[260px] shadow-2xl text-left"
          style={{ bottom: 'calc(110px + env(safe-area-inset-bottom, 0px))' }}
          >
            <p className="text-[10px] font-bold text-[#E8192C] mb-0.5 uppercase tracking-wider">Support</p>
            <p className="text-sm leading-snug text-[#F5F5F5]">{toast.text}{toast.text.length >= 80 ? "…" : ""}</p>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <ChatPanel
            session={session} messages={messages}
            currentUserId={sessionUser.id}
            input={input} sending={sending}
            onInputChange={setInput}
            onSend={handleSend}
            onClose={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        whileTap={{ scale: 0.92 }}
        className="fixed right-4 z-[90] w-12 h-12 rounded-full bg-[#E8192C] text-white shadow-lg shadow-[#E8192C]/30 flex items-center justify-center hover:bg-[#FF2E43] transition-colors"
        style={{ bottom: 'calc(82px + env(safe-area-inset-bottom, 0px))' }}
        aria-label={isOpen ? "Close chat" : "Open support chat"}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X size={20} /></motion.span>
            : <motion.span key="msg" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><MessageCircle size={20} /></motion.span>
          }
        </AnimatePresence>
        {unreadCount > 0 && !isOpen && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-[#F5C300] text-[#050505] text-[10px] font-black rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </motion.button>
    </>
  );
}
