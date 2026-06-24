'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';

const RestaurantMapPicker = dynamic(
  () => import('@/src/components/RestaurantMapPicker'),
  { ssr: false, loading: () => <div style={{ height: 320, background: '#0C0C0C', borderRadius: 10, border: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '0.85rem' }}>Loading map…</div> },
);

type ShopHour = { id: string; day_of_week: number; open_time: string; close_time: string; is_closed: boolean };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const inputStyle: React.CSSProperties = {
  background: '#0F0F0F', border: '1px solid #262626', borderRadius: 8,
  padding: '0.75rem', color: '#fff', width: '100%', outline: 'none',
};

const sectionStyle: React.CSSProperties = {
  background: '#0A0A0A', border: '1px solid #161616', borderRadius: 14,
  padding: '1.75rem', marginBottom: '1.5rem',
};

export default function AdminSettingsPage() {
  const router = useRouter();

  // ── Restaurant info ────────────────────────────────────────────────────────
  const [configRowId,     setConfigRowId]     = useState<string | null>(null);
  const [restaurantLat,   setRestaurantLat]   = useState(6.5205);
  const [restaurantLng,   setRestaurantLng]   = useState(3.3958);
  const [restaurantName,  setRestaurantName]  = useState('');
  const [mainAddress,     setMainAddress]     = useState('');
  const [savingInfo,      setSavingInfo]      = useState(false);
  const [savedInfo,       setSavedInfo]       = useState(false);

  // ── Delivery pricing ───────────────────────────────────────────────────────
  const [pricing,       setPricing]       = useState({ base_fee: 500, per_km_rate: 200, unilag_fee: 500, free_first_km: 1 });
  const [savingPricing, setSavingPricing] = useState(false);
  const [savedPricing,  setSavedPricing]  = useState(false);

  // ── Shop hours ─────────────────────────────────────────────────────────────
  const [shopHours,   setShopHours]   = useState<ShopHour[]>([]);
  const [savingHours, setSavingHours] = useState(false);

  // ── Load all config on mount ───────────────────────────────────────────────
  const load = useCallback(async () => {
    const [{ data: cfg }, { data: hours }] = await Promise.all([
      supabase
        .from('restaurant_config')
        .select('id, restaurant_name, main_address, latitude, longitude, delivery_base_fee, delivery_per_km, unilag_fee, free_first_km')
        .maybeSingle(),
      supabase.from('shop_hours').select('*').order('day_of_week'),
    ]);

    if (cfg) {
      setConfigRowId(cfg.id as string);
      if (cfg.restaurant_name) setRestaurantName(cfg.restaurant_name as string);
      if (cfg.main_address)    setMainAddress(cfg.main_address as string);
      if (cfg.latitude)        setRestaurantLat(cfg.latitude as number);
      if (cfg.longitude)       setRestaurantLng(cfg.longitude as number);
      setPricing({
        base_fee:      (cfg.delivery_base_fee as number) ?? 500,
        per_km_rate:   (cfg.delivery_per_km   as number) ?? 200,
        unilag_fee:    (cfg.unilag_fee         as number) ?? 500,
        free_first_km: (cfg.free_first_km      as number) ?? 1,
      });
    }
    if (hours) setShopHours(hours as ShopHour[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Save restaurant info ───────────────────────────────────────────────────
  const saveInfo = async () => {
    if (!configRowId) return;
    setSavingInfo(true);
    await supabase.from('restaurant_config')
      .update({ restaurant_name: restaurantName, main_address: mainAddress, updated_at: new Date().toISOString() })
      .eq('id', configRowId);
    setSavingInfo(false);
    setSavedInfo(true);
    setTimeout(() => setSavedInfo(false), 3500);
  };

  // ── Save delivery pricing ──────────────────────────────────────────────────
  const savePricing = async () => {
    if (!configRowId) return;
    setSavingPricing(true);
    await supabase.from('restaurant_config')
      .update({
        delivery_base_fee: pricing.base_fee,
        delivery_per_km:   pricing.per_km_rate,
        unilag_fee:        pricing.unilag_fee,
        free_first_km:     pricing.free_first_km,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', configRowId);
    setSavingPricing(false);
    setSavedPricing(true);
    setTimeout(() => setSavedPricing(false), 3500);
  };

  // ── Shop hours helpers ─────────────────────────────────────────────────────
  const updateHourRow = (id: string, patch: Partial<ShopHour>) =>
    setShopHours(h => h.map(r => r.id === id ? { ...r, ...patch } : r));

  const saveHourRow = async (row: ShopHour) => {
    setSavingHours(true);
    await supabase.from('shop_hours').update({
      open_time: row.open_time, close_time: row.close_time, is_closed: row.is_closed,
    }).eq('id', row.id);
    setSavingHours(false);
  };

  // ── Fee preview helper ─────────────────────────────────────────────────────
  const feePreview = (km: number) =>
    Math.ceil(pricing.base_fee + Math.max(0, km - pricing.free_first_km) * pricing.per_km_rate);

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#F5F5F5', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,5,5,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #161616', padding: '0 1.5rem', height: 56, display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={() => router.push('/admin')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#A0A0A0', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '0.375rem 0.5rem', borderRadius: 6 }}
        >
          <ArrowLeft size={16} /> Back to Admin
        </button>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.3rem', color: '#F5C300', letterSpacing: 2, marginLeft: 'auto' }}>Settings</span>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1.25rem' }}>

        {/* ── Restaurant Info ─────────────────────────────────────────────── */}
        <div style={sectionStyle}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: '#F5C300', marginBottom: '0.25rem' }}>Restaurant Info</h2>
          <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1.25rem' }}>Name and address shown to customers.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#A0A0A0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Restaurant Name</label>
              <input value={restaurantName} onChange={e => setRestaurantName(e.target.value)} placeholder="e.g. Foodician" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#A0A0A0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Main Address</label>
              <input value={mainAddress} onChange={e => setMainAddress(e.target.value)} placeholder="e.g. Jaja Complex, UNILAG" style={inputStyle} />
            </div>
          </div>
          <button
            onClick={saveInfo}
            disabled={savingInfo || !configRowId}
            style={{ marginTop: '1rem', background: savedInfo ? 'rgba(34,197,94,0.12)' : savingInfo ? '#262626' : '#E8192C', color: savedInfo ? '#22C55E' : '#fff', border: savedInfo ? '1px solid rgba(34,197,94,0.35)' : 'none', padding: '0.65rem 1.75rem', borderRadius: 8, cursor: savingInfo ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem', opacity: savingInfo ? 0.6 : 1, transition: 'all 0.25s' }}
          >
            {savedInfo ? 'Saved ✓' : savingInfo ? 'Saving…' : 'Save Info'}
          </button>
        </div>

        {/* ── Restaurant Location Map ─────────────────────────────────────── */}
        <div style={sectionStyle}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: '#F5C300', marginBottom: '0.25rem' }}>Restaurant Location</h2>
          <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1.25rem' }}>
            Drag the pin or click the map to set the exact pickup point. Used to calculate delivery distances.
          </p>
          {configRowId ? (
            <RestaurantMapPicker
              initialLat={restaurantLat}
              initialLng={restaurantLng}
              configRowId={configRowId}
            />
          ) : (
            <div style={{ height: 80, display: 'flex', alignItems: 'center', color: '#555', fontSize: '0.85rem' }}>Loading…</div>
          )}
        </div>

        {/* ── Delivery Pricing ────────────────────────────────────────────── */}
        <div style={sectionStyle}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: '#F5C300', marginBottom: '0.25rem' }}>Delivery Pricing</h2>
          <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1.25rem' }}>Changes take effect immediately for all new orders.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {([
              ['Base Delivery Fee (₦)', 'base_fee'],
              ['Per KM Rate (₦/km)', 'per_km_rate'],
              ['UNILAG Flat Fee (₦)', 'unilag_fee'],
              ['Free First KM', 'free_first_km'],
            ] as [string, keyof typeof pricing][]).map(([label, key]) => (
              <div key={key}>
                <label style={{ fontSize: '0.72rem', color: '#A0A0A0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>{label}</label>
                <input type="number" value={pricing[key]} onChange={e => setPricing({ ...pricing, [key]: Number(e.target.value) })} style={inputStyle} />
              </div>
            ))}
          </div>
          {/* Live preview */}
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#050505', borderRadius: 8, fontSize: '0.8rem', color: '#A0A0A0', border: '1px solid #1a1a1a', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <span>3 km → <strong style={{ color: '#F5F5F5' }}>₦{feePreview(3).toLocaleString()}</strong></span>
            <span>5 km → <strong style={{ color: '#F5F5F5' }}>₦{feePreview(5).toLocaleString()}</strong></span>
            <span>10 km → <strong style={{ color: '#F5F5F5' }}>₦{feePreview(10).toLocaleString()}</strong></span>
            <span>UNILAG → <strong style={{ color: '#F5F5F5' }}>₦{pricing.unilag_fee.toLocaleString()}</strong></span>
          </div>
          <button
            onClick={savePricing}
            disabled={savingPricing || !configRowId}
            style={{ marginTop: '1rem', background: savedPricing ? 'rgba(34,197,94,0.12)' : savingPricing ? '#262626' : '#E8192C', color: savedPricing ? '#22C55E' : '#fff', border: savedPricing ? '1px solid rgba(34,197,94,0.35)' : 'none', padding: '0.65rem 1.75rem', borderRadius: 8, cursor: savingPricing ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem', opacity: savingPricing ? 0.6 : 1, transition: 'all 0.25s' }}
          >
            {savedPricing ? 'Saved ✓' : savingPricing ? 'Saving…' : 'Save Pricing'}
          </button>
        </div>

        {/* ── Shop Hours ──────────────────────────────────────────────────── */}
        <div style={sectionStyle}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: '#F5C300', marginBottom: '0.25rem' }}>Shop Hours</h2>
          <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1.25rem' }}>Toggle a day off to keep the shop closed regardless of time.</p>
          {shopHours.length === 0 ? (
            <div style={{ color: '#555', fontSize: '0.85rem' }}>No hours configured.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {shopHours.map(row => (
                <div key={row.id} style={{ background: '#050505', border: `1px solid ${row.is_closed ? '#111' : '#1a1a1a'}`, borderRadius: 10, padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.875rem', opacity: row.is_closed ? 0.5 : 1 }}>
                  <button
                    onClick={() => updateHourRow(row.id, { is_closed: !row.is_closed })}
                    style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0, background: !row.is_closed ? '#22C55E' : '#262626', position: 'relative', transition: 'background 0.2s' }}
                  >
                    <span style={{ position: 'absolute', top: 2, left: !row.is_closed ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                  </button>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', color: '#F5F5F5', width: 32, flexShrink: 0 }}>{DAY_NAMES[row.day_of_week]}</span>
                  <input type="time" value={row.open_time} onChange={e => updateHourRow(row.id, { open_time: e.target.value })} disabled={row.is_closed} style={{ ...inputStyle, width: 'auto', flex: 1, fontSize: '0.85rem' }} />
                  <span style={{ color: '#555', fontSize: '0.8rem', flexShrink: 0 }}>to</span>
                  <input type="time" value={row.close_time} onChange={e => updateHourRow(row.id, { close_time: e.target.value })} disabled={row.is_closed} style={{ ...inputStyle, width: 'auto', flex: 1, fontSize: '0.85rem' }} />
                  <button
                    onClick={() => saveHourRow(row)}
                    disabled={savingHours}
                    style={{ background: '#E8192C', color: '#fff', border: 'none', borderRadius: 6, padding: '0.375rem 0.875rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, flexShrink: 0, opacity: savingHours ? 0.6 : 1 }}
                  >Save</button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
