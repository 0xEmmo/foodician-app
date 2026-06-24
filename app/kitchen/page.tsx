"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, RefreshCw, ArrowLeft } from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { useAppStore, type Order } from "@/src/store/useAppStore";
import KDSOrderCard from "@/src/components/KDSOrderCard";
import { notifyTelegram } from "@/src/lib/notifyTelegram";

type ActiveOrder = Order & {
  id: number | string;
  order_type?: string;
  delivery_address?: string;
  user_name?: string;
  order_notes?: string;
};

function nextStatus(order: ActiveOrder): string | null {
  if (order.order_type === 'delivery') {
    if (order.status === 'Confirmed') return 'Preparing';
    if (order.status === 'Preparing') return 'Out for Delivery'; // kitchen dispatches
    return null;
  }
  // Pickup
  if (order.status === 'Confirmed') return 'Ready';
  if (order.status === 'Ready')     return 'Completed';
  return null;
}

export default function KitchenPage() {
  const sessionUser = useAppStore((s) => s.sessionUser);
  const router      = useRouter();
  const [orders,     setOrders]     = useState<ActiveOrder[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [advancing,  setAdvancing]  = useState<Record<string, boolean>>({});
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["Confirmed", "Preparing", "Ready"])
      .order("created_at", { ascending: true });
    setOrders((data as ActiveOrder[]) ?? []);
    setLoading(false);
    setLastUpdate(new Date());
  }, []);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel("kds-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [fetchOrders]);

  async function advanceStatus(order: ActiveOrder) {
    const next = nextStatus(order);
    if (!next) return;
    setAdvancing((prev) => ({ ...prev, [String(order.id)]: true }));
    await supabase.from("orders").update({ status: next }).eq("id", order.id);
    setAdvancing((prev) => ({ ...prev, [String(order.id)]: false }));
    fetchOrders();

    const statusMap: Record<string, 'cooking' | 'ready' | 'out_for_delivery' | 'completed'> = {
      Preparing:           'cooking',
      Ready:               'ready',
      'Out for Delivery':  'out_for_delivery',
      Completed:           'completed',
    };
    const telegramStatus = statusMap[next];
    if (telegramStatus) {
      const items = Array.isArray(order.items) ? (order.items as string[]) : [];
      notifyTelegram({
        status:       telegramStatus,
        customerName: order.user_name || 'Customer',
        items,
        total:        order.total_amount,
        orderType:    order.order_type,
        address:      order.delivery_address,
      });
    }
  }

  function makeCard(order: ActiveOrder) {
    return (
      <KDSOrderCard
        key={order.id}
        order={{
          id:               order.id!,
          code:             order.code,
          items:            order.items,
          mins:             order.mins,
          time:             order.time,
          status:           order.status,
          order_type:       order.order_type,
          delivery_address: order.delivery_address,
          user_name:        order.user_name,
          order_notes:      order.order_notes,
        }}
        onAdvance={() => advanceStatus(order)}
        advancing={advancing[String(order.id)] ?? false}
      />
    );
  }

  const confirmed  = orders.filter((o) => o.status === "Confirmed");
  const preparing  = orders.filter((o) => o.status === "Preparing");
  const ready      = orders.filter((o) => o.status === "Ready");

  if (!sessionUser) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-[#A0A0A0]">Sign in to access the kitchen display.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F5]">
      {/* Header */}
      <div className="bg-[#0F0F0F] border-b border-[#262626] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ChefHat size={22} className="text-[#E8192C]" />
          <div>
            <h1 className="text-base font-black" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px" }}>
              KITCHEN DISPLAY
            </h1>
            <p className="text-[10px] text-[#A0A0A0]">Last updated {lastUpdate.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchOrders}
            className="p-2 rounded-xl border border-[#262626] text-[#A0A0A0] hover:text-[#F5F5F5] hover:border-[#E8192C]/40 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#262626] text-[#A0A0A0] hover:text-[#F5F5F5] hover:border-[#F5C300]/40 transition-colors text-[0.8rem] font-semibold"
          >
            <ArrowLeft size={14} /> Admin
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 rounded-full border-2 border-[#262626] border-t-[#E8192C] animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <ChefHat size={48} className="text-[#262626] mb-4" />
          <p className="text-lg font-semibold text-[#F5F5F5]">All clear!</p>
          <p className="text-sm text-[#A0A0A0]">No active orders right now.</p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Confirmed */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#F5C300]" />
              <h2 className="text-sm font-bold text-[#F5C300] uppercase tracking-widest">
                New Orders ({confirmed.length})
              </h2>
            </div>
            <div className="space-y-3">
              {confirmed.map(makeCard)}
              {confirmed.length === 0 && <p className="text-sm text-[#A0A0A0] text-center py-8">No new orders</p>}
            </div>
          </div>

          {/* Preparing */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <h2 className="text-sm font-bold text-orange-400 uppercase tracking-widest">
                Preparing ({preparing.length})
              </h2>
            </div>
            <div className="space-y-3">
              {preparing.map(makeCard)}
              {preparing.length === 0 && <p className="text-sm text-[#A0A0A0] text-center py-8">Nothing being prepared</p>}
            </div>
          </div>

          {/* Ready — pickup orders only */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
              <h2 className="text-sm font-bold text-[#22C55E] uppercase tracking-widest">
                Ready for Pickup ({ready.length})
              </h2>
            </div>
            <div className="space-y-3">
              {ready.map(makeCard)}
              {ready.length === 0 && <p className="text-sm text-[#A0A0A0] text-center py-8">No pickup orders ready</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
