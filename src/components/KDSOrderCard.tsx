"use client";

import { Clock, ChevronRight } from "lucide-react";

interface KDSOrderCardProps {
  order: {
    id:               number | string;
    code:             string;
    items:            string[];
    mins:             number;
    time:             string;
    status:           string;
    order_type?:      string;
    delivery_address?: string;
    user_name?:       string;
  };
  onAdvance: () => void;
  advancing: boolean;
}

const STATUS_NEXT: Record<string, { label: string; nextStatus: string; color: string }> = {
  Confirmed: { label: "Mark Ready",     nextStatus: "Ready",     color: "bg-[#E8192C] text-white hover:bg-[#FF2E43]" },
  Ready:     { label: "Mark Completed", nextStatus: "Completed", color: "bg-[#22C55E] text-white hover:bg-[#16a34a]" },
};

const STATUS_BADGE: Record<string, string> = {
  Confirmed: "bg-[#F5C300]/10 text-[#F5C300] border-[#F5C300]/20",
  Ready:     "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20",
};

function elapsedMinutes(isoTime: string): number {
  return Math.floor((Date.now() - new Date(isoTime).getTime()) / 60_000);
}

export default function KDSOrderCard({ order, onAdvance, advancing }: KDSOrderCardProps) {
  const elapsed = elapsedMinutes(order.time);
  const isUrgent = elapsed > (order.mins + 5);
  const action   = STATUS_NEXT[order.status];

  return (
    <div className={`bg-[#0F0F0F] border rounded-2xl p-4 flex flex-col gap-3 transition-colors ${isUrgent ? "border-[#E8192C]/50" : "border-[#262626]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-[#F5F5F5]">#{order.code}</span>
            {order.order_type === 'delivery' && (
              <span className="text-[10px] bg-[#60a5fa]/10 text-[#60a5fa] border border-[#60a5fa]/20 px-1.5 py-0.5 rounded-full font-bold">🛵 DELIVERY</span>
            )}
            {isUrgent && <span className="text-[10px] bg-[#E8192C]/10 text-[#E8192C] border border-[#E8192C]/20 px-1.5 py-0.5 rounded-full font-bold">LATE</span>}
          </div>
          {order.user_name && (
            <div className="text-xs text-[#A0A0A0] mt-0.5">👤 {order.user_name}</div>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <Clock size={11} className="text-[#A0A0A0]" />
            <span className={`text-xs ${isUrgent ? "text-[#E8192C] font-semibold" : "text-[#A0A0A0]"}`}>
              {elapsed}m elapsed · {order.mins}m target
            </span>
          </div>
        </div>
        <span className={`text-[10px] font-bold border px-2 py-1 rounded-full uppercase tracking-wide ${STATUS_BADGE[order.status] ?? "bg-[#161616] text-[#A0A0A0] border-[#262626]"}`}>
          {order.status}
        </span>
      </div>

      {order.order_type === 'delivery' && order.delivery_address && (
        <div className="bg-[#60a5fa]/5 border border-[#60a5fa]/15 rounded-lg px-3 py-2 text-xs text-[#A0A0A0]">
          📍 <span className="text-[#F5F5F5]">{order.delivery_address}</span>
        </div>
      )}

      <div className="space-y-1">
        {order.items.map((item, i) => (
          <p key={i} className="text-xs text-[#F5F5F5] leading-relaxed">• {item}</p>
        ))}
      </div>

      {action && (
        <button
          onClick={onAdvance}
          disabled={advancing}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${action.color}`}
        >
          {advancing ? "Updating…" : action.label}
          {!advancing && <ChevronRight size={14} />}
        </button>
      )}
    </div>
  );
}
