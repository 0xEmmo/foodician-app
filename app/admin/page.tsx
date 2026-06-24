'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/src/lib/supabase';
import { getAdminUnreadTotal } from '@/src/lib/chat';
import type { PromoCode } from '@/src/lib/promos';
import AdminSidebar, { COLLAPSED_W } from '@/src/components/AdminSidebar';
import { notifyTelegram } from '@/src/lib/notifyTelegram';

// ─── Types ────────────────────────────────────────────────────────────────────
type ShopHour = { id: string; day_of_week: number; open_time: string; close_time: string; is_closed: boolean };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Order = {
  id: number; user_name: string; verification_code: string;
  total_amount: number; status: 'Confirmed' | 'Ready' | 'Cancelled' | 'Completed';
  items: string[]; created_at: string; payment_method?: string;
};

type MenuItem = { id: number; name: string; desc: string; price: number; category: string; image_url: string; mins: number };
type User     = { id: string; email: string; name: string; wallet: number; total_spent: number; role: string; created_at: string };
type Analytics = { todayOrders: number; todayRevenue: number; popularItems: { name: string; count: number }[] };
type SalesData = { date: string; revenue: number }[];
type WeeklySalesData = { week: string; revenue: number }[];
type Rating   = { id: string; order_id: string; item_name: string; rating: number; comment: string | null; user_id: string; created_at: string };

type Tab = 'orders' | 'analytics' | 'products' | 'marketing' | 'messages' | 'customers' | 'reviews' | 'settings';


const inputStyle = { background: '#0F0F0F', border: '1px solid #262626', borderRadius: 8, padding: '0.75rem', color: '#fff', width: '100%', outline: 'none' };

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [activeTab,   setActiveTab]   = useState<Tab>('orders');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [updatingId,  setUpdatingId]  = useState<number | null>(null);
  const [menuItems,   setMenuItems]   = useState<MenuItem[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuForm,    setMenuForm]    = useState({ name: '', desc: '', price: 0, category: 'pasta', image_url: '', mins: 10 });
  const [users,       setUsers]       = useState<User[]>([]);
  const [analytics,   setAnalytics]   = useState<Analytics>({ todayOrders: 0, todayRevenue: 0, popularItems: [] });
  const [dailySales,  setDailySales]  = useState<SalesData>([]);
  const [weeklySales, setWeeklySales] = useState<WeeklySalesData>([]);
  const [salesView,   setSalesView]   = useState<'daily' | 'weekly'>('daily');
  const [isOpen,      setIsOpen]      = useState(true);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [shopHours,   setShopHours]   = useState<ShopHour[]>([]);
  const [savingHours, setSavingHours] = useState(false);
  const [promos,      setPromos]      = useState<PromoCode[]>([]);
  const [reviews,     setReviews]     = useState<Rating[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [promoForm,   setPromoForm]   = useState({ code: '', discount_type: 'fixed' as 'fixed' | 'percentage', discount_value: 0, min_order_amount: '', max_uses: '', expiry_date: '', description: '' });
  const [savingPromo, setSavingPromo] = useState(false);
  const [syncingImages,  setSyncingImages]  = useState(false);
  const [imageFile,      setImageFile]      = useState<File | null>(null);
  const [imagePreview,   setImagePreview]   = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deliveryPricing, setDeliveryPricing] = useState({ base_fee: 500, per_km_rate: 200, unilag_fee: 500, free_first_km: 1 });
  const [savingPricing,  setSavingPricing]  = useState(false);
  const [configRowId,    setConfigRowId]    = useState<string | null>(null);

  // ─── Fetch functions ───────────────────────────────────────────────────────
  const fetchRestaurantStatus = useCallback(async () => {
    try { const res = await fetch('/api/restaurant/status'); const d = await res.json(); setIsOpen(d.is_open); } catch {}
  }, []);

  const fetchShopHours = useCallback(async () => {
    const { data } = await supabase.from('shop_hours').select('*').order('day_of_week');
    if (data) setShopHours(data as ShopHour[]);
  }, []);

  const fetchUnread = useCallback(async () => {
    const n = await getAdminUnreadTotal(); setUnreadMessages(n);
  }, []);

  const fetchPromos = useCallback(async () => {
    try {
      const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
      if (data) setPromos(data as PromoCode[]);
    } catch {}
  }, []);

  const fetchReviews = useCallback(async () => {
    try {
      const { data } = await supabase.from('ratings').select('*').order('created_at', { ascending: false }).limit(50);
      if (data) setReviews(data as Rating[]);
    } catch {}
  }, []);

  const fetchDeliveryPricing = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('restaurant_config')
        .select('id, delivery_base_fee, delivery_per_km, unilag_fee, free_first_km')
        .maybeSingle();
      if (data) {
        setConfigRowId(data.id as string);
        setDeliveryPricing({
          base_fee:      (data.delivery_base_fee as number) ?? 500,
          per_km_rate:   (data.delivery_per_km   as number) ?? 200,
          unilag_fee:    (data.unilag_fee         as number) ?? 500,
          free_first_km: (data.free_first_km      as number) ?? 1,
        });
      }
    } catch {}
  }, []);

  const computeSalesData = useCallback((list: Order[]) => {
    const last7 = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return { date: d.toISOString().split('T')[0], revenue: 0 };
    }).reverse();
    const dm: Record<string, number> = {};
    list.forEach(o => { const k = new Date(o.created_at).toISOString().split('T')[0]; dm[k] = (dm[k] || 0) + o.total_amount; });
    setDailySales(last7.map(d => ({ date: d.date, revenue: dm[d.date] || 0 })));
    const wm: Record<string, number> = {};
    list.forEach(o => {
      const dt = new Date(o.created_at);
      const k = `${dt.getFullYear()}-W${Math.ceil((dt.getDate() + 6 - dt.getDay()) / 7)}`;
      wm[k] = (wm[k] || 0) + o.total_amount;
    });
    setWeeklySales(Object.entries(wm).map(([week, revenue]) => ({ week, revenue })).sort((a, b) => a.week.localeCompare(b.week)).slice(-6));
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders');
      if (!res.ok) return;
      const data = await res.json();
      const list: Order[] = Array.isArray(data) ? data : [];
      setOrders(list);
      computeSalesData(list);
      const now = new Date();
      const today = list.filter(o => { const d = new Date(o.created_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate(); });
      const ic: Record<string, number> = {};
      list.forEach(o => (o.items ?? []).forEach(item => { const b = item.replace(/\s*\(x\d+\)/, '').trim(); ic[b] = (ic[b] || 0) + 1; }));
      setAnalytics({ todayOrders: today.length, todayRevenue: today.reduce((s, o) => s + o.total_amount, 0), popularItems: Object.entries(ic).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5) });
    } catch {}
  }, [computeSalesData]);

  const fetchMenu  = useCallback(async () => { try { const res = await fetch('/api/admin/menu');  if (!res.ok) return; const d = await res.json(); setMenuItems(Array.isArray(d) ? d : []); } catch {} }, []);
  const fetchUsers = useCallback(async () => { try { const res = await fetch('/api/admin/users'); if (!res.ok) return; const d = await res.json(); setUsers(Array.isArray(d) ? d : []); } catch {} }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchOrders(), fetchMenu(), fetchUsers(),
        fetchRestaurantStatus(), fetchShopHours(), fetchUnread(), fetchPromos(), fetchReviews(),
        fetchDeliveryPricing(),
      ]);
    };
    init()
      .then(() => setLoading(false))
      .catch(() => setError('Failed to load dashboard.'));
  }, [fetchOrders, fetchMenu, fetchUsers, fetchRestaurantStatus, fetchShopHours, fetchUnread, fetchPromos, fetchReviews, fetchDeliveryPricing]);

  useEffect(() => { const i = setInterval(fetchOrders, 15000); return () => clearInterval(i); }, [fetchOrders]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  const toggleRestaurant = async () => {
    const next = !isOpen;
    const res = await fetch('/api/restaurant/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_open: next }) });
    if (res.ok) setIsOpen(next);
  };

  const updateOrderStatus = async (id: number, status: Order['status']) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/admin/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      if (!res.ok) throw new Error();
      if (status === 'Cancelled') {
        const order = orders.find(o => o.id === id);
        if (order?.payment_method === 'wallet') {
          const r = await fetch('/api/admin/refund', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: id }) });
          if (!r.ok) alert('Refund failed');
        }
      }
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));

      const statusMap: Record<string, 'ready' | 'completed' | 'cancelled'> = {
        Ready:     'ready',
        Completed: 'completed',
        Cancelled: 'cancelled',
      };
      const telegramStatus = statusMap[status];
      if (telegramStatus) {
        const order = orders.find(o => o.id === id);
        if (order) {
          notifyTelegram({
            status:       telegramStatus,
            customerName: order.user_name,
            items:        Array.isArray(order.items) ? order.items as string[] : [],
            total:        order.total_amount,
          });
        }
      }
    } catch { alert('Update failed'); }
    finally { setUpdatingId(null); }
  };

  const saveMenuItem = async () => {
    let finalImageUrl = menuForm.image_url;
    if (imageFile) {
      setUploadingImage(true);
      const ext      = imageFile.name.split('.').pop() ?? 'jpg';
      const fileName = `${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('menu-images').upload(fileName, imageFile, { upsert: true });
      if (upErr) { alert('Image upload failed: ' + upErr.message); setUploadingImage(false); return; }
      const { data: { publicUrl } } = supabase.storage.from('menu-images').getPublicUrl(fileName);
      finalImageUrl = publicUrl;
      setUploadingImage(false);
    }
    const method = editingItem ? 'PUT' : 'POST';
    const body   = editingItem
      ? { id: editingItem.id, ...menuForm, image_url: finalImageUrl }
      : { ...menuForm, image_url: finalImageUrl };
    const res = await fetch('/api/admin/menu', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      fetchMenu();
      setEditingItem(null);
      setMenuForm({ name: '', desc: '', price: 0, category: 'pasta', image_url: '', mins: 10 });
      setImageFile(null);
      setImagePreview('');
    }
  };

  const saveDeliveryPricing = async () => {
    setSavingPricing(true);
    const payload = {
      delivery_base_fee: deliveryPricing.base_fee,
      delivery_per_km:   deliveryPricing.per_km_rate,
      unilag_fee:        deliveryPricing.unilag_fee,
      free_first_km:     deliveryPricing.free_first_km,
      updated_at:        new Date().toISOString(),
    };
    if (configRowId) {
      await supabase.from('restaurant_config').update(payload).eq('id', configRowId);
    } else {
      await supabase.from('restaurant_config').insert(payload);
    }
    setSavingPricing(false);
    alert('Delivery pricing saved!');
  };

  const deleteMenuItem = async (id: number) => {
    if (!confirm('Delete this item?')) return;
    const res = await fetch('/api/admin/menu', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (res.ok) fetchMenu();
  };

  const editItem = (item: MenuItem) => { setEditingItem(item); setMenuForm({ name: item.name, desc: item.desc, price: item.price, category: item.category, image_url: item.image_url, mins: item.mins }); };

  const saveHourRow = async (row: ShopHour) => {
    setSavingHours(true);
    await supabase.from('shop_hours').update({ open_time: row.open_time, close_time: row.close_time, is_closed: row.is_closed }).eq('id', row.id);
    setSavingHours(false);
  };
  const updateHourRow = (id: string, patch: Partial<ShopHour>) => setShopHours(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const seedShopHours = async () => {
    const rows = [0,1,2,3,4,5,6].map(day_of_week => ({ day_of_week, open_time: '09:00', close_time: '21:00', is_closed: false }));
    const { error: e } = await supabase.from('shop_hours').insert(rows);
    if (e) { alert(e.message.includes('does not exist') ? 'Run the SQL migration in Supabase first.' : e.message); }
    else fetchShopHours();
  };

  const createPromo = async () => {
    if (!promoForm.code) return;
    setSavingPromo(true);
    const { error: e } = await supabase.from('promo_codes').insert({
      code: promoForm.code.toUpperCase().trim(),
      discount_type: promoForm.discount_type,
      discount_value: promoForm.discount_value,
      min_order_amount: promoForm.min_order_amount ? parseFloat(promoForm.min_order_amount) : null,
      max_uses: promoForm.max_uses ? parseInt(promoForm.max_uses) : null,
      expiry_date: promoForm.expiry_date || null,
      description: promoForm.description || null,
      is_active: true,
      current_uses: 0,
    });
    setSavingPromo(false);
    if (e) { alert(e.message); return; }
    setPromoForm({ code: '', discount_type: 'fixed', discount_value: 0, min_order_amount: '', max_uses: '', expiry_date: '', description: '' });
    fetchPromos();
  };

  const togglePromo = async (id: string, current: boolean) => {
    await supabase.from('promo_codes').update({ is_active: !current }).eq('id', id);
    setPromos(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p));
  };

  const changeUserRole = async (user: User, newRole: string) => {
    if (newRole === user.role) return;
    if (!confirm(`Change ${user.name || user.email} to "${newRole}"?`)) return;
    const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, role: newRole }) });
    if (!res.ok) { alert('Failed to update role'); return; }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
  };

  // ─── Loading / Error ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 36, height: 36, border: '2px solid #262626', borderTopColor: '#E8192C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#A0A0A0', fontSize: '0.8rem', letterSpacing: 3 }}>LOADING ADMIN</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050505', gap: 16 }}>
      <p style={{ color: '#E8192C' }}>⚠️ {error}</p>
      <button onClick={() => window.location.reload()} style={{ background: '#E8192C', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: 8, cursor: 'pointer' }}>Retry</button>
    </div>
  );

  // ─── Filtered orders ────────────────────────────────────────────────────────
  const pendingStatuses = new Set(['Confirmed', 'Ready']);
  const displayOrders = orders.filter(o =>
    orderFilter === 'all' ? true :
    orderFilter === 'pending' ? pendingStatuses.has(o.status) :
    o.status === 'Completed' || o.status === 'Cancelled'
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#F5F5F5', fontFamily: "'DM Sans', sans-serif", display: 'flex' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadMessages={unreadMessages}
        isOpen={isOpen}
        onToggleRestaurant={toggleRestaurant}
        onNavigate={(path) => router.push(path)}
      />

      {/* ── Main content (offset by collapsed sidebar width on desktop) ──────── */}
      <div style={{ flex: 1, minWidth: 0, marginLeft: COLLAPSED_W, transition: 'margin-left 0.2s ease' }}>

        {/* Mobile top bar — just shows current section title */}
        <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', height: 54, display: 'flex', alignItems: 'center', paddingLeft: 60, paddingRight: '1rem', gap: 12 }} className="md:hidden">
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', letterSpacing: 2, color: '#E8192C' }}>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </span>
        </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem 1.5rem' }}>

        {/* ORDERS */}
        {activeTab === 'orders' && (
          <>
            {/* Header + filter pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', color: '#F5C300', margin: 0 }}>
                Orders
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#A0A0A0' }}>{orders.length} total · {orders.filter(o => pendingStatuses.has(o.status)).length} awaiting action</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {(['all', 'pending', 'completed'] as const).map(f => (
                  <button key={f} onClick={() => setOrderFilter(f)} style={{ padding: '0.3rem 0.875rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', background: orderFilter === f ? '#E8192C' : '#161616', border: `1px solid ${orderFilter === f ? '#E8192C' : '#262626'}`, color: orderFilter === f ? '#fff' : '#A0A0A0' }}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}{' '}
                    {f === 'all' ? orders.length : f === 'pending' ? orders.filter(o => pendingStatuses.has(o.status)).length : orders.filter(o => o.status === 'Completed' || o.status === 'Cancelled').length}
                  </button>
                ))}
              </div>
            </div>

            {displayOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem', color: '#A0A0A0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📭</div>
                No orders in this view.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.875rem' }}>
                {displayOrders.map(order => {
                  const statusColor = order.status === 'Ready' ? '#22C55E' : order.status === 'Cancelled' ? '#ef4444' : order.status === 'Completed' ? '#888' : '#F5C300';
                  const statusBg    = order.status === 'Ready' ? 'rgba(34,197,94,0.1)' : order.status === 'Cancelled' ? 'rgba(239,68,68,0.1)' : order.status === 'Completed' ? 'rgba(255,255,255,0.04)' : 'rgba(245,195,0,0.1)';
                  return (
                    <div key={order.id} style={{ background: '#0C0C0C', border: '1px solid #1a1a1a', borderRadius: 14, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Row 1: status + code + time */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 20, background: statusBg, color: statusColor }}>
                          {order.status}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#555', fontFamily: 'monospace' }}>
                          #{order.verification_code}
                        </span>
                        {order.payment_method && (
                          <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: 4, background: 'rgba(245,195,0,0.08)', color: '#F5C300', border: '1px solid rgba(245,195,0,0.15)', marginLeft: 'auto' }}>
                            {order.payment_method.toUpperCase()}
                          </span>
                        )}
                      </div>
                      {/* Row 2: customer + amount */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#F5F5F5' }}>{order.user_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>
                            {order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? 's' : ''} · {timeAgo(order.created_at)}
                          </div>
                        </div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', color: '#F5C300', lineHeight: 1, textAlign: 'right' }}>
                          ₦{order.total_amount?.toLocaleString()}
                        </div>
                      </div>
                      {/* Row 3: items */}
                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: '#888', lineHeight: 1.7 }}>
                        {(order.items ?? []).map((item, i) => <div key={i}>{item}</div>)}
                      </div>
                      {/* Row 4: actions */}
                      <div style={{ display: 'flex', gap: 6 }}>
                        {order.status !== 'Ready' && order.status !== 'Cancelled' && order.status !== 'Completed' && (
                          <button onClick={() => updateOrderStatus(order.id, 'Ready')} disabled={updatingId === order.id}
                            style={{ flex: 1, padding: '0.45rem', background: 'rgba(34,197,94,0.08)', border: '1px solid #22C55E', borderRadius: 8, color: '#22C55E', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                            ✅ Ready
                          </button>
                        )}
                        {order.status === 'Ready' && (
                          <button onClick={() => updateOrderStatus(order.id, 'Completed')} disabled={updatingId === order.id}
                            style={{ flex: 1, padding: '0.45rem', background: 'rgba(96,165,250,0.08)', border: '1px solid #60a5fa', borderRadius: 8, color: '#60a5fa', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                            ✔ Collected
                          </button>
                        )}
                        {order.status !== 'Cancelled' && order.status !== 'Completed' && (
                          <button onClick={() => updateOrderStatus(order.id, 'Cancelled')} disabled={updatingId === order.id}
                            style={{ padding: '0.45rem 0.75rem', background: 'transparent', border: '1px solid #262626', borderRadius: 8, color: '#555', cursor: 'pointer', fontSize: '0.8rem' }}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ANALYTICS */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', color: '#F5C300', margin: 0 }}>Analytics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {[{ label: "Today's Orders", value: analytics.todayOrders, fmt: (v: number) => v.toString() },
                { label: "Today's Revenue", value: analytics.todayRevenue, fmt: (v: number) => `₦${v.toLocaleString()}` }].map(({ label, value, fmt }) => (
                <div key={label} style={{ background: '#0C0C0C', border: '1px solid #1a1a1a', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#A0A0A0', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.75rem', color: '#F5C300', lineHeight: 1 }}>{fmt(value)}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#0C0C0C', border: '1px solid #1a1a1a', borderRadius: 12, padding: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', color: '#F5C300', marginBottom: '1rem' }}>🔥 Top Items</h3>
              {analytics.popularItems.length === 0 ? <p style={{ color: '#A0A0A0', textAlign: 'center' }}>No data yet</p> : analytics.popularItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', padding: '0.5rem 0' }}>
                  <span>{item.name}</span><span style={{ color: '#F5C300' }}>{item.count} orders</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#0C0C0C', border: '1px solid #1a1a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', color: '#F5C300', margin: 0 }}>📈 Sales Trends</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['daily', 'weekly'] as const).map(v => (
                    <button key={v} onClick={() => setSalesView(v)} style={{ padding: '0.3rem 0.8rem', borderRadius: 6, background: salesView === v ? '#E8192C' : '#161616', border: '1px solid #262626', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>{v.charAt(0).toUpperCase() + v.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div style={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                  {salesView === 'daily'
                    ? <LineChart data={dailySales}><CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" /><XAxis dataKey="date" stroke="#555" /><YAxis stroke="#555" /><Tooltip contentStyle={{ backgroundColor: '#0C0C0C', borderColor: '#262626', color: '#fff' }} /><Legend /><Line type="monotone" dataKey="revenue" stroke="#F5C300" name="Revenue (₦)" strokeWidth={2} /></LineChart>
                    : <BarChart data={weeklySales}><CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" /><XAxis dataKey="week" stroke="#555" /><YAxis stroke="#555" /><Tooltip contentStyle={{ backgroundColor: '#0C0C0C', borderColor: '#262626', color: '#fff' }} /><Legend /><Bar dataKey="revenue" fill="#F5C300" name="Revenue (₦)" /></BarChart>
                  }
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {activeTab === 'products' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', color: '#F5C300', margin: 0 }}>Products</h2>
              <button
                onClick={async () => {
                  setSyncingImages(true);
                  const res = await fetch('/api/admin/sync-images', { method: 'POST' });
                  const d = await res.json();
                  setSyncingImages(false);
                  if (!res.ok) { alert('Sync failed: ' + d.error); return; }
                  alert(`Done! Updated ${d.updated.length} item${d.updated.length !== 1 ? 's' : ''}${d.skipped.length ? `\nUnmatched: ${d.skipped.join(', ')}` : ''}`);
                  fetchMenu();
                }}
                disabled={syncingImages}
                style={{ marginLeft: 'auto', background: syncingImages ? '#262626' : 'rgba(245,195,0,0.1)', border: '1px solid rgba(245,195,0,0.3)', color: '#F5C300', padding: '0.4rem 1rem', borderRadius: 8, cursor: syncingImages ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.82rem', opacity: syncingImages ? 0.6 : 1 }}
              >
                {syncingImages ? 'Syncing…' : '🖼 Sync Images from Public'}
              </button>
            </div>
            <div style={{ background: '#0C0C0C', border: '1px solid #1a1a1a', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', color: '#F5C300', marginBottom: '0.875rem' }}>{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {(['name', 'desc'] as const).map((key) => (
                  <input key={key} type="text" placeholder={key === 'name' ? 'Dish Name' : 'Description'}
                    value={menuForm[key]} onChange={e => setMenuForm({ ...menuForm, [key]: e.target.value })} style={inputStyle} />
                ))}
                <input type="number" placeholder="Price (₦)" value={menuForm.price || ''} onChange={e => setMenuForm({ ...menuForm, price: parseInt(e.target.value) || 0 })} style={inputStyle} />
                <input type="number" placeholder="Prep time (mins)" value={menuForm.mins || ''} onChange={e => setMenuForm({ ...menuForm, mins: parseInt(e.target.value) || 0 })} style={inputStyle} />
                <select value={menuForm.category} onChange={e => setMenuForm({ ...menuForm, category: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="pasta">Spaghetti</option>
                  <option value="noodles">Indomie</option>
                  <option value="protein">Proteins</option>
                  <option value="sides">Sides</option>
                </select>
                {/* ── Photo upload ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '0.72rem', color: '#A0A0A0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Dish Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setImageFile(file);
                      setImagePreview(URL.createObjectURL(file));
                    }}
                    style={{ ...inputStyle, cursor: 'pointer', fontSize: '0.8rem' }}
                  />
                  {(imagePreview || menuForm.image_url) && (
                    <img src={imagePreview || menuForm.image_url} alt="preview"
                      style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #262626', marginTop: 2 }} />
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: '1rem', alignItems: 'center' }}>
                <button onClick={saveMenuItem} disabled={uploadingImage}
                  style={{ background: uploadingImage ? '#262626' : '#E8192C', color: '#fff', border: 'none', padding: '0.625rem 1.5rem', borderRadius: 8, cursor: uploadingImage ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: uploadingImage ? 0.6 : 1 }}>
                  {uploadingImage ? 'Uploading…' : editingItem ? 'Update' : 'Create'}
                </button>
                {editingItem && <button onClick={() => { setEditingItem(null); setMenuForm({ name: '', desc: '', price: 0, category: 'pasta', image_url: '', mins: 10 }); setImageFile(null); setImagePreview(''); }} style={{ background: '#161616', color: '#A0A0A0', border: '1px solid #262626', padding: '0.625rem 1.25rem', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>}
              </div>
            </div>
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', color: '#F5C300', marginBottom: '0.75rem' }}>Existing Items ({menuItems.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.625rem' }}>
              {menuItems.map(item => (
                <div key={item.id} style={{ background: '#0C0C0C', border: '1px solid #1a1a1a', borderRadius: 10, padding: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>₦{item.price.toLocaleString()} · {item.category} · {item.mins}m</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => editItem(item)} style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Edit</button>
                    <button onClick={() => deleteMenuItem(item.id)} style={{ color: '#E8192C', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* MARKETING */}
        {activeTab === 'marketing' && (
          <>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', color: '#F5C300', marginBottom: '1.25rem' }}>Marketing & Promo Codes</h2>

            {/* Create form */}
            <div style={{ background: '#0C0C0C', border: '1px solid #1a1a1a', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', color: '#F5C300', marginBottom: '0.875rem' }}>Create Promo Code</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                <input
                  type="text" placeholder="Code (e.g. SAVE500)" value={promoForm.code}
                  onChange={e => setPromoForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: 2 }}
                />
                <select value={promoForm.discount_type} onChange={e => setPromoForm(f => ({ ...f, discount_type: e.target.value as 'fixed' | 'percentage' }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="fixed">₦ Fixed Amount Off</option>
                  <option value="percentage">% Percentage Off</option>
                </select>
                <input
                  type="number" placeholder={promoForm.discount_type === 'percentage' ? 'Discount %' : 'Discount ₦'} value={promoForm.discount_value || ''}
                  onChange={e => setPromoForm(f => ({ ...f, discount_value: parseFloat(e.target.value) || 0 }))}
                  style={inputStyle}
                />
                <input
                  type="number" placeholder="Min order ₦ (optional)" value={promoForm.min_order_amount}
                  onChange={e => setPromoForm(f => ({ ...f, min_order_amount: e.target.value }))}
                  style={inputStyle}
                />
                <input
                  type="number" placeholder="Max uses (optional)" value={promoForm.max_uses}
                  onChange={e => setPromoForm(f => ({ ...f, max_uses: e.target.value }))}
                  style={inputStyle}
                />
                <input
                  type="date" placeholder="Expiry date (optional)" value={promoForm.expiry_date}
                  onChange={e => setPromoForm(f => ({ ...f, expiry_date: e.target.value }))}
                  style={inputStyle}
                />
                <input
                  type="text" placeholder="Description (optional)" value={promoForm.description}
                  onChange={e => setPromoForm(f => ({ ...f, description: e.target.value }))}
                  style={{ ...inputStyle, gridColumn: 'span 2' }}
                />
              </div>
              <button
                onClick={createPromo} disabled={savingPromo || !promoForm.code || promoForm.discount_value <= 0}
                style={{ marginTop: '1rem', background: promoForm.code && promoForm.discount_value > 0 ? '#E8192C' : '#262626', color: '#fff', border: 'none', padding: '0.625rem 1.5rem', borderRadius: 8, cursor: promoForm.code ? 'pointer' : 'not-allowed', fontWeight: 600, opacity: savingPromo ? 0.6 : 1 }}
              >
                {savingPromo ? 'Creating…' : '+ Create Promo Code'}
              </button>
            </div>

            {/* Promo list */}
            {promos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#A0A0A0' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏷️</div>
                <p>No promo codes yet — create one above.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.875rem' }}>
                {promos.map(p => (
                  <div key={p.id} style={{ background: '#0C0C0C', border: `1px solid ${p.is_active ? '#1a1a1a' : '#111'}`, borderRadius: 12, padding: '1rem', opacity: p.is_active ? 1 : 0.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', letterSpacing: 2, color: '#F5C300' }}>{p.code}</span>
                      <button
                        onClick={() => togglePromo(p.id, p.is_active)}
                        style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: p.is_active ? '#22C55E' : '#262626', position: 'relative', transition: 'background 0.2s' }}
                      >
                        <span style={{ position: 'absolute', top: 2, left: p.is_active ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                      </button>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#A0A0A0' }}>
                      {p.discount_type === 'percentage' ? `${p.discount_value}% off` : `₦${p.discount_value.toLocaleString()} off`}
                      {p.min_order_amount ? ` · min ₦${p.min_order_amount.toLocaleString()}` : ''}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#555', marginTop: 4 }}>
                      Used: {p.current_uses}{p.max_uses ? ` / ${p.max_uses}` : ''} times
                      {p.expiry_date ? ` · expires ${new Date(p.expiry_date).toLocaleDateString()}` : ''}
                    </div>
                    {p.description && <div style={{ fontSize: '0.75rem', color: '#444', marginTop: 6 }}>{p.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* CUSTOMERS */}
        {activeTab === 'customers' && (
          <>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', color: '#F5C300', marginBottom: '1rem' }}>Customers ({users.length})</h2>
            {users.length === 0
              ? <div style={{ textAlign: 'center', padding: '4rem', color: '#A0A0A0' }}>No customers yet.</div>
              : <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1a1a1a', color: '#555' }}>
                        {['Name', 'Email', 'Total Spent', 'Wallet', 'Joined', 'Role'].map(h => <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 600 }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #111' }}>
                          <td style={{ padding: '0.75rem 0.875rem', fontWeight: 600 }}>{u.name}</td>
                          <td style={{ padding: '0.75rem 0.875rem', color: '#A0A0A0' }}>{u.email}</td>
                          <td style={{ padding: '0.75rem 0.875rem', color: '#F5C300' }}>₦{(u.total_spent ?? 0).toLocaleString()}</td>
                          <td style={{ padding: '0.75rem 0.875rem', color: '#F5C300' }}>₦{u.wallet?.toLocaleString()}</td>
                          <td style={{ padding: '0.75rem 0.875rem', color: '#555', fontSize: '0.75rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td style={{ padding: '0.75rem 0.875rem' }}>
                            <select
                              value={u.role || 'user'}
                              onChange={e => changeUserRole(u, e.target.value)}
                              style={{
                                background: '#161616', border: '1px solid #262626', borderRadius: 6,
                                padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', outline: 'none',
                                color: u.role === 'admin' ? '#F5C300' : u.role === 'kitchen' ? '#FB923C' : u.role === 'rider' ? '#60a5fa' : '#A0A0A0',
                              }}
                            >
                              <option value="user">Customer</option>
                              <option value="kitchen">Kitchen Staff</option>
                              <option value="rider">Rider</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </>
        )}

        {/* REVIEWS */}
        {activeTab === 'reviews' && (
          <>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', color: '#F5C300', marginBottom: '1.25rem' }}>Customer Reviews ({reviews.length})</h2>
            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#A0A0A0' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>⭐</div>
                <p>No reviews yet.</p>
                <p style={{ fontSize: '0.8rem', color: '#555', marginTop: 4 }}>Reviews appear here when customers rate their orders.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
                {reviews.map(r => (
                  <div key={r.id} style={{ background: '#0C0C0C', border: '1px solid #1a1a1a', borderRadius: 12, padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#F5F5F5' }}>{r.item_name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#555', marginTop: 2 }}>Order #{r.order_id?.toString().slice(0, 8)}</div>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#555', flexShrink: 0 }}>{timeAgo(r.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
                      {[1,2,3,4,5].map(star => (
                        <span key={star} style={{ fontSize: '1rem', color: star <= r.rating ? '#F5C300' : '#2a2a2a' }}>★</span>
                      ))}
                      <span style={{ fontSize: '0.78rem', color: '#A0A0A0', marginLeft: 6 }}>{r.rating}/5</span>
                    </div>
                    {r.comment && <p style={{ fontSize: '0.8rem', color: '#A0A0A0', margin: 0, fontStyle: 'italic' }}>&ldquo;{r.comment}&rdquo;</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <div style={{ maxWidth: 640 }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', color: '#F5C300', marginBottom: '0.5rem' }}>Shop Hours</h2>
            <p style={{ fontSize: '0.8rem', color: '#A0A0A0', marginBottom: '1.25rem' }}>
              Set when Foodician auto-opens and closes. Toggle off to keep the shop closed that day regardless of time.
            </p>
            {shopHours.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#A0A0A0' }}>
                <p style={{ marginBottom: '1rem' }}>No hours configured yet.</p>
                <button onClick={seedShopHours} style={{ background: '#E8192C', color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                  Initialise Default Hours
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {shopHours.map(row => (
                  <div key={row.id} style={{ background: '#0C0C0C', border: `1px solid ${!row.is_closed ? '#1a1a1a' : '#111'}`, borderRadius: 10, padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.875rem', opacity: row.is_closed ? 0.5 : 1 }}>
                    <button onClick={() => updateHourRow(row.id, { is_closed: !row.is_closed })} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, background: !row.is_closed ? '#22C55E' : '#262626', position: 'relative', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: 2, left: !row.is_closed ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </button>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: '#F5F5F5', width: 32, flexShrink: 0 }}>{DAY_NAMES[row.day_of_week]}</span>
                    <input type="time" value={row.open_time} onChange={e => updateHourRow(row.id, { open_time: e.target.value })} disabled={row.is_closed} style={{ ...inputStyle, width: 'auto', flex: 1, fontSize: '0.85rem' }} />
                    <span style={{ color: '#555', fontSize: '0.8rem', flexShrink: 0 }}>to</span>
                    <input type="time" value={row.close_time} onChange={e => updateHourRow(row.id, { close_time: e.target.value })} disabled={row.is_closed} style={{ ...inputStyle, width: 'auto', flex: 1, fontSize: '0.85rem' }} />
                    <button onClick={() => saveHourRow(row)} disabled={savingHours} style={{ background: '#E8192C', color: '#fff', border: 'none', borderRadius: 6, padding: '0.375rem 0.875rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, flexShrink: 0, opacity: savingHours ? 0.6 : 1 }}>Save</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Delivery Pricing ── */}
            <div style={{ marginTop: '2.5rem' }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', color: '#F5C300', marginBottom: '0.25rem' }}>Delivery Pricing</h2>
              <p style={{ fontSize: '0.8rem', color: '#A0A0A0', marginBottom: '1.25rem' }}>
                Changes take effect immediately for all new orders.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {([
                  ['Base Delivery Fee (₦)', 'base_fee'],
                  ['Per KM Rate (₦/km)', 'per_km_rate'],
                  ['UNILAG Flat Fee (₦)', 'unilag_fee'],
                  ['Free First KM', 'free_first_km'],
                ] as [string, keyof typeof deliveryPricing][]).map(([label, key]) => (
                  <div key={key}>
                    <label style={{ fontSize: '0.72rem', color: '#A0A0A0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>{label}</label>
                    <input
                      type="number"
                      value={deliveryPricing[key]}
                      onChange={e => setDeliveryPricing({ ...deliveryPricing, [key]: Number(e.target.value) })}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#0C0C0C', borderRadius: 8, fontSize: '0.8rem', color: '#A0A0A0', border: '1px solid #1a1a1a', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <span>3 km → <strong style={{ color: '#F5F5F5' }}>₦{Math.ceil(deliveryPricing.base_fee + Math.max(0, 3 - deliveryPricing.free_first_km) * deliveryPricing.per_km_rate).toLocaleString()}</strong></span>
                <span>5 km → <strong style={{ color: '#F5F5F5' }}>₦{Math.ceil(deliveryPricing.base_fee + Math.max(0, 5 - deliveryPricing.free_first_km) * deliveryPricing.per_km_rate).toLocaleString()}</strong></span>
                <span>10 km → <strong style={{ color: '#F5F5F5' }}>₦{Math.ceil(deliveryPricing.base_fee + Math.max(0, 10 - deliveryPricing.free_first_km) * deliveryPricing.per_km_rate).toLocaleString()}</strong></span>
                <span>UNILAG → <strong style={{ color: '#F5F5F5' }}>₦{deliveryPricing.unilag_fee.toLocaleString()}</strong></span>
              </div>
              <button
                onClick={saveDeliveryPricing}
                disabled={savingPricing}
                style={{ marginTop: '1rem', background: savingPricing ? '#262626' : '#E8192C', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: 8, cursor: savingPricing ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem', opacity: savingPricing ? 0.6 : 1 }}
              >
                {savingPricing ? 'Saving…' : 'Save Pricing'}
              </button>
            </div>

          </div>
        )}

      </div>
      </div>{/* end main content wrapper */}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
