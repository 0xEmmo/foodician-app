"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send } from "lucide-react";
import type { ChatSession, ChatMessage } from "@/src/lib/chat";

interface ChatPanelProps {
  session:       ChatSession | null;
  messages:      ChatMessage[];
  currentUserId: string;
  input:         string;
  sending:       boolean;
  onInputChange: (v: string) => void;
  onSend:        () => void;
  onClose:       () => void;
}

export default function ChatPanel({
  session, messages, currentUserId,
  input, sending, onInputChange, onSend, onClose,
}: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-[5.5rem] right-4 z-50 w-[340px] max-h-[70vh] flex flex-col bg-[#0F0F0F] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#161616] border-b border-[#262626]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
          <span className="text-sm font-semibold text-[#F5F5F5]">Support Chat</span>
        </div>
        <button onClick={onClose} className="text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar">
        {!session && (
          <p className="text-center text-xs text-[#A0A0A0] py-6">Connecting…</p>
        )}
        {session && messages.length === 0 && (
          <div className="text-center py-6 space-y-1">
            <p className="text-sm text-[#F5F5F5]">👋 Hi there!</p>
            <p className="text-xs text-[#A0A0A0]">Send us a message — we usually reply quickly.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isUser = msg.message_type === "user";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? "bg-[#E8192C] text-white rounded-br-sm"
                      : "bg-[#1a1a1a] text-[#F5F5F5] rounded-bl-sm border border-[#262626]"
                  }`}
                >
                  <p>{msg.message_text}</p>
                  <p className={`text-[10px] mt-1 ${isUser ? "text-white/50 text-right" : "text-[#A0A0A0]"}`}>
                    {fmt(msg.created_at)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-[#262626] flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 bg-[#161616] border border-[#262626] rounded-xl px-3 py-2 text-sm text-[#F5F5F5] placeholder-[#A0A0A0] resize-none outline-none focus:border-[#E8192C]/50 transition-colors no-scrollbar"
          style={{ maxHeight: 80 }}
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || sending}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#E8192C] text-white disabled:opacity-40 hover:bg-[#FF2E43] transition-colors flex-shrink-0"
        >
          <Send size={15} />
        </button>
      </div>
    </motion.div>
  );
}
