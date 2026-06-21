"use client";

import { useState } from "react";
import { Tag, X } from "lucide-react";
import { validatePromoCode, type PromoCode } from "@/src/lib/promos";

interface PromoCodeInputProps {
  userId:    string;
  subtotal:  number;
  onApplied: (discount: number, promo: PromoCode) => void;
  onRemoved: () => void;
}

export default function PromoCodeInput({ userId, subtotal, onApplied, onRemoved }: PromoCodeInputProps) {
  const [code,     setCode]     = useState("");
  const [status,   setStatus]   = useState<"idle" | "loading" | "applied" | "error">("idle");
  const [message,  setMessage]  = useState("");
  const [applied,  setApplied]  = useState<PromoCode | null>(null);
  const [discount, setDiscount] = useState(0);

  async function handleApply() {
    if (!code.trim()) return;
    setStatus("loading");
    const result = await validatePromoCode(code, userId, subtotal);
    if (result.valid && result.promo) {
      setStatus("applied");
      setMessage(result.message);
      setDiscount(result.discount);
      setApplied(result.promo);
      onApplied(result.discount, result.promo);
    } else {
      setStatus("error");
      setMessage(result.message);
    }
  }

  function handleRemove() {
    setCode("");
    setStatus("idle");
    setMessage("");
    setApplied(null);
    setDiscount(0);
    onRemoved();
  }

  if (status === "applied" && applied) {
    return (
      <div className="flex items-center justify-between bg-[#0d1f0d] border border-[#22C55E]/30 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Tag size={14} className="text-[#22C55E]" />
          <span className="text-xs font-semibold text-[#22C55E]">{applied.code}</span>
          <span className="text-xs text-[#22C55E]/70">−₦{discount.toLocaleString()}</span>
        </div>
        <button onClick={handleRemove} className="text-[#A0A0A0] hover:text-[#F5F5F5]">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-[#161616] border border-[#262626] rounded-xl px-3 py-2.5 focus-within:border-[#E8192C]/50 transition-colors">
          <Tag size={14} className="text-[#A0A0A0] flex-shrink-0" />
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setStatus("idle"); }}
            placeholder="Promo code"
            className="flex-1 bg-transparent text-sm text-[#F5F5F5] placeholder-[#A0A0A0] outline-none uppercase"
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
          />
        </div>
        <button
          onClick={handleApply}
          disabled={!code.trim() || status === "loading"}
          className="px-4 py-2.5 bg-[#E8192C] text-white text-sm font-semibold rounded-xl hover:bg-[#FF2E43] disabled:opacity-40 transition-colors"
        >
          {status === "loading" ? "…" : "Apply"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-xs text-[#E8192C] px-1">{message}</p>
      )}
    </div>
  );
}
