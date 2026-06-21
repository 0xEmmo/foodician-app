'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Circle, Clock, Package, XCircle, Download, Star } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useAppStore } from '@/src/store/useAppStore';
import { generateReceiptPDF } from '@/src/lib/receipts';
import { SkeletonOrderCard } from '@/src/components/SkeletonCard';

type Order = {
  id: number;
  user_name: string;
  verification_code: string;
  total_amount: number;
  status: 'Confirmed' | 'Ready' | 'Cancelled' | 'Completed';
  items: string[];
  payment_method?: string;
  order_type?: string;
  created_at: string;
};

type RatingItem = { name: string; rating: number; comment: string };

// ─── Order status timeline ────────────────────────────────────────
const STEPS = [
  { key: 'Confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'Ready',     label: 'Ready',     icon: Package },
  { key: 'Completed', label: 'Collected', icon: CheckCircle },
] as const;

function StatusTimeline({ status }: { status: Order['status'] }) {
  if (status === 'Cancelled') {
    return (
      <div className="flex items-center gap-2 my-3">
        <XCircle size={16} className="text-[#E8192C]" />
        <span className="text-sm font-semibold text-[#E8192C]">Order Cancelled</span>
      </div>
    );
  }

  const activeIdx = status === 'Completed' ? 2 : status === 'Ready' ? 1 : 0;

  return (
    <div className="flex items-center gap-0 my-3">
      {STEPS.map((step, i) => {
        const done   = i < activeIdx;
        const active = i === activeIdx;
        const Icon   = step.icon;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              {done ? (
                <CheckCircle size={18} className="text-[#22C55E]" fill="rgba(34,197,94,0.15)" />
              ) : active ? (
                <div className="relative">
                  <Icon size={18} className="text-[#E8192C]" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#E8192C] animate-ping" />
                </div>
              ) : (
                <Circle size={18} className="text-[#262626]" />
              )}
              <span className={`text-[9px] font-semibold whitespace-nowrap ${done ? 'text-[#22C55E]' : active ? 'text-[#E8192C]' : 'text-[#A0A0A0]'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 rounded-full ${done ? 'bg-[#22C55E]' : 'bg-[#262626]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrdersPage() {
  const sessionUser = useAppStore((s) => s.sessionUser);
  const [orders,          setOrders]          = useState<Order[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [currentOrder,    setCurrentOrder]    = useState<Order | null>(null);
  const [ratings,         setRatings]         = useState<Record<string, RatingItem>>({});
  const [submitting,      setSubmitting]      = useState(false);
  const [downloadingId,   setDownloadingId]   = useState<number | null>(null);
  // Tracks latest orders so the tick interval can access them without a stale closure
  const ordersRef = useRef<Order[]>([]);
  // Set of order IDs still within the 2-min cancel window (avoids Date.now() during render)
  const [cancellableIds, setCancellableIds] = useState<Set<number>>(new Set());

  // Pure helper — called only inside callbacks, never synchronously in effect body
  function buildCancellable(list: Order[]): Set<number> {
    const limit = 2 * 60 * 1000;
    const now   = new Date().getTime();
    return new Set(
      list
        .filter(o => o.status === 'Confirmed' && now - new Date(o.created_at).getTime() < limit)
        .map(o => o.id)
    );
  }

  function applyOrders(list: Order[]) {
    ordersRef.current = list;
    setOrders(list);
    setCancellableIds(buildCancellable(list));
  }

  const cancelOrder = async (order: Order) => {
    if (!cancellableIds.has(order.id)) {
      alert('You can only cancel orders within 2 minutes of placing them.');
      return;
    }
    if (!confirm(`Cancel order #${order.verification_code}?`)) return;
    const { error } = await supabase.from('orders').update({ status: 'Cancelled' }).eq('id', order.id);
    if (!error) {
      const updated = ordersRef.current.map(o => o.id === order.id ? { ...o, status: 'Cancelled' as const } : o);
      applyOrders(updated);
    }
  };

  useEffect(() => {
    if (!sessionUser) return;

    // Initial fetch — setState in .then() callback, not synchronously in effect body
    supabase
      .from('orders')
      .select('*')
      .eq('user_name', sessionUser.name)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) applyOrders(data as Order[]);
        setLoading(false);
      });

    // Re-check cancel window every 5 s without calling Date.now() during render
    const tick = setInterval(() => setCancellableIds(buildCancellable(ordersRef.current)), 5_000);

    const channel = supabase
      .channel('orders-channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_name=eq.${sessionUser.name}` },
        (payload) => {
          const u = payload.new as Order;
          const next = ordersRef.current.map(o => o.id === u.id ? u : o);
          applyOrders(next);
          if (u.status === 'Ready' && Notification.permission === 'granted') {
            new Notification('Your order is ready! 🍽️', {
              body: `Order #${u.verification_code} is ready for pickup.`,
              icon: '/icon.png',
            });
          }
        }
      )
      .subscribe();

    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();

    const poll = setInterval(() => {
      supabase
        .from('orders')
        .select('*')
        .eq('user_name', sessionUser.name)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) applyOrders(data as Order[]);
        });
    }, 10_000);

    return () => { supabase.removeChannel(channel); clearInterval(tick); clearInterval(poll); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUser]);

  async function handleDownloadReceipt(order: Order) {
    setDownloadingId(order.id);
    const rawItems = order.items.map((itemStr) => {
      const match = itemStr.match(/^(.*?)\s*\(x(\d+)\)\s*[@×x]\s*₦?([\d,]+)?$/i)
                 ?? itemStr.match(/^(.*?)\s*\(x(\d+)\)$/);
      const name   = match ? match[1].trim() : itemStr;
      const qty    = match ? parseInt(match[2], 10) : 1;
      const price  = 0;
      return { name, qty, price, subtotal: price * qty };
    });
    await generateReceiptPDF({
      orderId:       String(order.id),
      customerName:  order.user_name,
      items:         rawItems,
      subtotal:      order.total_amount,
      deliveryFee:   0,
      discount:      0,
      total:         order.total_amount,
      paymentMethod: order.payment_method ?? 'paystack',
      orderType:     order.order_type ?? 'pickup',
      createdAt:     order.created_at,
    });
    setDownloadingId(null);
  }

  const openRatingModal = (order: Order) => {
    setCurrentOrder(order);
    const initial: Record<string, RatingItem> = {};
    order.items.forEach((s) => {
      const name = s.replace(/\s*\(x\d+\).*/, '').trim();
      initial[name] = { name, rating: 5, comment: '' };
    });
    setRatings(initial);
    setRatingModalOpen(true);
  };

  const submitRatings = async () => {
    if (!currentOrder || !sessionUser) return;
    setSubmitting(true);
    for (const item of Object.values(ratings)) {
      await supabase.from('ratings').insert({
        order_id: currentOrder.id, item_name: item.name,
        rating: item.rating, comment: item.comment || null, user_id: sessionUser.id,
      });
    }
    alert('Thank you for your feedback!');
    setRatingModalOpen(false);
    setSubmitting(false);
  };

  if (!sessionUser) {
    return <div className="min-h-screen flex items-center justify-center bg-[#050505]"><p className="text-[#A0A0A0]">Please log in to view your orders.</p></div>;
  }

  return (
    <>
      <div className="min-h-screen bg-[#050505] text-white">
        <div className="max-w-2xl mx-auto p-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#6B000A] flex items-center justify-center bg-black flex-shrink-0">
              <img src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=100&q=80" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-white leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', letterSpacing: '0.5px' }}>My Orders</h1>
              <p className="text-[0.6rem] tracking-[2px] text-[#F5C300] uppercase font-bold">Real‑time status from kitchen</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <SkeletonOrderCard key={i} />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-[#A0A0A0]">
              <div className="text-6xl mb-4">🍱</div>
              <p className="text-lg font-medium">No orders yet</p>
              <p className="text-sm">Place your first order from the home page!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const canCancel = cancellableIds.has(order.id);
                return (
                  <div key={order.id} className="bg-[#0F0F0F] border border-[#262626] rounded-2xl p-4 shadow-md">
                    {/* Order header */}
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-lg text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                          #{order.verification_code}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[#A0A0A0]">
                          <Clock size={11} />
                          <span>{new Date(order.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <span className="text-lg font-black text-[#F5C300]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                        ₦{order.total_amount.toLocaleString()}
                      </span>
                    </div>

                    {/* Timeline */}
                    <StatusTimeline status={order.status} />

                    {/* Items */}
                    <div className="bg-[#161616] rounded-xl p-3 mb-3 space-y-1">
                      {order.items.map((item, idx) => (
                        <p key={idx} className="text-xs text-[#F5F5F5]">• {item}</p>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {canCancel && (
                        <button onClick={() => cancelOrder(order)} className="flex-1 py-2 rounded-xl bg-[#E8192C]/10 border border-[#E8192C]/30 text-[#E8192C] text-xs font-semibold hover:bg-[#E8192C]/20 transition-colors">
                          Cancel Order
                        </button>
                      )}
                      <button
                        onClick={() => handleDownloadReceipt(order)}
                        disabled={downloadingId === order.id}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#161616] border border-[#262626] text-xs text-[#A0A0A0] hover:text-[#F5F5F5] hover:border-[#E8192C]/40 transition-colors disabled:opacity-50"
                      >
                        <Download size={12} />
                        {downloadingId === order.id ? 'Generating…' : 'PDF Receipt'}
                      </button>
                      {order.status === 'Completed' && (
                        <button onClick={() => openRatingModal(order)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F5C300]/10 border border-[#F5C300]/20 text-[#F5C300] text-xs font-semibold hover:bg-[#F5C300]/20 transition-colors">
                          <Star size={12} />
                          Rate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Rating Modal */}
      {ratingModalOpen && currentOrder && (
        <div className="fixed inset-0 z-[800] flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-[#262626] rounded-t-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6 no-scrollbar">
            <h2 className="text-xl font-black text-[#F5C300] mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Rate Your Order</h2>
            <p className="text-xs text-[#A0A0A0] mb-4">#{currentOrder.verification_code}</p>
            <div className="space-y-5">
              {Object.values(ratings).map((item) => (
                <div key={item.name} className="border-b border-[#262626] pb-4">
                  <p className="text-sm font-semibold text-[#F5F5F5] mb-2">{item.name}</p>
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} onClick={() => setRatings((p) => ({ ...p, [item.name]: { ...p[item.name], rating: star } }))}
                        className={`text-2xl transition ${star <= item.rating ? 'text-[#F5C300]' : 'text-[#262626]'}`}>★</button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Optional comment…"
                    value={item.comment}
                    onChange={(e) => setRatings((p) => ({ ...p, [item.name]: { ...p[item.name], comment: e.target.value } }))}
                    className="w-full bg-[#161616] border border-[#262626] rounded-xl p-2.5 text-sm text-[#F5F5F5] placeholder-[#A0A0A0] outline-none focus:border-[#E8192C]/50 resize-none"
                    rows={2}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={submitRatings} disabled={submitting}
                className="flex-1 bg-[#E8192C] hover:bg-[#FF2E43] disabled:opacity-50 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
              <button onClick={() => setRatingModalOpen(false)}
                className="flex-1 border border-[#262626] py-2.5 rounded-xl text-sm text-[#A0A0A0] hover:text-[#F5F5F5] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
