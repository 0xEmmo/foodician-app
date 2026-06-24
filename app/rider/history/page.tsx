'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabase';
import { useAppStore } from '@/src/store/useAppStore';

type DeliveredOrder = {
  id: number;
  verification_code: string;
  user_name: string;
  user_email: string;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  items: string[];
  total_amount: number;
  delivery_fee: number | null;
  status: string;
  created_at: string;
  order_notes: string | null;
};

type Range = 'today' | '7days' | '30days' | 'all';

const RANGE_LABELS: Record<Range, string> = {
  today:  'Today',
  '7days':  'Last 7 Days',
  '30days': 'Last 30 Days',
  all:    'All Time',
};

function rangeStart(r: Range): Date | null {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (r === 'today')  return d;
  if (r === '7days')  { d.setDate(d.getDate() - 6); return d; }
  if (r === '30days') { d.setDate(d.getDate() - 29); return d; }
  return null; // all time
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

export default function RiderHistoryPage() {
  const router      = useRouter();
  const sessionUser = useAppStore(s => s.sessionUser);
  const [orders,   setOrders]   = useState<DeliveredOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [range,    setRange]    = useState<Range>('7days');
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('*')
      .eq('order_type', 'delivery')
      .eq('status', 'Delivered')
      .order('created_at', { ascending: false });

    const start = rangeStart(range);
    if (start) query = query.gte('created_at', start.toISOString());

    const { data } = await query;
    setOrders((data as DeliveredOrder[]) ?? []);
    setLoading(false);
  }, [range]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (!sessionUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: '#A0A0A0' }}>Sign in to view history.</p>
        <button onClick={() => router.push('/')} style={{ background: '#E8192C', color: '#fff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Go to App</button>
      </div>
    );
  }

  // Stats
  const totalDeliveries = orders.length;
  const totalValue      = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const totalFees       = orders.reduce((s, o) => s + (o.delivery_fee ?? 0), 0);

  // Group by calendar day
  const groups: Record<string, DeliveredOrder[]> = {};
  orders.forEach(o => {
    const key = formatDate(o.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  });

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#F5F5F5', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '0 1.25rem', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => router.push('/rider')}
            style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: 2, color: '#F5F5F5', lineHeight: 1 }}>DELIVERY HISTORY</div>
            <div style={{ fontSize: '0.65rem', color: '#A0A0A0', letterSpacing: 1 }}>Hey, {sessionUser.name}</div>
          </div>
        </div>
        <button
          onClick={fetchHistory}
          style={{ padding: '0.3rem 0.875rem', borderRadius: 6, background: '#161616', border: '1px solid #262626', color: '#A0A0A0', cursor: 'pointer', fontSize: '0.78rem' }}
        >
          ↻ Refresh
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.25rem 1rem' }}>

        {/* Range selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '0.4rem 0.875rem', borderRadius: 20, border: `1px solid ${range === r ? '#F5C300' : '#262626'}`,
                background: range === r ? 'rgba(245,195,0,0.12)' : '#0F0F0F',
                color: range === r ? '#F5C300' : '#666',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: range === r ? 700 : 400, transition: 'all 0.15s',
              }}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Stats bar */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: '1.5rem' }}>
            {[
              { label: 'Deliveries', value: String(totalDeliveries), color: '#60a5fa' },
              { label: 'Order Value', value: `₦${totalValue.toLocaleString()}`, color: '#22C55E' },
              { label: 'Delivery Fees', value: `₦${totalFees.toLocaleString()}`, color: '#F5C300' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#0A0A0A', border: '1px solid #1a1a1a', borderRadius: 12, padding: '0.875rem', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: '0.62rem', color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <div style={{ width: 32, height: 32, border: '2px solid #262626', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#A0A0A0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📦</div>
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#F5F5F5', marginBottom: 4 }}>No deliveries found</p>
            <p style={{ fontSize: '0.85rem' }}>No completed deliveries in this period.</p>
          </div>
        ) : (
          Object.entries(groups).map(([dateLabel, dayOrders]) => (
            <div key={dateLabel} style={{ marginBottom: '1.75rem' }}>
              {/* Day header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', color: '#A0A0A0', letterSpacing: 2 }}>{dateLabel.toUpperCase()}</div>
                <div style={{ flex: 1, height: 1, background: '#1a1a1a' }} />
                <div style={{ fontSize: '0.72rem', color: '#444' }}>{dayOrders.length} order{dayOrders.length !== 1 ? 's' : ''}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {dayOrders.map(order => {
                  const isOpen = expanded === order.id;
                  return (
                    <div
                      key={order.id}
                      style={{ background: '#0C0C0C', border: '1px solid #1a1a1a', borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.15s', cursor: 'pointer' }}
                      onClick={() => setExpanded(isOpen ? null : order.id)}
                    >
                      {/* Collapsed row */}
                      <div style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>
                          ✓
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#F5F5F5', marginBottom: 2 }}>{order.user_name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {order.delivery_address ?? order.user_email}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: '#22C55E' }}>₦{order.total_amount?.toLocaleString()}</div>
                          <div style={{ fontSize: '0.65rem', color: '#444' }}>{formatTime(order.created_at)}</div>
                        </div>
                        <div style={{ color: '#333', fontSize: '0.8rem', marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</div>
                      </div>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div style={{ borderTop: '1px solid #161616', padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                          {/* Order code + time */}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.7rem', background: 'rgba(245,195,0,0.1)', border: '1px solid rgba(245,195,0,0.25)', borderRadius: 6, padding: '0.2rem 0.6rem', color: '#F5C300', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 2 }}>
                              #{order.verification_code}
                            </span>
                            <span style={{ fontSize: '0.7rem', background: '#161616', border: '1px solid #262626', borderRadius: 6, padding: '0.2rem 0.6rem', color: '#666' }}>
                              {new Date(order.created_at).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Items */}
                          <div style={{ background: '#161616', borderRadius: 8, padding: '0.625rem 0.875rem' }}>
                            <div style={{ fontSize: '0.62rem', color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Items</div>
                            {(order.items ?? []).map((item, i) => (
                              <div key={i} style={{ fontSize: '0.82rem', color: '#A0A0A0', marginBottom: 2 }}>• {item}</div>
                            ))}
                          </div>

                          {/* Address + map */}
                          {order.delivery_address && (
                            <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 8, padding: '0.625rem 0.875rem' }}>
                              <div style={{ fontSize: '0.62rem', color: '#60a5fa', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Address</div>
                              <div style={{ fontSize: '0.82rem', color: '#A0A0A0', marginBottom: 8 }}>{order.delivery_address}</div>
                              <a
                                href={
                                  order.delivery_lat && order.delivery_lng
                                    ? `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`
                                    : `https://maps.google.com/?q=${encodeURIComponent(order.delivery_address)}`
                                }
                                target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{ fontSize: '0.72rem', color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}
                              >
                                🗺 Open in Maps →
                              </a>
                            </div>
                          )}

                          {/* Fee breakdown */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #161616', paddingTop: '0.625rem', fontSize: '0.8rem', color: '#666' }}>
                            <span>Delivery fee</span>
                            <span style={{ color: '#A0A0A0' }}>₦{(order.delivery_fee ?? 0).toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700 }}>
                            <span style={{ color: '#F5F5F5' }}>Order total</span>
                            <span style={{ color: '#22C55E', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem' }}>₦{order.total_amount?.toLocaleString()}</span>
                          </div>

                          {/* Customer contact */}
                          <div style={{ display: 'flex', gap: 8 }}>
                            {order.customer_phone && (
                              <a
                                href={`tel:${order.customer_phone}`}
                                onClick={e => e.stopPropagation()}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.5rem', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}
                              >
                                📞 {order.customer_phone}
                              </a>
                            )}
                            <a
                              href={`mailto:${order.user_email}`}
                              onClick={e => e.stopPropagation()}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0.5rem', borderRadius: 8, background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}
                            >
                              ✉ Email
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
