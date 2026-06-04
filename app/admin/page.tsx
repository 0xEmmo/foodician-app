'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer
} from 'recharts';

type Order = {
  id: number;
  user_name: string;
  verification_code: string;
  total_amount: number;
  status: 'Confirmed' | 'Ready' | 'Cancelled' | 'Completed';
  items: string[];
  created_at: string;
  payment_method?: string;  // added for refunds
};

type MenuItem = {
  id: number;
  name: string;
  desc: string;
  price: number;
  category: string;
  image_url: string;
  mins: number;
};

// ✅ Updated User type with total_spent
type User = {
  id: string;
  email: string;
  name: string;
  wallet: number;
  total_spent: number;      // new field
  created_at: string;
};

type Analytics = {
  todayOrders: number;
  todayRevenue: number;
  popularItems: { name: string; count: number }[];
};

type SalesData = {
  date: string;
  revenue: number;
}[];

type WeeklySalesData = {
  week: string;
  revenue: number;
}[];

const inputStyle = {
  background: '#161616',
  border: '1px solid #262626',
  borderRadius: 8,
  padding: '0.75rem',
  color: '#fff',
  width: '100%',
  outline: 'none',
};

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'orders' | 'analytics' | 'menu' | 'customers'>('orders');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState({
    name: '',
    desc: '',
    price: 0,
    category: 'pasta',
    image_url: '',
    mins: 10,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    todayOrders: 0,
    todayRevenue: 0,
    popularItems: [],
  });
  const [dailySales, setDailySales] = useState<SalesData>([]);
  const [weeklySales, setWeeklySales] = useState<WeeklySalesData>([]);
  const [salesView, setSalesView] = useState<'daily' | 'weekly'>('daily');
  const [isOpen, setIsOpen] = useState(true); // restaurant status

  // ─── Fetch restaurant status ──────────────────────────────────────────────
  const fetchRestaurantStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/restaurant/status');
      const data = await res.json();
      setIsOpen(data.is_open);
    } catch (err) {
      console.error('Failed to fetch restaurant status', err);
    }
  }, []);

  const toggleRestaurant = async () => {
    const newStatus = !isOpen;
    try {
      const res = await fetch('/api/restaurant/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_open: newStatus }),
      });
      if (res.ok) {
        setIsOpen(newStatus);
        alert(`Restaurant is now ${newStatus ? 'OPEN' : 'CLOSED'}`);
      } else {
        alert('Failed to update status');
      }
    } catch (err) {
      console.error('Toggle error', err);
    }
  };

  // ─── Compute sales data from orders ─────────────────────────────────────────
  const computeSalesData = useCallback((ordersList: Order[]) => {
    // Daily (last 7 days)
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      return { date: dateStr, revenue: 0 };
    }).reverse();

    const dailyMap: Record<string, number> = {};
    ordersList.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      dailyMap[date] = (dailyMap[date] || 0) + order.total_amount;
    });
    const daily = last7Days.map(day => ({
      date: day.date,
      revenue: dailyMap[day.date] || 0,
    }));
    setDailySales(daily);

    // Weekly (last 6 weeks)
    const weeklyMap: Record<string, number> = {};
    ordersList.forEach(order => {
      const date = new Date(order.created_at);
      const year = date.getFullYear();
      const weekNum = Math.ceil((date.getDate() + 6 - date.getDay()) / 7);
      const weekKey = `${year}-W${weekNum}`;
      weeklyMap[weekKey] = (weeklyMap[weekKey] || 0) + order.total_amount;
    });
    const weekly = Object.entries(weeklyMap)
      .map(([week, revenue]) => ({ week, revenue }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-6);
    setWeeklySales(weekly);
  }, []);

  // ─── Fetch functions ──────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders');
      if (!res.ok) {
        console.error('Orders fetch failed:', res.status);
        return;
      }
      const data = await res.json();
      const ordersArr = Array.isArray(data) ? data : [];
      setOrders(ordersArr);
      computeSalesData(ordersArr);

      // Compute basic analytics
      const now = new Date();
      const todayList = ordersArr.filter((o: Order) => {
        const orderDate = new Date(o.created_at);
        return (
          orderDate.getFullYear() === now.getFullYear() &&
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getDate() === now.getDate()
        );
      });

      const itemCount: Record<string, number> = {};
      ordersArr.forEach((order: Order) => {
        (order.items ?? []).forEach((item: string) => {
          const base = item.replace(/\s*\(x\d+\)/, '').trim();
          itemCount[base] = (itemCount[base] || 0) + 1;
        });
      });

      setAnalytics({
        todayOrders: todayList.length,
        todayRevenue: todayList.reduce((s: number, o: Order) => s + o.total_amount, 0),
        popularItems: Object.entries(itemCount)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      });
    } catch (err) {
      console.error('fetchOrders error:', err);
    }
  }, [computeSalesData]);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/menu');
      if (!res.ok) return;
      const data = await res.json();
      setMenuItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('fetchMenu error:', err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) return;
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('fetchUsers error:', err);
    }
  }, []);

  // ─── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        await Promise.all([fetchOrders(), fetchMenu(), fetchUsers(), fetchRestaurantStatus()]);
      } catch (err) {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchOrders, fetchMenu, fetchUsers, fetchRestaurantStatus]);

  // ─── Auto-refresh orders every 15 seconds ─────────────────────────────────
  useEffect(() => {
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // ─── Order actions with refund for wallet payments ─────────────────────────
  const updateOrderStatus = async (id: number, status: Order['status']) => {
    setUpdatingId(id);
    try {
      // 1. Update order status
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('Update failed');

      // 2. If cancelling a wallet‑paid order, trigger refund
      if (status === 'Cancelled') {
        const order = orders.find(o => o.id === id);
        if (order?.payment_method === 'wallet') {
          const refundRes = await fetch('/api/admin/refund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: id }),
          });
          if (refundRes.ok) {
            alert('Order cancelled and wallet refunded.');
          } else {
            const err = await refundRes.json();
            alert(`Refund failed: ${err.error || 'Unknown error'}`);
          }
        } else {
          alert('Order cancelled. No refund needed (non‑wallet payment).');
        }
      }

      // Optimistic update
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    } catch (err) {
      console.error('updateOrderStatus error:', err);
      alert('Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  // ─── Menu actions (unchanged) ──────────────────────────────────────────────
  const saveMenuItem = async () => {
    const method = editingItem ? 'PUT' : 'POST';
    const body = editingItem ? { id: editingItem.id, ...menuForm } : menuForm;
    const res = await fetch('/api/admin/menu', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      fetchMenu();
      setEditingItem(null);
      setMenuForm({ name: '', desc: '', price: 0, category: 'pasta', image_url: '', mins: 10 });
    } else {
      alert('Save failed');
    }
  };

  const deleteMenuItem = async (id: number) => {
    if (confirm('Delete this item?')) {
      const res = await fetch('/api/admin/menu', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) fetchMenu();
    }
  };

  const editItem = (item: MenuItem) => {
    setEditingItem(item);
    setMenuForm({
      name: item.name,
      desc: item.desc,
      price: item.price,
      category: item.category,
      image_url: item.image_url,
      mins: item.mins,
    });
  };

  // ─── Loading / Error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050505',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: '2px solid #262626',
            borderTopColor: '#E8192C',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ color: '#A0A0A0', fontSize: '0.85rem', letterSpacing: 2 }}>LOADING KITCHEN...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050505',
          gap: 16,
          padding: '2rem',
        }}
      >
        <p style={{ color: '#E8192C', fontSize: '1rem', textAlign: 'center' }}>⚠️ {error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#E8192C',
            color: '#fff',
            border: 'none',
            padding: '0.75rem 2rem',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Retry
        </button>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'transparent',
            color: '#A0A0A0',
            border: '1px solid #262626',
            padding: '0.75rem 2rem',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          ← Back to App
        </button>
      </div>
    );
  }

  // ─── Dashboard UI ──────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050505',
        color: '#F5F5F5',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#000',
          borderBottom: '1px solid rgba(232,25,44,0.2)',
          padding: '0.875rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: '1.25rem',
              letterSpacing: 1,
              color: '#fff',
            }}
          >
            Foodician Admin
          </div>
          <div
            style={{
              fontSize: '0.6rem',
              letterSpacing: 2,
              color: '#F5C300',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Kitchen Control
          </div>
        </div>
        {/* ✅ Online/Offline toggle */}
        <button
          onClick={toggleRestaurant}
          style={{
            background: isOpen ? '#22C55E' : '#E8192C',
            color: '#fff',
            padding: '0.4rem 0.875rem',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          {isOpen ? '🟢 Online' : '🔴 Offline'}
        </button>
        <button
          onClick={fetchOrders}
          style={{
            background: '#161616',
            border: '1px solid #262626',
            color: '#A0A0A0',
            padding: '0.4rem 0.875rem',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          ↻ Refresh
        </button>
        <button
          onClick={() => router.push('/')}
          style={{
            background: '#E8192C',
            border: 'none',
            color: '#fff',
            padding: '0.4rem 0.875rem',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          ← App
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          borderBottom: '1px solid #1a1a1a',
          padding: '0 0.5rem',
          gap: 4,
        }}
      >
        {[
          { id: 'orders', label: '📋 Orders' },
          { id: 'analytics', label: '📊 Analytics' },
          { id: 'menu', label: '🍽️ Menu' },
          { id: 'customers', label: '👥 Customers' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as never)}
            style={{
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              color: activeTab === tab.id ? '#E8192C' : '#A0A0A0',
              borderBottom: activeTab === tab.id ? '2px solid #E8192C' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '1.25rem 1rem', maxWidth: 1200, margin: '0 auto' }}>
        {/* ORDERS TAB (unchanged) */}
        {activeTab === 'orders' && (
          <>
            <h2
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '1.75rem',
                color: '#F5C300',
                marginBottom: '1rem',
              }}
            >
              Incoming Orders ({orders.length})
            </h2>
            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: '#A0A0A0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 8 }}>📭</div>
                No orders yet.
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    background: '#0F0F0F',
                    border: '1px solid #262626',
                    borderRadius: 12,
                    padding: '1rem',
                    marginBottom: '0.875rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: '1.25rem',
                        letterSpacing: 1,
                      }}
                    >
                      #{order.verification_code}
                    </span>
                    <span
                      style={{
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.625rem',
                        borderRadius: 4,
                        background:
                          order.status === 'Ready'
                            ? 'rgba(34,197,94,0.15)'
                            : order.status === 'Cancelled'
                            ? 'rgba(239,68,68,0.15)'
                            : order.status === 'Completed'
                            ? 'rgba(255,255,255,0.05)'
                            : 'rgba(245,195,0,0.15)',
                        color:
                          order.status === 'Ready'
                            ? '#22C55E'
                            : order.status === 'Cancelled'
                            ? '#ef4444'
                            : order.status === 'Completed'
                            ? '#888'
                            : '#F5C300',
                      }}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#A0A0A0', marginBottom: 6 }}>
                    👤 {order.user_name}
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      background: 'rgba(0,0,0,0.3)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 6,
                      marginBottom: '0.75rem',
                      lineHeight: 1.6,
                    }}
                  >
                    {(order.items ?? []).map((item, i) => (
                      <div key={i}>📦 {item}</div>
                    ))}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: '1.2rem',
                        color: '#F5C300',
                      }}
                    >
                      ₦{order.total_amount?.toLocaleString()}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {order.status !== 'Ready' &&
                        order.status !== 'Cancelled' &&
                        order.status !== 'Completed' && (
                          <button
                            onClick={() => updateOrderStatus(order.id, 'Ready')}
                            disabled={updatingId === order.id}
                            style={{
                              padding: '0.375rem 0.75rem',
                              background: 'rgba(34,197,94,0.1)',
                              border: '1px solid #22C55E',
                              borderRadius: 6,
                              color: '#22C55E',
                              cursor: 'pointer',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                            }}
                          >
                            ✅ Ready
                          </button>
                        )}
                      {order.status === 'Ready' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'Completed')}
                          disabled={updatingId === order.id}
                          style={{
                            padding: '0.375rem 0.75rem',
                            background: 'rgba(96,165,250,0.1)',
                            border: '1px solid #60a5fa',
                            borderRadius: 6,
                            color: '#60a5fa',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                          }}
                        >
                          ✔ Collected
                        </button>
                      )}
                      {order.status !== 'Cancelled' && order.status !== 'Completed' && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'Cancelled')}
                          disabled={updatingId === order.id}
                          style={{
                            padding: '0.375rem 0.75rem',
                            background: 'transparent',
                            border: '1px solid #262626',
                            borderRadius: 6,
                            color: '#A0A0A0',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#444', marginTop: 6 }}>
                    {new Date(order.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ANALYTICS TAB (unchanged) */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div
                style={{
                  background: '#0F0F0F',
                  border: '1px solid #262626',
                  borderRadius: 12,
                  padding: '1.5rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#A0A0A0', marginBottom: 4 }}>
                  Today&apos;s Orders
                </div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: '3.5rem',
                    color: '#F5C300',
                    lineHeight: 1,
                  }}
                >
                  {analytics.todayOrders}
                </div>
              </div>
              <div
                style={{
                  background: '#0F0F0F',
                  border: '1px solid #262626',
                  borderRadius: 12,
                  padding: '1.5rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#A0A0A0', marginBottom: 4 }}>
                  Today&apos;s Revenue
                </div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: '2.5rem',
                    color: '#F5C300',
                    lineHeight: 1,
                  }}
                >
                  ₦{analytics.todayRevenue.toLocaleString()}
                </div>
              </div>
            </div>
            {/* Top 5 items */}
            <div
              style={{
                background: '#0F0F0F',
                border: '1px solid #262626',
                borderRadius: 12,
                padding: '1.25rem',
              }}
            >
              <h3
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '1.5rem',
                  color: '#F5C300',
                  marginBottom: '1rem',
                }}
              >
                🔥 Top 5 Items
              </h3>
              {analytics.popularItems.length === 0 ? (
                <p style={{ color: '#A0A0A0', textAlign: 'center' }}>No data yet</p>
              ) : (
                analytics.popularItems.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid #1a1a1a',
                      padding: '0.5rem 0',
                    }}
                  >
                    <span>{item.name}</span>
                    <span style={{ color: '#F5C300' }}>{item.count} orders</span>
                  </div>
                ))
              )}
            </div>
            {/* Sales Trends Charts */}
            <div
              style={{
                background: '#0F0F0F',
                border: '1px solid #262626',
                borderRadius: 12,
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <h3
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: '1.5rem',
                    color: '#F5C300',
                  }}
                >
                  📈 Sales Trends
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setSalesView('daily')}
                    style={{
                      padding: '0.3rem 0.8rem',
                      borderRadius: 6,
                      background: salesView === 'daily' ? '#E8192C' : '#161616',
                      border: '1px solid #262626',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setSalesView('weekly')}
                    style={{
                      padding: '0.3rem 0.8rem',
                      borderRadius: 6,
                      background: salesView === 'weekly' ? '#E8192C' : '#161616',
                      border: '1px solid #262626',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    Weekly
                  </button>
                </div>
              </div>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  {salesView === 'daily' ? (
                    <LineChart data={dailySales} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#A0A0A0" />
                      <YAxis stroke="#A0A0A0" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0F0F0F', borderColor: '#262626', color: '#fff' }}
                        labelStyle={{ color: '#F5C300' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#F5C300" name="Revenue (₦)" strokeWidth={2} dot={{ fill: '#F5C300' }} />
                    </LineChart>
                  ) : (
                    <BarChart data={weeklySales} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="week" stroke="#A0A0A0" />
                      <YAxis stroke="#A0A0A0" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0F0F0F', borderColor: '#262626', color: '#fff' }}
                        labelStyle={{ color: '#F5C300' }}
                      />
                      <Legend />
                      <Bar dataKey="revenue" fill="#F5C300" name="Revenue (₦)" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* MENU TAB (unchanged) */}
        {activeTab === 'menu' && (
          <>
            <div
              style={{
                background: '#0F0F0F',
                border: '1px solid #262626',
                borderRadius: 12,
                padding: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <h3
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '1.25rem',
                  color: '#F5C300',
                  marginBottom: '0.875rem',
                }}
              >
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Name"
                  value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={menuForm.desc}
                  onChange={(e) => setMenuForm({ ...menuForm, desc: e.target.value })}
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="Price (₦)"
                  value={menuForm.price === 0 ? '' : menuForm.price}
                  onChange={(e) =>
                    setMenuForm({ ...menuForm, price: parseInt(e.target.value) || 0 })
                  }
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="Image URL"
                  value={menuForm.image_url}
                  onChange={(e) => setMenuForm({ ...menuForm, image_url: e.target.value })}
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="Prep time (mins)"
                  value={menuForm.mins === 0 ? '' : menuForm.mins}
                  onChange={(e) =>
                    setMenuForm({ ...menuForm, mins: parseInt(e.target.value) || 0 })
                  }
                  style={inputStyle}
                />
                <select
                  value={menuForm.category}
                  onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="pasta">Spaghetti</option>
                  <option value="noodles">Indomie</option>
                  <option value="protein">Proteins</option>
                  <option value="sides">Sides</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                <button
                  onClick={saveMenuItem}
                  style={{
                    background: '#E8192C',
                    color: '#fff',
                    border: 'none',
                    padding: '0.625rem 1.25rem',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {editingItem ? 'Update' : 'Create'}
                </button>
                {editingItem && (
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setMenuForm({
                        name: '',
                        desc: '',
                        price: 0,
                        category: 'pasta',
                        image_url: '',
                        mins: 10,
                      });
                    }}
                    style={{
                      background: '#161616',
                      color: '#A0A0A0',
                      border: '1px solid #262626',
                      padding: '0.625rem 1.25rem',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <h3
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '1.25rem',
                color: '#F5C300',
                marginBottom: '0.75rem',
              }}
            >
              Existing Items ({menuItems.length})
            </h3>
            {menuItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#0F0F0F',
                  border: '1px solid #262626',
                  borderRadius: 10,
                  padding: '0.875rem',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#A0A0A0' }}>
                    ₦{item.price} · {item.category} · {item.mins} mins
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => editItem(item)}
                    style={{
                      color: '#60a5fa',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteMenuItem(item.id)}
                    style={{
                      color: '#E8192C',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* CUSTOMERS TAB – WITH TOTAL SPENT COLUMN */}
        {activeTab === 'customers' && (
          <>
            <h2
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '1.75rem',
                color: '#F5C300',
                marginBottom: '1rem',
              }}
            >
              Registered Customers ({users.length})
            </h2>
            {users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#A0A0A0' }}>
                No customers yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #262626', color: '#A0A0A0' }}>
                      <th style={{ padding: '0.625rem', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '0.625rem', textAlign: 'left' }}>Email</th>
                      <th style={{ padding: '0.625rem', textAlign: 'left' }}>Total Spent</th>
                      <th style={{ padding: '0.625rem', textAlign: 'left' }}>Wallet</th>
                      <th style={{ padding: '0.625rem', textAlign: 'left' }}>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td style={{ padding: '0.625rem' }}>{user.name}</td>
                        <td style={{ padding: '0.625rem', color: '#A0A0A0' }}>{user.email}</td>
                        <td style={{ padding: '0.625rem', color: '#F5C300' }}>
                          ₦{user.total_spent?.toLocaleString() ?? 0}
                        </td>
                        <td style={{ padding: '0.625rem', color: '#F5C300' }}>
                          ₦{user.wallet?.toLocaleString()}
                        </td>
                        <td style={{ padding: '0.625rem', color: '#A0A0A0', fontSize: '0.75rem' }}>
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}