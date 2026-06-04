'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAppStore } from '@/src/store/useAppStore';
import { printReceipt } from '@/src/lib/printReceipt';

type Order = {
  id: number;
  user_name: string;
  verification_code: string;
  total_amount: number;
  status: 'Confirmed' | 'Ready' | 'Cancelled' | 'Completed';
  items: string[];
  created_at: string;
};

type RatingItem = {
  name: string;
  rating: number;
  comment: string;
};

export default function OrdersPage() {
  const sessionUser = useAppStore((state) => state.sessionUser);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [ratings, setRatings] = useState<Record<string, RatingItem>>({});
  const [submitting, setSubmitting] = useState(false);

  // ─── Fetch orders (initial + polling fallback) ─────────────────────────────
  const fetchOrders = async () => {
    if (!sessionUser) return;
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_name', sessionUser.name)
      .order('created_at', { ascending: false });
    if (!error && data) setOrders(data);
    setLoading(false);
  };

  // ─── Cancel order (only within 2 minutes) ──────────────────────────────────
  const cancelOrder = async (order: Order) => {
    const createdAt = new Date(order.created_at).getTime();
    const now = Date.now();
    const twoMinutes = 2 * 60 * 1000;
    if (now - createdAt > twoMinutes) {
      alert('You can only cancel orders within 2 minutes of placing them.');
      return;
    }
    if (!confirm(`Cancel order #${order.verification_code}? This action cannot be undone.`)) return;

    const { error } = await supabase
      .from('orders')
      .update({ status: 'Cancelled' })
      .eq('id', order.id);

    if (error) {
      console.error('Cancel failed:', error);
      alert('Could not cancel order. Please contact support.');
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'Cancelled' } : o))
      );
      alert('Order cancelled successfully.');
    }
  };

  // ─── Real‑time subscription for status updates ────────────────────────────
  useEffect(() => {
    if (!sessionUser) return;

    fetchOrders();

    const channel = supabase
      .channel('orders-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_name=eq.${sessionUser.name}`,
        },
        (payload) => {
          const updatedOrder = payload.new as Order;
          setOrders((prev) =>
            prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
          );

          // Push notification if status becomes "Ready"
          if (updatedOrder.status === 'Ready' && Notification.permission === 'granted') {
            new Notification('Your order is ready! 🍽️', {
              body: `Order #${updatedOrder.verification_code} is ready for pickup.`,
              icon: '/icon.png',
            });
          }
        }
      )
      .subscribe();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const interval = setInterval(fetchOrders, 10000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [sessionUser]);

  // ─── Print receipt ─────────────────────────────────────────────────────────
  const handlePrintReceipt = (order: Order) => {
    const receiptItems = order.items.map((itemStr) => {
      const match = itemStr.match(/^(.*?)\s*\(x(\d+)\)$/);
      if (match) {
        return {
          name: match[1].trim(),
          quantity: parseInt(match[2], 10),
          price: 0,
        };
      }
      return { name: itemStr, quantity: 1, price: 0 };
    });

    printReceipt({
      code: order.verification_code,
      date: order.created_at,
      customer: order.user_name,
      items: receiptItems,
      total: order.total_amount,
    });
  };

  // ─── Rating modal handlers ─────────────────────────────────────────────────
  const openRatingModal = (order: Order) => {
    setCurrentOrder(order);
    const initial: Record<string, RatingItem> = {};
    order.items.forEach((itemStr) => {
      const itemName = itemStr.replace(/\s*\(x\d+\)/, '').trim();
      initial[itemName] = { name: itemName, rating: 5, comment: '' };
    });
    setRatings(initial);
    setRatingModalOpen(true);
  };

  const updateRating = (itemName: string, field: keyof RatingItem, value: any) => {
    setRatings((prev) => ({
      ...prev,
      [itemName]: { ...prev[itemName], [field]: value },
    }));
  };

  const submitRatings = async () => {
    if (!currentOrder || !sessionUser) return;
    setSubmitting(true);
    try {
      for (const item of Object.values(ratings)) {
        await supabase.from('ratings').insert({
          order_id: currentOrder.id,
          item_name: item.name,
          rating: item.rating,
          comment: item.comment || null,
          user_id: sessionUser.id,
        });
      }
      alert('Thank you for your feedback!');
      setRatingModalOpen(false);
    } catch (err) {
      console.error('Rating submit error:', err);
      alert('Failed to submit ratings. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!sessionUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <p className="text-[#A0A0A0]">Please log in to view your orders.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#262626] border-t-[#E8192C] animate-spin" />
          <p className="text-[#A0A0A0] text-sm uppercase tracking-wider">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[#050505] text-white font-['DM_Sans',sans-serif]">
        <div className="max-w-2xl mx-auto p-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#6B000A] shadow-[0_0_12px_rgba(245,195,0,0.25)] flex items-center justify-center bg-black flex-shrink-0">
              <img
                src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=100&q=80"
                alt="Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-white leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', letterSpacing: '0.5px' }}>
                My Orders
              </h1>
              <p className="text-[0.6rem] tracking-[2px] text-[#F5C300] uppercase font-bold">Real‑time status from kitchen</p>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-16 text-[#A0A0A0]">
              <div className="text-6xl mb-4">🍱</div>
              <p className="text-lg font-medium">No orders yet</p>
              <p className="text-sm">Place your first order from the home page!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const canCancel = order.status === 'Confirmed' && (Date.now() - new Date(order.created_at).getTime() < 2 * 60 * 1000);
                return (
                  <div key={order.id} className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-4 shadow-md">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-bebas text-xl text-white">#{order.verification_code}</div>
                        <div className="text-xs text-[#A0A0A0] mt-1">
                          {new Date(order.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div
                        className={`text-xs font-bold px-2 py-1 rounded ${
                          order.status === 'Ready'
                            ? 'bg-green-500/20 text-green-400'
                            : order.status === 'Cancelled'
                            ? 'bg-red-500/20 text-red-400'
                            : order.status === 'Completed'
                            ? 'bg-gray-500/20 text-gray-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {order.status.toUpperCase()}
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="text-sm bg-[#161616] p-2 rounded-md">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="py-0.5">📦 {item}</div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between items-center gap-2 mt-3">
                      <span className="font-bebas text-xl text-[#F5C300]">₦{order.total_amount.toLocaleString()}</span>
                      <div className="flex gap-2">
                        {/* Cancel button (only if eligible) */}
                        {canCancel && (
                          <button
                            onClick={() => cancelOrder(order)}
                            className="bg-red-800 hover:bg-red-700 px-3 py-1 rounded text-xs font-semibold transition"
                          >
                            Cancel Order
                          </button>
                        )}
                        {/* Print Receipt button */}
                        <button
                          onClick={() => handlePrintReceipt(order)}
                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs font-semibold transition"
                        >
                          🖨️ Receipt
                        </button>
                        {/* Rate button – only for completed orders */}
                        {order.status === 'Completed' && (
                          <button
                            onClick={() => openRatingModal(order)}
                            className="bg-yellow-600 hover:bg-yellow-500 px-3 py-1 rounded text-xs font-semibold transition"
                          >
                            ⭐ Rate Order
                          </button>
                        )}
                      </div>
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
        <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-[#0F0F0F] border border-[#262626] rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6">
            <h2 className="font-bebas text-2xl text-[#F5C300] mb-4">Rate Your Order</h2>
            <p className="text-sm text-gray-400 mb-4">Order #{currentOrder.verification_code}</p>
            <div className="space-y-6">
              {Object.values(ratings).map((item) => (
                <div key={item.name} className="border-b border-[#262626] pb-4">
                  <p className="font-medium mb-2">{item.name}</p>
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => updateRating(item.name, 'rating', star)}
                        className={`text-2xl transition ${
                          star <= item.rating ? 'text-yellow-400' : 'text-gray-600'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Optional comment..."
                    value={item.comment}
                    onChange={(e) => updateRating(item.name, 'comment', e.target.value)}
                    className="w-full bg-[#161616] border border-[#262626] rounded-lg p-2 text-sm text-white"
                    rows={2}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={submitRatings}
                disabled={submitting}
                className="flex-1 bg-[#E8192C] hover:bg-red-700 disabled:opacity-50 py-2 rounded-lg font-bold"
              >
                {submitting ? 'Submitting...' : 'Submit Ratings'}
              </button>
              <button
                onClick={() => setRatingModalOpen(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}