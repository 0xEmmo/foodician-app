'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Bike, Store, Wallet, CreditCard, Landmark, NotebookPen, MapPin } from 'lucide-react';
import { useAppStore } from '@/src/store/useAppStore';
import { calculateServiceCharge } from '@/src/lib/serviceCharge';
import { calculateDeliveryFee, RESTAURANT_LAT, RESTAURANT_LNG } from '@/src/lib/delivery';
import { haversineDistance } from '@/src/lib/distance';
import MenuCard from '@/src/components/MenuCard';
import FavoritesCarousel from '@/src/components/FavoritesCarousel';
import PromoCodeInput from '@/src/components/PromoCodeInput';
import { supabase } from '@/src/lib/supabase';
import { generateReceiptPDF } from '@/src/lib/receipts';
import { applyReferralCode } from '@/src/lib/referrals';
import type { PromoCode } from '@/src/lib/promos';

interface PaystackHandler { openIframe: () => void; }
interface PaystackPopStatic { setup: (cfg: Record<string, unknown>) => PaystackHandler; }
declare global {
  interface Window {
    PaystackPop: PaystackPopStatic;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any;
  }
}

type Category = 'all' | 'pasta' | 'noodles' | 'protein' | 'sides';

type MenuItem = {
  id: number;
  name: string;
  desc: string;
  price: number;
  emoji?: string;
  image: string;
  image_url?: string;
  mins: number;
  cat: Category | string;
};

const CAT_ICONS: Record<Category, React.ReactNode> = {
  all: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l7-7 7 7" /><path d="M5 9v10a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1V9" />
    </svg>
  ),
  pasta: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <path d="M4 15c0 3.31 3.58 6 8 6s8-2.69 8-6H4z" />
      <path d="M4 15c0-5.52 3.58-10 8-10s8 4.48 8 10" />
      <path d="M12 5V3" /><path d="M9 6.5L8 4.5" /><path d="M15 6.5l1-2" />
    </svg>
  ),
  noodles: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <path d="M4 13c0 3.31 3.58 6 8 6s8-2.69 8-6H4z" />
      <path d="M7 9c.5-1.5 1.5-2 2.5-2s2 .5 2.5 2 1.5 2 2.5 2 2-.5 2.5-2" />
      <path d="M4.5 6c.5-1.5 1.5-2 2.5-2s2 .5 2.5 2 1.5 2 2.5 2 2-.5 2.5-2 1.5-2 2.5-2" />
    </svg>
  ),
  protein: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.56 2.9A6 6 0 0121 8c0 2-.8 3.7-2 5l-1 1a6 6 0 01-8.5-8.5l1-1A6 6 0 018.56 2.9z" />
      <path d="M3.5 20.5l5-5" />
    </svg>
  ),
  sides: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M7.5 10V7.5M12 10V5M16.5 10V7.5" />
    </svg>
  ),
};

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all',     label: 'All'       },
  { id: 'pasta',   label: 'Spaghetti' },
  { id: 'noodles', label: 'Indomie'   },
  { id: 'protein', label: 'Proteins'  },
  { id: 'sides',   label: 'Sides'     },
];

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80';

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-[#262626] border-t-[#E8192C] animate-spin" />
      <p className="text-[#A0A0A0] text-[0.85rem] tracking-[2px] uppercase" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '3px' }}>
        Loading Menu...
      </p>
    </div>
  );
}

// ─── Auth Gate ───────────────────────────────────────────────────────────────
function AuthGate() {
  const signUp = useAppStore((s) => s.signUp);
  const signIn = useAppStore((s) => s.signIn);
  const [isLogin,      setIsLogin]      = useState(true);
  const [fullName,     setFullName]     = useState('');
  const [phone,        setPhone]        = useState('');
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isLogin) {
      const result = await signIn(email, password);
      if (result.error) setError(result.error.message);
    } else {
      if (!fullName.trim()) { setError('Full name is required'); setLoading(false); return; }
      if (phone && (phone.length !== 11 || !phone.startsWith('0'))) {
        setError('Phone must be 11 digits starting with 0'); setLoading(false); return;
      }
      const result = await signUp(email, password, fullName.trim());
      if (result.error) { setError(result.error.message); setLoading(false); return; }
      if (referralCode.trim()) {
        const { data } = await supabase.auth.getUser();
        if (data.user) await applyReferralCode(referralCode.trim().toUpperCase(), data.user.id);
      }
    }
    setLoading(false);
  };

  const field = "w-full bg-[rgba(255,255,255,0.05)] border border-[#262626] rounded-[12px] py-3.5 pr-4 text-white outline-none transition-all focus:border-[#E8192C] placeholder:text-[#555]";

  return (
    <div
      className="min-h-full flex flex-col justify-end p-5"
      style={{ background: "linear-gradient(180deg,rgba(0,0,0,0.55) 0%,#050505 100%),url('https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=480&q=80') center/cover" }}
    >
      <div className="bg-[rgba(12,12,12,0.92)] backdrop-blur-[24px] border border-[#1f1f1f] rounded-[24px] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
        <Image
          src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=100&q=80"
          alt="Logo" width={58} height={58}
          className="rounded-full border-2 border-[#6B000A] mb-4 shadow-[0_0_20px_rgba(232,25,44,0.35)]"
        />
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.25rem', color: '#fff', lineHeight: 1.05, marginBottom: 6 }}>
          Treats by<br />Foodician
        </div>
        <p className="text-[0.875rem] text-[#666] mb-6">
          {isLogin ? 'Sign in to continue' : 'Create a new account'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          {!isLogin && (
            <>
              {/* Full name */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </span>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name" className={`${field} pl-11`} />
              </div>
              {/* Phone */}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.29 4.18 2 2 0 015.27 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006.29 6.29l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                </span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="08012345678" maxLength={11} className={`${field} pl-11`} />
              </div>
              <p className="text-[0.7rem] text-[#444] -mt-1 ml-1">11 digits, starts with 0</p>
            </>
          )}

          {/* Email */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 6 10-6"/></svg>
            </span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" className={`${field} pl-11`} />
          </div>

          {/* Password */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            </span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters" className={`${field} pl-11`} />
          </div>

          {/* Referral code (signup only) */}
          {!isLogin && (
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>
              </span>
              <input type="text" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="E.G. ABCD1234" maxLength={8}
                className={`${field} pl-11 tracking-[3px]`} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-[#E8192C] font-semibold">optional — get ₦2,000</span>
            </div>
          )}

          {error && <p className="text-[0.8rem] text-[#E8192C]">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-[#E8192C] text-white border-none cursor-pointer py-4 rounded-[12px] text-[1.2rem] tracking-[2px] transition-all hover:bg-[#FF2E43] disabled:opacity-50 mt-1"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {loading ? 'PROCESSING...' : isLogin ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
          </button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          className="w-full text-center text-[#555] text-[0.85rem] hover:text-[#A0A0A0] transition"
        >
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span className="text-[#E8192C] font-semibold">{isLogin ? 'Sign up' : 'Sign in'}</span>
        </button>
      </div>
    </div>
  );
}

// ─── Cart Sheet ───────────────────────────────────────────────────────────────
function CartSheet({
  open,
  onClose,
  menuItems,
}: {
  open: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
}) {
  const cart = useAppStore((s) => s.cart);
  const changeQty = useAppStore((s) => s.changeQty);
  const cartMins = useAppStore((s) => s.cartMins);
  const sessionUser = useAppStore((s) => s.sessionUser);
  const clearCart = useAppStore((s) => s.clearCart);
  const addOrder = useAppStore((s) => s.addOrder);
  const addTransaction = useAppStore((s) => s.addTransaction);

  const [showPay, setShowPay] = useState(false);
  const [payMethod, setPayMethod] = useState<'wallet' | 'paystack' | 'transfer'>('wallet');
  const [geocoding, setGeocoding]     = useState(false);
  const [suggestions, setSuggestions] = useState<{ lat: string; lon: string; display_name: string }[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmMins, setConfirmMins] = useState(0);
  const [toast, setToast] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [appliedPromo,  setAppliedPromo]  = useState<PromoCode | null>(null);
  const [orderSnapshot, setOrderSnapshot] = useState<{
    code: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
  } | null>(null);

  // ─── ORDER NOTES ─────────────────────────────────────────────────────────
  const [orderNotes, setOrderNotes] = useState('');

  // ─── DELIVERY STATE ───────────────────────────────────────────────────────
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup');
  const [isUnilag, setIsUnilag] = useState(false);
  const [unilagLocation, setUnilagLocation] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [deliveryData, setDeliveryData] = useState<{
    address: string;
    lat: number;
    lng: number;
    distance: number;
  } | null>(null);

  const cartIds = Object.keys(cart).map(Number).filter((id) => cart[id] > 0);
  // Use live DB prices from menuItems, not the static store MENU, to avoid mismatch
  const subtotal = cartIds.reduce((sum, id) => {
    const item = menuItems.find((m) => m.id === id);
    return sum + (item ? item.price * cart[id] : 0);
  }, 0);
  const serviceCharge = calculateServiceCharge(subtotal, orderType);
  const total = subtotal + serviceCharge + (orderType === 'delivery' ? deliveryFee : 0) - promoDiscount;
  // Use DB prep times from menuItems for accuracy
  const mins = cartIds.length
    ? Math.max(...cartIds.map((id) => menuItems.find((m) => m.id === id)?.mins ?? 10)) + 3
    : cartMins();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  };

  // ─── Check if restaurant is open ───────────────────────────────────────────
  const checkRestaurantOpen = async () => {
    try {
      const res = await fetch('/api/restaurant/status');
      const data = await res.json();
      if (!data.is_open) {
        showToast('Restaurant is currently offline. Please try again later.');
        return false;
      }
      return true;
    } catch {
      showToast('Unable to check restaurant status. Please try again.');
      return false;
    }
  };

  // ─── UNILAG toggle ────────────────────────────────────────────────────────
  const handleUnilagToggle = (on: boolean) => {
    setIsUnilag(on);
    if (on) {
      setDeliveryFee(500);
      setEstimatedTime(25);
      setDeliveryData(null);
      setDeliveryAddress('');
    } else {
      setDeliveryFee(0);
      setEstimatedTime(0);
      setDeliveryData(null);
      setDeliveryAddress('');
      setUnilagLocation('');
    }
  };

  // ─── Nominatim address suggestions (debounced, free, no API key) ──────────
  useEffect(() => {
    if (orderType !== 'delivery' || isUnilag || deliveryAddress.length < 4) {
      setGeocoding(false);
      setSuggestions([]);
      return;
    }
    setGeocoding(true);
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(deliveryAddress + ', Nigeria')}&limit=5&countrycodes=ng`,
          { headers: { 'User-Agent': 'Foodician/1.0' } },
        );
        const data = await res.json() as { lat: string; lon: string; display_name: string }[];
        setSuggestions(data);
      } catch {
        setSuggestions([]);
      } finally {
        setGeocoding(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryAddress, orderType, isUnilag]);

  const handleSelectSuggestion = (s: { lat: string; lon: string; display_name: string }) => {
    const lat   = parseFloat(s.lat);
    const lng   = parseFloat(s.lon);
    const label = s.display_name.split(',').slice(0, 3).join(',').trim();
    setDeliveryAddress(label);
    setSuggestions([]);
    const km = haversineDistance(RESTAURANT_LAT, RESTAURANT_LNG, lat, lng);
    setDeliveryFee(calculateDeliveryFee(false, lat, lng));
    setEstimatedTime(Math.round((mins ?? 15) + km * 3));
    setDeliveryData({ address: s.display_name, lat, lng, distance: km });
  };

  // ─── WhatsApp notification ─────────────────────────────────────────────────
  const sendWhatsAppNotification = (orderCode: string, itemsArray: string[], total: number) => {
    const phoneNumber = '2347074099721';
    const itemsText = itemsArray.join('\n• ');
    let message = `🍽️ *NEW ORDER #${orderCode}* 🍽️\n\n*Customer:* ${sessionUser?.name}\n*Items:*\n• ${itemsText}\n\n*Total:* ₦${total.toLocaleString()}\n`;
    
    if (orderType === 'delivery') {
      message += `\n📍 *DELIVERY* to: ${deliveryData?.address}\n⏱️ ETA: ${estimatedTime} mins`;
    } else {
      message += `\n*Status:* Confirmed – prepare for pickup in ${mins} mins.`;
    }
    
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // ─── Finalise order ───────────────────────────────────────────────────────
  const finaliseOrder = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const code = crypto.randomUUID().replace(/-/g, '').substring(0, 4).toUpperCase();
    const itemsArray = cartIds.map((id) => {
      const m = menuItems.find((m) => m.id === id)!;
      return `${m.name} (x${cart[id]})`;
    });

    const receiptItems = cartIds.map(id => {
      const m = menuItems.find(m => m.id === id)!;
      return { name: m.name, quantity: cart[id], price: m.price };
    });
    setOrderSnapshot({ code, items: receiptItems, total });

    const deliveryType = orderType === 'pickup' ? 'pickup' : (isUnilag ? 'unilag' : 'outside');

    // Build order object with delivery info
    const orderData: Record<string, unknown> = {
      code,
      mins:            orderType === 'delivery' ? estimatedTime : mins ?? 15,
      total,
      items:           itemsArray,
      time:            new Date().toLocaleTimeString(),
      status:          'Confirmed',
      customer:        sessionUser?.name ?? 'Guest',
      user_email:      sessionUser?.email ?? '',
      payment_method:  payMethod,
      order_type:      orderType,
      delivery_type:   deliveryType,
      order_subtotal:  subtotal,
      service_charge:  serviceCharge,
    };

    // Add delivery details
    if (orderType === 'delivery') {
      orderData.delivery_fee = deliveryFee;
      if (deliveryPhone.trim()) orderData.customer_phone = deliveryPhone.trim();
      if (isUnilag) {
        orderData.delivery_address = unilagLocation.trim() || 'UNILAG Campus';
      } else if (deliveryData) {
        orderData.delivery_address = deliveryData.address;
        orderData.delivery_lat     = deliveryData.lat;
        orderData.delivery_lng     = deliveryData.lng;
        orderData.distance_km      = deliveryData.distance;
      }
    }
    if (orderNotes.trim()) orderData.order_notes = orderNotes.trim();

    addOrder(orderData as Parameters<typeof addOrder>[0]);
    sendWhatsAppNotification(code, itemsArray, total);

    try {
      await fetch('/api/send-order-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sessionUser?.email,
          name: sessionUser?.name,
          orderCode: code,
          total: total,
          items: itemsArray,
          mins: orderType === 'delivery' ? estimatedTime : mins ?? 15,
          orderType,
          deliveryAddress: deliveryData?.address,
        }),
      });
    } catch (err) {
      console.error('Email send failed:', err);
    }

    const prepMins = orderType === 'delivery' ? estimatedTime : mins ?? 15;
    setConfirmCode(code);
    setConfirmMins(prepMins);
    setCountdown(prepMins * 60); // initialise before the effect runs
    clearCart();
    setShowPay(false);
    onClose();
    setShowConfirm(true);
    setIsSubmitting(false);
  };

  // ─── Paystack payment ──────────────────────────────────────────────────────
  const initiatePaystack = () => {
    if (typeof window === 'undefined' || !window.PaystackPop) {
      showToast('Payment service not ready. Please refresh the page.');
      return;
    }
    if (!sessionUser?.email) {
      showToast('Please ensure you are logged in with an email address.');
      return;
    }
    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!paystackKey || paystackKey === 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      showToast('Paystack key not configured.');
      console.error('Paystack public key missing.');
      return;
    }

    const handler = window.PaystackPop.setup({
      key: paystackKey,
      email: sessionUser.email,
      amount: Math.round(total * 100),
      currency: 'NGN',
      ref: 'TBF-' + crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase(),
      callback: () => {
        showToast('Payment confirmed! Your order is being processed.');
        finaliseOrder();
      },
      onClose: () => {
        showToast('Payment cancelled. Your cart is still saved.');
      },
    });
    handler.openIframe();
  };

  // ─── Wallet payment ───────────────────────────────────────────────────────
  const payWithWallet = () => {
    if (!sessionUser) return;
    if (sessionUser.wallet < total) {
      showToast('Insufficient wallet balance.');
      return;
    }
    addTransaction('debit', total, `Paid for ${orderType} order`);
    finaliseOrder();
  };

  // ─── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!showConfirm || confirmMins <= 0) return;
    const endTime = new Date().getTime() + confirmMins * 60 * 1000;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTime - new Date().getTime()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [showConfirm, confirmMins]);

  const safeImage = (src: string) => (src && src.trim() !== '' ? src : FALLBACK_IMAGE);

  const handlePrintReceipt = () => {
    if (!orderSnapshot) return;
    generateReceiptPDF({
      orderId:       orderSnapshot.code,
      customerName:  sessionUser?.name ?? 'Guest',
      items:         orderSnapshot.items.map((i) => ({ name: i.name, qty: i.quantity, price: i.price, subtotal: i.price * i.quantity })),
      subtotal:      orderSnapshot.total,
      deliveryFee:   0,
      discount:      0,
      total:         orderSnapshot.total,
      paymentMethod: 'paystack',
      orderType:     'pickup',
      createdAt:     new Date().toISOString(),
    });
  };

  return (
    <>
      {/* Cart overlay */}
      <div
        className={`fixed inset-0 z-[200] transition-opacity duration-300 bg-black/60 backdrop-blur-[12px] flex items-end justify-center ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      >
        <div
          className={`bg-[rgba(15,15,15,0.85)] backdrop-blur-[20px] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] w-full max-w-[480px] rounded-t-[24px] p-5 flex flex-col transition-transform duration-400 ${open ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ maxHeight: '90dvh' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-[#262626] rounded-full mx-auto mb-5 flex-shrink-0" />
          <div className="flex-shrink-0 mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '1px', color: '#fff' }}>
            Your Box Summary 🛒
          </div>
          <div className="overflow-y-auto flex-1 no-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            {cartIds.length === 0 ? (
              <div className="text-center py-12 text-[#A0A0A0] text-[0.95rem] font-medium">
                🍱 Your box is empty. Add items from the menu.
              </div>
            ) : (
              cartIds.map((id) => {
                const item = menuItems.find((m) => m.id === id)!;
                return (
                  <div key={id} className="flex items-center gap-4 py-4 border-b border-[#262626] last:border-b-0">
                    <Image
                      src={safeImage(item.image)}
                      alt={item.name}
                      width={48}
                      height={48}
                      className="rounded-lg object-cover border border-[#262626]"
                    />
                    <div className="flex-1">
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '0.5px', color: '#fff' }}>{item.name}</div>
                      <div className="text-[0.85rem] text-[#F5C300] font-semibold mt-0.5">₦{(item.price * cart[id]).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => changeQty(id, -1)} className="w-7 h-7 rounded-md bg-[#161616] border border-[#262626] text-white text-base flex items-center justify-center cursor-pointer transition-all hover:bg-[#E8192C] hover:border-[#E8192C]">−</button>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', minWidth: '20px', textAlign: 'center' }}>{cart[id]}</span>
                      <button onClick={() => changeQty(id, 1)} className="w-7 h-7 rounded-md bg-[#161616] border border-[#262626] text-white text-base flex items-center justify-center cursor-pointer transition-all hover:bg-[#E8192C] hover:border-[#E8192C]">+</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {cartIds.length > 0 && (
            <div className="mt-auto pt-5 border-t border-[#262626] flex-shrink-0" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
              <div className="flex justify-between items-center pb-4">
                <span className="text-[0.95rem] text-[#A0A0A0] font-medium">Subtotal</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: '#F5C300', letterSpacing: '0.5px' }}>₦{subtotal.toLocaleString()}</span>
              </div>
              <div className="bg-[rgba(232,25,44,0.06)] border border-[rgba(232,25,44,0.15)] rounded-[10px] p-3.5 mb-5 text-[0.85rem] text-[#F5F5F5] flex items-center gap-2">
                ⏱️ Ready in: <strong>{orderType === 'delivery' ? estimatedTime : mins} mins</strong>
              </div>
              <button
                onClick={async () => {
                  if (await checkRestaurantOpen()) {
                    setShowPay(true);
                  }
                }}
                className="w-full bg-[#E8192C] text-white border-none cursor-pointer py-4 rounded-[10px] text-[1.25rem] tracking-[2px] transition-all duration-200 shadow-[0_4px_15px_rgba(232,25,44,0.3)] hover:bg-[#FF2E43] hover:-translate-y-px"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                PROCEED TO SECURE CHECKOUT →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payment overlay */}
      <div
        className={`fixed inset-0 z-[300] transition-opacity duration-300 bg-black/60 backdrop-blur-[12px] flex items-end justify-center ${showPay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowPay(false)}
      >
        <div
          className={`bg-[rgba(15,15,15,0.85)] backdrop-blur-[20px] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] w-full max-w-[480px] rounded-t-[24px] flex flex-col transition-transform duration-400 ${showPay ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ maxHeight: '92dvh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Fixed header (does NOT scroll) ── */}
          <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/5">
            <div className="w-10 h-1 bg-[#262626] rounded-full mx-auto mb-4" />
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '1px', color: '#fff', marginBottom: 4 }}>
              Complete Checkout
            </div>
            <p className="text-[0.8rem] text-[#A0A0A0] leading-[1.4]">Pay securely ahead of arrival. The kitchen accepts instantly.</p>
          </div>

          {/* ── Scrollable body ── */}
          <div
            className="flex-1 overflow-y-auto px-5 no-scrollbar"
            style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {/* ─── DELIVERY / PICKUP TOGGLE ─── */}
            <div className="flex gap-2 mt-5 mb-5">
              <button
                onClick={() => {
                  setOrderType('pickup');
                  setIsUnilag(false);
                  setUnilagLocation('');
                  setDeliveryAddress('');
                  setDeliveryFee(0);
                  setEstimatedTime(0);
                  setDeliveryData(null);
                }}
                className={`flex-1 py-3 rounded-[10px] border text-[0.8rem] font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  orderType === 'pickup'
                    ? 'bg-[rgba(232,25,44,0.1)] text-white border-[#E8192C]'
                    : 'bg-[#161616] text-[#A0A0A0] border-[#262626]'
                }`}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <Store size={15} /> Pickup
              </button>
              <button
                onClick={() => setOrderType('delivery')}
                className={`flex-1 py-3 rounded-[10px] border text-[0.8rem] font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  orderType === 'delivery'
                    ? 'bg-[rgba(232,25,44,0.1)] text-white border-[#E8192C]'
                    : 'bg-[#161616] text-[#A0A0A0] border-[#262626]'
                }`}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                <Bike size={15} /> Delivery
              </button>
            </div>

            {/* ─── DELIVERY DETAILS ─── */}
            {orderType === 'delivery' && (
              <div className="mb-5 pb-5 border-b border-[#262626]">

                {/* UNILAG toggle */}
                <button
                  onClick={() => handleUnilagToggle(!isUnilag)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-[10px] border mb-4 transition-all cursor-pointer ${
                    isUnilag
                      ? 'bg-[rgba(245,195,0,0.08)] border-[#F5C300] text-[#F5C300]'
                      : 'bg-[#161616] border-[#262626] text-[#A0A0A0]'
                  }`}
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  <span className="flex items-center gap-2 text-[0.85rem] font-semibold">
                    <MapPin size={15} />
                    Delivering inside UNILAG campus?
                  </span>
                  <span className={`text-[0.75rem] font-bold uppercase tracking-[1px] px-2 py-0.5 rounded-[6px] ${isUnilag ? 'bg-[#F5C300] text-black' : 'bg-[#262626] text-[#666]'}`}>
                    {isUnilag ? 'YES' : 'NO'}
                  </span>
                </button>

                {isUnilag ? (
                  /* ── UNILAG campus location input ── */
                  <>
                    <label className="block text-[0.8rem] text-[#A0A0A0] font-semibold uppercase tracking-[1px] mb-2">Campus Location</label>
                    <input
                      type="text"
                      value={unilagLocation}
                      onChange={(e) => {
                        setUnilagLocation(e.target.value);
                        setDeliveryAddress(e.target.value || 'UNILAG Campus');
                      }}
                      placeholder="e.g. New Hall, Faculty of Engineering, Moremi"
                      className="w-full bg-[#161616] border border-[#262626] rounded-[10px] px-4 py-3.5 text-white outline-none focus:border-[#F5C300] text-[0.9rem] mb-4"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    />
                    <div className="bg-[#161616] border border-[rgba(245,195,0,0.3)] rounded-[10px] p-3.5 text-[0.8rem]">
                      <div className="flex justify-between items-center">
                        <span className="text-[#A0A0A0]">Delivery Fee (UNILAG flat rate)</span>
                        <span className="text-[#F5C300] font-bold">₦500</span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* ── Outside UNILAG — full address + distance calc ── */
                  <>
                    <label className="block text-[0.8rem] text-[#A0A0A0] font-semibold uppercase tracking-[1px] mb-2">Delivery Address</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => {
                          setDeliveryAddress(e.target.value);
                          setDeliveryFee(0);
                          setDeliveryData(null);
                          setSuggestions([]);
                        }}
                        placeholder="e.g. Yaba, Lagos or Flat 3, Lekki Phase 1"
                        className="w-full bg-[#161616] border border-[#262626] rounded-[10px] px-4 py-3.5 text-white outline-none focus:border-[#E8192C] text-[0.9rem]"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                        autoComplete="off"
                      />
                      {geocoding && (
                        <p className="text-[0.72rem] text-[#F5C300] mt-1.5 font-semibold">Searching…</p>
                      )}
                      {suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-[#1C1C1C] border border-[#333] rounded-[10px] overflow-hidden z-50 shadow-2xl">
                          {suggestions.map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                              className="w-full text-left px-4 py-3 text-[0.82rem] text-white hover:bg-[#2A2A2A] active:bg-[#333] border-b border-[#262626] last:border-b-0 cursor-pointer"
                              style={{ fontFamily: "'DM Sans', sans-serif" }}
                            >
                              <span className="text-[#E8192C] mr-1.5">📍</span>
                              {s.display_name.split(',').slice(0, 3).join(',')}
                            </button>
                          ))}
                        </div>
                      )}
                      {!geocoding && suggestions.length === 0 && !deliveryData && deliveryAddress.length >= 4 && (
                        <p className="text-[0.72rem] text-[#666] mt-1.5">No results — try a street name or nearby landmark</p>
                      )}
                    </div>
                    {deliveryData && deliveryFee > 0 && (
                      <div className="bg-[#161616] border border-[rgba(232,25,44,0.3)] rounded-[10px] p-3.5 mt-3 text-[0.8rem]">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[#A0A0A0]">Distance</span>
                          <span className="text-white font-semibold">{deliveryData.distance.toFixed(1)} km</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[#A0A0A0]">Delivery Fee</span>
                          <span className="text-[#F5C300] font-semibold">₦{deliveryFee.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-[#262626]">
                          <span className="text-[#A0A0A0]">Est. Time</span>
                          <span className="text-[#E8192C] font-bold">{estimatedTime} mins</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <label className="block text-[0.8rem] text-[#A0A0A0] font-semibold uppercase tracking-[1px] mt-4 mb-2">Contact Phone for Rider</label>
                <input
                  type="tel"
                  value={deliveryPhone}
                  onChange={(e) => setDeliveryPhone(e.target.value)}
                  placeholder="08012345678"
                  maxLength={11}
                  className="w-full bg-[#161616] border border-[#262626] rounded-[10px] px-4 py-3.5 text-white outline-none focus:border-[#E8192C] text-[0.9rem]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                />
              </div>
            )}

            {/* Special Instructions */}
            <div className="mb-5">
              <label className="block text-[0.8rem] text-[#A0A0A0] font-semibold uppercase tracking-[1px] mb-2 flex items-center gap-1.5">
                <NotebookPen size={13} /> Special Instructions <span className="text-[#555] normal-case font-normal">(optional)</span>
              </label>
              <textarea
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="e.g. No coleslaw, extra spicy, ring doorbell twice…"
                rows={2}
                maxLength={200}
                className="w-full bg-[#161616] border border-[#262626] rounded-[10px] px-4 py-3 text-white outline-none focus:border-[#F5C300] text-[0.875rem] resize-none"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>

            {/* Promo Code */}
            {sessionUser && (
              <div className="mb-4">
                <PromoCodeInput
                  userId={sessionUser.id}
                  subtotal={subtotal}
                  onApplied={(discount, promo) => { setPromoDiscount(discount); setAppliedPromo(promo); }}
                  onRemoved={() => { setPromoDiscount(0); setAppliedPromo(null); }}
                />
              </div>
            )}

            {/* Amount Display */}
            <div className="bg-[#161616] rounded-[12px] p-4 mb-5 flex flex-col gap-3 border border-[#262626]">
              {orderType === 'delivery' && deliveryFee > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[0.75rem] text-[#A0A0A0] font-semibold">Delivery Fee</span>
                  <span className="text-[0.9rem] text-[#F5C300] font-semibold">₦{deliveryFee.toLocaleString()}</span>
                </div>
              )}
              {promoDiscount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[0.75rem] text-[#22C55E] font-semibold">Promo Discount</span>
                  <span className="text-[0.9rem] text-[#22C55E] font-semibold">−₦{promoDiscount.toLocaleString()}</span>
                </div>
              )}
              {(orderType === 'delivery' && deliveryFee > 0) || promoDiscount > 0 ? (
                <div className="border-t border-[#262626]" />
              ) : null}
              <div className="flex justify-between items-center">
                <span className="text-[0.8rem] text-[#A0A0A0] font-semibold uppercase tracking-[1px]">Total Payable</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', color: '#F5C300', letterSpacing: '1px' }}>₦{Math.max(0, total).toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="flex gap-3 mb-5 overflow-x-auto no-scrollbar">
              {(['wallet', 'paystack', 'transfer'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={`flex-1 min-w-[100px] py-3 px-2 rounded-[10px] border text-[0.78rem] font-semibold cursor-pointer transition-all duration-200 flex flex-col items-center gap-1.5 ${payMethod === m ? 'bg-[rgba(232,25,44,0.1)] text-white border-[#E8192C] shadow-[0_0_15px_rgba(232,25,44,0.2)]' : 'bg-[#161616] text-[#A0A0A0] border-[#262626]'}`}
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {m === 'wallet' ? <><Wallet size={16} /> Wallet</> : m === 'paystack' ? <><CreditCard size={16} /> Card</> : <><Landmark size={16} /> Transfer</>}
                </button>
              ))}
            </div>

            {/* Wallet Payment */}
            {payMethod === 'wallet' && (
              <div>
                <div className="bg-[#161616] rounded-[12px] p-4 mb-3 flex justify-between items-center border border-[#262626]">
                  <span className="text-[0.8rem] text-[#A0A0A0] font-semibold uppercase tracking-[1px]">Current Balance</span>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: '#F5C300', letterSpacing: '1px' }}>₦{(sessionUser?.wallet ?? 0).toLocaleString()}</span>
                </div>
                {sessionUser && sessionUser.wallet < total && (
                  <p className="text-[0.75rem] text-[#E8192C] text-center mb-3 font-semibold">Insufficient wallet balance. Top up or select another method.</p>
                )}
                <button
                  onClick={payWithWallet}
                  disabled={!sessionUser || sessionUser.wallet < total || isSubmitting}
                  className="w-full bg-[#E8192C] text-white border-none cursor-pointer py-4 rounded-[10px] text-[1.25rem] tracking-[2px] transition-all duration-200 shadow-[0_4px_15px_rgba(232,25,44,0.3)] hover:bg-[#FF2E43] hover:-translate-y-px disabled:opacity-50 disabled:pointer-events-none"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  {isSubmitting ? 'PROCESSING...' : 'PAY FROM WALLET →'}
                </button>
              </div>
            )}

            {/* Paystack */}
            {payMethod === 'paystack' && (
              <div>
                <button
                  onClick={initiatePaystack}
                  disabled={isSubmitting}
                  className="w-full bg-[#E8192C] text-white border-none cursor-pointer py-4 rounded-[10px] text-[1.25rem] tracking-[2px] transition-all duration-200 shadow-[0_4px_15px_rgba(232,25,44,0.3)] hover:bg-[#FF2E43] hover:-translate-y-px disabled:opacity-50"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  {isSubmitting ? 'PROCESSING...' : 'PAY WITH PAYSTACK →'}
                </button>
                <p className="text-[0.75rem] text-[#A0A0A0] text-center font-medium mt-3">
                  🔒 Secured by Paystack – Cards, Bank Transfers, USSD
                </p>
              </div>
            )}

            {/* Bank Transfer */}
            {payMethod === 'transfer' && (
              <div>
                <div className="bg-[#161616] p-4 rounded-[10px] mb-4 text-[0.9rem] text-center">
                  Transfer exactly <strong className="text-[#F5C300]">₦{total.toLocaleString()}</strong> to:<br /><br />
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.4rem', letterSpacing: '1px', color: '#fff' }}>0123456789</span><br />
                  Access Bank · Treats by Foodician
                  <p className="text-[0.7rem] text-yellow-400 mt-3">
                    ⚠️ Your order will be prepared only after the restaurant verifies the payment. This may take time.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Have you made the exact transfer? The restaurant will verify before cooking. Click OK only if you have paid.')) {
                      finaliseOrder();
                    }
                  }}
                  disabled={isSubmitting}
                  className="w-full bg-[#22C55E] text-white border-none cursor-pointer py-4 rounded-[10px] text-[1.25rem] tracking-[2px] transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  {isSubmitting ? 'PROCESSING...' : 'I HAVE COMPLETED THE TRANSFER →'}
                </button>
              </div>
            )}
          </div>{/* end scrollable body */}
        </div>
      </div>

      {/* Order Confirmed Overlay */}
      <div className={`fixed inset-0 z-[700] flex items-center justify-center p-6 bg-black/85 backdrop-blur-[15px] transition-opacity duration-300 ${showConfirm ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-[#0F0F0F] border border-[rgba(232,25,44,0.15)] rounded-[24px] p-9 max-w-[340px] w-full text-center shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          <div className="text-[3rem] mb-4">🎉</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.2rem', letterSpacing: '1px', color: '#fff' }} className="mb-2">
            {orderType === 'delivery' ? 'Delivery Confirmed!' : 'Order Received!'}
          </div>
          <p className="text-[0.85rem] text-[#A0A0A0] mb-5 leading-[1.5]">
            {orderType === 'delivery'
              ? 'Foodician is preparing your meal. Driver will be assigned shortly.'
              : 'Foodician kitchen staff have been alerted to package your meal boxes.'}
          </p>
          <div className="bg-[rgba(232,25,44,0.05)] border border-[rgba(232,25,44,0.15)] rounded-[14px] p-4 mb-4">
            <div className="text-[0.65rem] text-[#A0A0A0] tracking-[1.5px] uppercase mb-1 font-bold">
              {orderType === 'delivery' ? 'Est. Delivery' : 'Ready in'}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.6rem', color: '#E8192C', letterSpacing: '1px', lineHeight: 1 }}>
              {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              <small style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', color: '#fff', fontWeight: 500 }}> remaining</small>
            </div>
          </div>
          <div className={`rounded-[12px] p-4 mb-5 ${orderType === 'delivery' ? 'bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.3)]' : 'bg-[#161616] border border-[#262626]'}`}>
            <div className="text-[0.65rem] tracking-[1.5px] uppercase mb-1 font-bold" style={{ color: orderType === 'delivery' ? '#22C55E' : '#A0A0A0' }}>
              {orderType === 'delivery' ? '🔐 Your Delivery Code — Share with Rider' : 'Verification Code'}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.4rem', letterSpacing: '6px', color: '#F5C300', lineHeight: 1 }}>{confirmCode}</div>
            {orderType === 'delivery' && (
              <p style={{ fontSize: '0.72rem', color: '#22C55E', marginTop: 6, lineHeight: 1.4 }}>
                Show this code to your rider when they arrive. They must enter it to complete delivery.
              </p>
            )}
          </div>
          <button
            onClick={handlePrintReceipt}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-[10px] text-[1rem] tracking-[2px] transition-all duration-200 mb-3"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            🖨️ Print Receipt
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="w-full bg-[#E8192C] text-white border-none cursor-pointer py-4 rounded-[10px] text-[1.25rem] tracking-[2px] transition-all duration-200 shadow-[0_4px_15px_rgba(232,25,44,0.3)] hover:bg-[#FF2E43]"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {orderType === 'delivery' ? 'TRACK MY DELIVERY 🗺️' : 'GOT IT — ON MY WAY 🚀'}
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-[#161616] text-white border border-[#E8192C] px-5 py-3 rounded-[10px] text-[0.85rem] font-semibold z-[900] whitespace-nowrap shadow-[0_10px_25px_rgba(0,0,0,0.5)]">
          {toast}
        </div>
      )}
    </>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const sessionUser = useAppStore((s) => s.sessionUser);
  const cart = useAppStore((s) => s.cart);
  const cartCount = useAppStore((s) => s.cartCount);
  const cartMins = useAppStore((s) => s.cartMins);
  const initAuthListener = useAppStore((s) => s.initAuthListener);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<Category>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const bagRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    initAuthListener();
  }, [initAuthListener]);

  useEffect(() => {
    async function fetchMenu() {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('Failed to fetch menu:', error.message);
      } else {
        const transformed = (data ?? []).map((item: Record<string, unknown>) => ({
          id:        Number(item.id),
          name:      String(item.name ?? ''),
          desc:      String(item.description ?? ''),
          price:     Number(item.price ?? 0),
          image:     String(item.image_url || item.image || FALLBACK_IMAGE),
          image_url: item.image_url ? String(item.image_url) : undefined,
          mins:      Number(item.prep_time ?? 15),
          cat:       String(item.category ?? ''),
        }));
        setMenuItems(transformed);
      }
      setLoading(false);
    }
    fetchMenu();
  }, []);

  useEffect(() => {
    if (bagRef.current) {
      bagRef.current.classList.remove('animate-bop');
      void bagRef.current.offsetWidth;
      bagRef.current.classList.add('animate-bop');
    }
  }, [cart]);

  const filteredMenu = activeCat === 'all' ? menuItems : menuItems.filter((m) => m.cat === activeCat);
  const mins = cartMins();
  const count = cartCount();

  if (!sessionUser) {
    return <AuthGate />;
  }

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* Topbar */}
      <div className="bg-black border-b border-[rgba(232,25,44,0.15)] px-4 py-3.5 flex items-center justify-between flex-shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#6B000A] shadow-[0_0_12px_rgba(245,195,0,0.25)] flex items-center justify-center bg-black flex-shrink-0">
            <Image
              src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=100&q=80"
              alt="Logo"
              width={44}
              height={44}
              className="object-cover rounded-full"
            />
          </div>
          <div className="flex flex-col">
            <span
              className="text-white leading-none"
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', letterSpacing: '0.5px' }}
            >
              Treats by Foodician
            </span>
            <span className="text-[0.6rem] tracking-[2px] text-[#F5C300] uppercase font-bold mt-0.5">
              · Pickup & Delivery ·
            </span>
          </div>
        </div>
        <button
          ref={bagRef}
          onClick={() => setCartOpen(true)}
          className="relative cursor-pointer bg-transparent border-none flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-white fill-none stroke-2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          <div className="absolute -top-1 -right-1 bg-[#E8192C] text-white w-4 h-4 rounded-full text-[0.6rem] font-extrabold flex items-center justify-center shadow-[0_0_8px_#E8192C]">
            {count}
          </div>
        </button>
      </div>

      {/* Hero Section */}
      <div
        className="mx-4 mt-4 rounded-[14px] overflow-hidden border border-[rgba(232,25,44,0.3)] p-6 relative min-h-[140px] flex flex-col justify-center shadow-[0_10px_25px_rgba(0,0,0,0.5)]"
        style={{ background: 'linear-gradient(135deg, #000000 0%, #1a0204 50%, #6B000A 100%)' }}
      >
        <div
          className="absolute left-3 bottom-[-8px] pointer-events-none select-none opacity-[0.13] text-[#E8192C]"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '78px', whiteSpace: 'nowrap', letterSpacing: '1px', fontWeight: 900, transform: 'skewX(-4deg)' }}
        >
          FOODICIAN
        </div>
        <div
          className="absolute top-0 right-0 bottom-0 w-[45%] opacity-35 mix-blend-luminosity"
          style={{ background: "url('https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80') center/cover no-repeat", clipPath: 'polygon(25% 0, 100% 0, 100% 100%, 0% 100%)' }}
        />
        <div className="text-[0.65rem] tracking-[3px] uppercase text-[#F5C300] font-bold mb-1.5 flex items-center gap-1 relative z-[2]">
          🌶️ Pay ahead — pick up or delivered
        </div>
        <div
          className="relative z-[2]"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.4rem', letterSpacing: '1px', lineHeight: '0.95', color: '#fff', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
        >
          ORDER. PAY. ENJOY.
        </div>
        <div className="text-[0.8rem] text-[#A0A0A0] mt-1.5 max-w-[60%] font-normal relative z-[2]">
          Your hot local delicacies waiting when you arrive — or delivered to your door.
        </div>
      </div>

      {/* Pickup Time Strip */}
      <div className="mx-4 mt-4 mb-4 bg-[#0F0F0F] border border-[#262626] border-l-4 border-l-[#E8192C] rounded-[10px] px-4 py-3.5 flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
        <div>
          <div className="text-[0.6rem] text-[#A0A0A0] tracking-[1.5px] uppercase mb-0.5 font-bold">⏱ Ready time</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', color: '#E8192C', letterSpacing: '1px', lineHeight: 1 }}>
            {mins ? (
              <>
                {mins}
                <small style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', color: '#fff', marginLeft: '4px', fontWeight: 500 }}>mins</small>
              </>
            ) : (
              <>
                --
                <small style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', color: '#fff', marginLeft: '4px', fontWeight: 500 }}>mins</small>
              </>
            )}
          </div>
        </div>
        <div className="text-[0.75rem] text-[#A0A0A0] text-right leading-[1.4] font-medium">
          Updates in real-time<br />as you add items
        </div>
      </div>

      {/* Category Filter */}
      <div className="overflow-x-auto no-scrollbar border-b border-[#1a1a1a]">
        <div className="flex w-max px-2">
          {CATEGORIES.map(({ id, label }) => {
            const active = activeCat === id;
            return (
              <button
                key={id}
                onClick={() => setActiveCat(id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '0.625rem 1.1rem',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: active ? '#E8192C' : '#555',
                  borderBottom: active ? '2px solid #E8192C' : '2px solid transparent',
                  transition: 'color 0.18s, border-color 0.18s',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap',
                }}
              >
                {CAT_ICONS[id]}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Section Label */}
      <div
        className="px-4 mb-3 flex items-center gap-2"
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '2px', color: '#F5C300' }}
      >
        EXPLORE FRESH MENU
        <div className="flex-1 h-px bg-[#262626]" />
      </div>

      {/* Favourites Carousel */}
      <FavoritesCarousel />

      {/* Menu Grid */}
      <div className="px-4 pb-8">
        {loading ? (
          <LoadingScreen />
        ) : filteredMenu.length === 0 ? (
          <p className="text-center text-[#A0A0A0] text-[0.9rem] py-12">No items in this category.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMenu.map((item) => <MenuCard key={item.id} item={item} />)}
          </div>
        )}
      </div>

      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} menuItems={menuItems} />
    </div>
  );
}