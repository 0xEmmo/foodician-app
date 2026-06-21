'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/src/store/useAppStore';
import { supabase } from '@/src/lib/supabase';

type DeliveryOrder = {
  id: number;
  verification_code: string;
  user_name: string;
  user_email: string;
  customer_phone: string | null;
  delivery_address: string | null;
  items: string[];
  total_amount: number;
  delivery_fee: number | null;
  status: string;
  created_at: string;
  order_notes: string | null;
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

const STATUS_COLOUR: Record<string, string> = {
  'Out for Delivery': '#60a5fa',
  'Arrived':          '#F5C300',
};

export default function RiderPage() {
  const router      = useRouter();
  const sessionUser = useAppStore(s => s.sessionUser);
  const [orders,   setOrders]   = useState<DeliveryOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [role,     setRole]     = useState<string>('');

  // Code verification modal (Arrived → Delivered)
  const [codeModal, setCodeModal] = useState<DeliveryOrder | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!sessionUser?.id) return;
    supabase.from('profiles').select('role').eq('id', sessionUser.id).single()
      .then(({ data }) => setRole(data?.role ?? 'user'));
  }, [sessionUser?.id]);

  const fetchOrders = useCallback(async () => {
    const res = await fetch('/api/rider/orders');
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel('rider-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [fetchOrders]);

  // Out for Delivery → Arrived
  const markArrived = async (order: DeliveryOrder) => {
    setUpdating(order.id);
    await fetch('/api/rider/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: order.id, status: 'Arrived' }),
    });
    setUpdating(null);
    fetchOrders();
  };

  const openCodeModal = (order: DeliveryOrder) => {
    setCodeModal(order);
    setCodeInput('');
    setCodeError('');
  };

  // Arrived → Delivered (requires customer code)
  const confirmDelivery = async () => {
    if (!codeModal) return;
    const entered  = codeInput.trim().toUpperCase();
    const expected = codeModal.verification_code?.toUpperCase();
    if (entered !== expected) {
      setCodeError('Code does not match. Ask the customer for their order code.');
      return;
    }
    setVerifying(true);
    await fetch('/api/rider/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: codeModal.id, status: 'Delivered' }),
    });
    setVerifying(false);
    setCodeModal(null);
    fetchOrders();
  };

  if (!sessionUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: '#A0A0A0' }}>Sign in to access the rider dashboard.</p>
        <button onClick={() => router.push('/')} style={{ background: '#E8192C', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Go to App</button>
      </div>
    );
  }

  if (role && role !== 'rider' && role !== 'admin') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: '2rem' }}>
        <div style={{ fontSize: '2.5rem' }}>🚫</div>
        <p style={{ color: '#E8192C', fontWeight: 700 }}>Access Denied</p>
        <p style={{ color: '#A0A0A0', textAlign: 'center' }}>This page is only for assigned riders.</p>
        <button onClick={() => router.push('/')} style={{ background: '#E8192C', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>← Back to App</button>
      </div>
    );
  }

  const active = orders.filter(o => o.status !== 'Delivered');
  const done   = orders.filter(o => o.status === 'Delivered');

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#F5F5F5', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '0 1.25rem', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.4rem' }}>🛵</span>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: 2, color: '#F5F5F5', lineHeight: 1 }}>RIDER DASHBOARD</div>
            <div style={{ fontSize: '0.65rem', color: '#A0A0A0', letterSpacing: 1 }}>Hey, {sessionUser.name}</div>
          </div>
        </div>
        <button
          onClick={fetchOrders}
          style={{ padding: '0.3rem 0.875rem', borderRadius: 6, background: '#161616', border: '1px solid #262626', color: '#A0A0A0', cursor: 'pointer', fontSize: '0.78rem' }}
        >
          ↻ Refresh
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.25rem 1rem' }}>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <div style={{ width: 32, height: 32, border: '2px solid #262626', borderTopColor: '#E8192C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : active.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#A0A0A0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🛵</div>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#F5F5F5', marginBottom: 4 }}>No active deliveries</p>
            <p style={{ fontSize: '0.85rem' }}>Orders dispatched by the kitchen will appear here.</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: '#F5C300', marginBottom: '1rem' }}>
              Active — {active.length} order{active.length !== 1 ? 's' : ''}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {active.map(order => (
                <div key={order.id} style={{ background: '#0C0C0C', border: `1px solid ${STATUS_COLOUR[order.status] ?? '#1a1a1a'}44`, borderRadius: 14, overflow: 'hidden' }}>

                  {/* Status bar */}
                  <div style={{ background: STATUS_COLOUR[order.status] ? `${STATUS_COLOUR[order.status]}18` : '#111', borderBottom: '1px solid #1a1a1a', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: STATUS_COLOUR[order.status] ?? '#A0A0A0', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {order.status === 'Out for Delivery' ? '🚗 Out for Delivery' : order.status === 'Arrived' ? '📍 Arrived at Customer' : order.status}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#555' }}>#{order.verification_code} · {timeAgo(order.created_at)}</span>
                  </div>

                  <div style={{ padding: '1rem' }}>
                    {/* Customer contact */}
                    <div style={{ background: 'rgba(245,195,0,0.06)', border: '1px solid rgba(245,195,0,0.15)', borderRadius: 10, padding: '0.875rem', marginBottom: '0.875rem' }}>
                      <div style={{ fontSize: '0.65rem', color: '#F5C300', fontWeight: 700, letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>Customer</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1rem' }}>👤</span>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{order.user_name}</span>
                        </div>
                        {order.customer_phone ? (
                          <a href={`tel:${order.customer_phone}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22C55E', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem' }}>
                            <span>📞</span>{order.customer_phone}
                            <span style={{ fontSize: '0.7rem', background: 'rgba(34,197,94,0.15)', border: '1px solid #22C55E', borderRadius: 4, padding: '0.1rem 0.4rem' }}>TAP TO CALL</span>
                          </a>
                        ) : (
                          <a href={`mailto:${order.user_email}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#60a5fa', textDecoration: 'none', fontSize: '0.85rem' }}>
                            <span>✉️</span>{order.user_email}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Delivery address */}
                    {order.delivery_address && (
                      <div style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 10, padding: '0.875rem', marginBottom: '0.875rem' }}>
                        <div style={{ fontSize: '0.65rem', color: '#60a5fa', fontWeight: 700, letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' }}>Delivery Address</div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ flexShrink: 0 }}>📍</span>
                          <span style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{order.delivery_address}</span>
                        </div>
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(order.delivery_address)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: '0.75rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}
                        >
                          🗺 Open in Google Maps →
                        </a>
                      </div>
                    )}

                    {/* Customer notes */}
                    {order.order_notes && (
                      <div style={{ background: 'rgba(245,195,0,0.05)', border: '1px solid rgba(245,195,0,0.2)', borderRadius: 10, padding: '0.75rem', marginBottom: '0.875rem' }}>
                        <div style={{ fontSize: '0.65rem', color: '#F5C300', fontWeight: 700, letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' }}>📝 Customer Note</div>
                        <p style={{ fontSize: '0.875rem', color: '#F5F5F5', margin: 0 }}>{order.order_notes}</p>
                      </div>
                    )}

                    {/* Items */}
                    <div style={{ fontSize: '0.8rem', color: '#A0A0A0', marginBottom: '0.875rem', background: '#161616', borderRadius: 8, padding: '0.625rem 0.875rem' }}>
                      {(order.items ?? []).map((item, i) => <div key={i}>• {item}</div>)}
                    </div>

                    {/* Total + action */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', color: '#F5C300' }}>
                          ₦{order.total_amount?.toLocaleString()}
                        </div>
                        {order.delivery_fee && (
                          <div style={{ fontSize: '0.72rem', color: '#555' }}>incl. ₦{order.delivery_fee.toLocaleString()} delivery fee</div>
                        )}
                      </div>

                      {/* Out for Delivery → Mark Arrived */}
                      {order.status === 'Out for Delivery' && (
                        <button
                          onClick={() => markArrived(order)}
                          disabled={updating === order.id}
                          style={{ padding: '0.65rem 1.25rem', borderRadius: 10, border: 'none', cursor: updating === order.id ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.85rem', opacity: updating === order.id ? 0.6 : 1, background: '#60a5fa', color: '#000' }}
                        >
                          {updating === order.id ? '…' : '📍 Mark as Arrived'}
                        </button>
                      )}

                      {/* Arrived → Confirm with code */}
                      {order.status === 'Arrived' && (
                        <button
                          onClick={() => openCodeModal(order)}
                          style={{ padding: '0.65rem 1.25rem', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', background: '#22C55E', color: '#fff' }}
                        >
                          🔐 Enter Code &amp; Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Delivered today */}
        {done.length > 0 && (
          <div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', color: '#555', marginBottom: '0.75rem' }}>
              Delivered Today ({done.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {done.map(order => (
                <div key={order.id} style={{ background: '#0C0C0C', border: '1px solid #111', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.5 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{order.user_name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#555', marginTop: 2 }}>{order.delivery_address?.slice(0, 45)}{order.delivery_address && order.delivery_address.length > 45 ? '…' : ''}</div>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#22C55E', fontSize: '1.1rem' }}>✓ Delivered</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Code Verification Modal */}
      {codeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#0F0F0F', border: '1px solid #262626', borderRadius: 20, padding: '2rem', maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔐</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: 2, marginBottom: 8 }}>Complete Delivery</div>
            <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginBottom: 20, lineHeight: 1.5 }}>
              Ask <strong style={{ color: '#F5F5F5' }}>{codeModal.user_name}</strong> for their order code (shown on their receipt) and enter it below.
            </p>
            <input
              type="text"
              value={codeInput}
              onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(''); }}
              placeholder="CUSTOMER CODE"
              maxLength={8}
              autoFocus
              style={{ width: '100%', background: '#161616', border: `1px solid ${codeError ? '#E8192C' : '#262626'}`, borderRadius: 10, padding: '0.875rem 1rem', color: '#F5C300', fontSize: '1.5rem', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 4, textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
            />
            {codeError && <p style={{ color: '#E8192C', fontSize: '0.78rem', marginBottom: 12 }}>{codeError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setCodeModal(null)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: 10, background: '#161616', border: '1px solid #262626', color: '#A0A0A0', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelivery}
                disabled={verifying || codeInput.trim().length < 3}
                style={{ flex: 1, padding: '0.75rem', borderRadius: 10, background: '#22C55E', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, opacity: verifying || codeInput.trim().length < 3 ? 0.6 : 1 }}
              >
                {verifying ? 'Confirming…' : 'Confirm ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
