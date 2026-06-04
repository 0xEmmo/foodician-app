'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAppStore } from '@/src/store/useAppStore';
import MenuCard from '@/src/components/MenuCard';
import { supabase } from '@/src/lib/supabase';
import { printReceipt } from '@/src/lib/printReceipt';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

type Category = 'all' | 'pasta' | 'noodles' | 'protein' | 'sides';

type MenuItem = {
  id: number;
  name: string;
  desc: string;
  price: number;
  emoji: string;
  image: string;
  mins: number;
  cat: Category;
};

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: '🍽 All' },
  { id: 'pasta', label: '🍝 Spaghetti' },
  { id: 'noodles', label: '🍜 Indomie' },
  { id: 'protein', label: '🍗 Proteins' },
  { id: 'sides', label: '🍟 Sides' },
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

// ─── Auth Gate (Email/Password) ──────────────────────────────────────────────
function AuthGate() {
  const signUp = useAppStore((s) => s.signUp);
  const signIn = useAppStore((s) => s.signIn);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let result;
    if (isLogin) {
      result = await signIn(email, password);
    } else {
      if (!username.trim()) {
        setError('Username is required');
        setLoading(false);
        return;
      }
      result = await signUp(email, password, username);
    }

    if (result.error) {
      setError(result.error.message);
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-full flex flex-col justify-end p-6"
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, #050505 100%), url('https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=480&q=80') center/cover",
      }}
    >
      <div className="bg-[rgba(15,15,15,0.85)] backdrop-blur-[20px] border border-[#262626] rounded-[24px] p-8 shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
        <Image
          src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=100&q=80"
          alt="Logo"
          width={70}
          height={70}
          className="rounded-full border-2 border-[#6B000A] mb-4 shadow-[0_0_20px_rgba(232,25,44,0.4)]"
        />
        <div
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.5rem', color: '#fff', lineHeight: 1 }}
          className="mb-2"
        >
          Treats by<br />Foodician
        </div>
        <p className="text-[0.9rem] text-[#A0A0A0] mb-6 leading-[1.5]">
          {isLogin ? 'Sign in to your account' : 'Create a new account'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 mb-6">
          {!isLogin && (
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username (how you'll be seen)"
              className="bg-[#161616] border border-[#262626] rounded-[10px] px-4 py-3.5 text-white w-full outline-none focus:border-[#E8192C]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="bg-[#161616] border border-[#262626] rounded-[10px] px-4 py-3.5 text-white w-full outline-none focus:border-[#E8192C]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="bg-[#161616] border border-[#262626] rounded-[10px] px-4 py-3.5 text-white w-full outline-none focus:border-[#E8192C]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          />
          {error && <p className="text-[0.8rem] text-[#E8192C]">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#E8192C] text-white border-none cursor-pointer py-4 rounded-[10px] text-[1.25rem] tracking-[2px] transition-all duration-200 shadow-[0_4px_15px_rgba(232,25,44,0.3)] hover:bg-[#FF2E43] hover:-translate-y-px disabled:opacity-50"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {loading ? 'PROCESSING...' : isLogin ? 'SIGN IN →' : 'SIGN UP →'}
          </button>
        </form>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full text-center text-[#A0A0A0] text-[0.85rem] hover:text-white transition"
        >
          {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
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
  const cartTotal = useAppStore((s) => s.cartTotal);
  const cartMins = useAppStore((s) => s.cartMins);
  const sessionUser = useAppStore((s) => s.sessionUser);
  const clearCart = useAppStore((s) => s.clearCart);
  const addOrder = useAppStore((s) => s.addOrder);
  const addTransaction = useAppStore((s) => s.addTransaction);

  const [showPay, setShowPay] = useState(false);
  const [payMethod, setPayMethod] = useState<'wallet' | 'paystack' | 'transfer'>('wallet');
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmMins, setConfirmMins] = useState(0);
  const [toast, setToast] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [orderSnapshot, setOrderSnapshot] = useState<{
    code: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
  } | null>(null);

  const cartIds = Object.keys(cart).map(Number).filter((id) => cart[id] > 0);
  const total = cartTotal();
  const mins = cartMins();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  };

  // Check if restaurant is open
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

  // WhatsApp notification
  const sendWhatsAppNotification = (orderCode: string, itemsArray: string[], total: number) => {
    const phoneNumber = '2347074099721'; // Replace with actual restaurant WhatsApp number
    const itemsText = itemsArray.join('\n• ');
    const message = `🍽️ *NEW ORDER #${orderCode}* 🍽️\n\n*Customer:* ${sessionUser?.name}\n*Items:*\n• ${itemsText}\n\n*Total:* ₦${total.toLocaleString()}\n\n*Status:* Confirmed – prepare for pickup in ${mins} mins.`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // ─── Finalise order – only ONE insert via addOrder ─────────────────────────
  const finaliseOrder = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const code = crypto.randomUUID().replace(/-/g, '').substring(0, 4).toUpperCase();
    const itemsArray = cartIds.map((id) => {
      const m = menuItems.find((m) => m.id === id)!;
      return `${m.name} (x${cart[id]})`;
    });

    // Build receipt snapshot before clearing cart
    const receiptItems = cartIds.map(id => {
      const m = menuItems.find(m => m.id === id)!;
      return { name: m.name, quantity: cart[id], price: m.price };
    });
    setOrderSnapshot({ code, items: receiptItems, total });

    // ✅ Use addOrder – it will insert into Supabase and update local store
    addOrder({
      code,
      mins: mins ?? 15,
      total,
      items: itemsArray,
      time: new Date().toLocaleTimeString(),
      status: 'Confirmed',
      customer: sessionUser?.name ?? 'Guest',
      user_email: sessionUser?.email ?? '',      // for total_spent calculation
      payment_method: payMethod,                 // for refunds
    });

    // Notifications (non‑blocking)
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
          mins: mins ?? 15,
        }),
      });
    } catch (err) {
      console.error('Email send failed:', err);
    }

    setConfirmCode(code);
    setConfirmMins(mins ?? 15);
    clearCart();
    setShowPay(false);
    onClose();
    setShowConfirm(true);

    setIsSubmitting(false);
  };

  // Paystack payment
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
      ref: 'TBF-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
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

  // Wallet payment (fixed – no double deduction)
  const payWithWallet = () => {
    if (!sessionUser) return;
    if (sessionUser.wallet < total) {
      showToast('Insufficient wallet balance.');
      return;
    }
    addTransaction('debit', total, 'Paid for pickup order');
    finaliseOrder();
  };

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showConfirm && confirmMins > 0) {
      const endTime = Date.now() + confirmMins * 60 * 1000;
      interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining === 0) clearInterval(interval);
      }, 1000);
      setCountdown(confirmMins * 60);
    }
    return () => clearInterval(interval);
  }, [showConfirm, confirmMins]);

  const safeImage = (src: string) => (src && src.trim() !== '' ? src : FALLBACK_IMAGE);

  const handlePrintReceipt = () => {
    if (!orderSnapshot) return;
    printReceipt({
      code: orderSnapshot.code,
      date: new Date().toISOString(),
      customer: sessionUser?.name || 'Guest',
      items: orderSnapshot.items,
      total: orderSnapshot.total,
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
          className={`bg-[rgba(15,15,15,0.85)] backdrop-blur-[20px] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] w-full max-w-[480px] rounded-t-[24px] p-5 pb-8 flex flex-col max-h-[85vh] transition-transform duration-400 ${open ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-[#262626] rounded-full mx-auto mb-5 flex-shrink-0" />
          <div className="flex-shrink-0 mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '1px', color: '#fff' }}>
            Your Box Summary 🛒
          </div>
          <div className="overflow-y-auto flex-1 no-scrollbar">
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
            <div className="mt-auto pt-5 border-t border-[#262626] flex-shrink-0">
              <div className="flex justify-between items-center pb-4">
                <span className="text-[0.95rem] text-[#A0A0A0] font-medium">Subtotal</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: '#F5C300', letterSpacing: '0.5px' }}>₦{total.toLocaleString()}</span>
              </div>
              <div className="bg-[rgba(232,25,44,0.06)] border border-[rgba(232,25,44,0.15)] rounded-[10px] p-3.5 mb-5 text-[0.85rem] text-[#F5F5F5] flex items-center gap-2">
                ⏱️ Kitchen turnaround: <strong>Ready in approx. {mins} mins</strong>
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

      {/* Payment overlay (unchanged) */}
      <div
        className={`fixed inset-0 z-[300] transition-opacity duration-300 bg-black/60 backdrop-blur-[12px] flex items-end justify-center ${showPay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowPay(false)}
      >
        <div
          className={`bg-[rgba(15,15,15,0.85)] backdrop-blur-[20px] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] w-full max-w-[480px] rounded-t-[24px] p-5 pb-8 flex flex-col max-h-[85vh] transition-transform duration-400 ${showPay ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-[#262626] rounded-full mx-auto mb-5 flex-shrink-0" />
          <div className="flex-shrink-0 mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '1px', color: '#fff' }}>
            Complete Checkout
          </div>
          <p className="text-[0.825rem] text-[#A0A0A0] mb-6 leading-[1.4]">Pay securely ahead of arrival. The kitchen accepts instantly.</p>
          <div className="bg-[#161616] rounded-[12px] p-4 mb-6 flex justify-between items-center border border-[#262626]">
            <span className="text-[0.8rem] text-[#A0A0A0] font-semibold uppercase tracking-[1px]">Amount Payable</span>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', color: '#F5C300', letterSpacing: '1px' }}>₦{total.toLocaleString()}</span>
          </div>
          <div className="flex gap-3 mb-6 overflow-x-auto no-scrollbar">
            {(['wallet', 'paystack', 'transfer'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPayMethod(m)}
                className={`flex-1 min-w-[110px] py-3.5 px-2 rounded-[10px] border text-[0.8rem] font-semibold cursor-pointer transition-all duration-200 text-center ${payMethod === m ? 'bg-[rgba(232,25,44,0.1)] text-white border-[#E8192C] shadow-[0_0_15px_rgba(232,25,44,0.2),inset_0_0_8px_rgba(232,25,44,0.1)]' : 'bg-[#161616] text-[#A0A0A0] border-[#262626]'}`}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {m === 'wallet' ? '💰 Wallet Balance' : m === 'paystack' ? '💳 Card / Bank' : '🏦 Transfer'}
              </button>
            ))}
          </div>

          {/* Wallet payment */}
          {payMethod === 'wallet' && (
            <div>
              <div className="bg-[#161616] rounded-[12px] p-4 mb-3 flex justify-between items-center border border-[#262626]">
                <span className="text-[0.8rem] text-[#A0A0A0] font-semibold uppercase tracking-[1px]">Current Balance</span>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.8rem', color: '#F5C300', letterSpacing: '1px' }}>₦{(sessionUser?.wallet ?? 0).toLocaleString()}</span>
              </div>
              {sessionUser && sessionUser.wallet < total && (
                <p className="text-[0.75rem] text-[#E8192C] text-center mb-3">Insufficient wallet balance. Top up or select another method.</p>
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

          {/* Bank transfer */}
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
                  if (confirm("Have you made the exact transfer? The restaurant will verify before cooking. Click OK only if you have paid.")) {
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
        </div>
      </div>

      {/* Order Confirmed overlay */}
      <div className={`fixed inset-0 z-[700] flex items-center justify-center p-6 bg-black/85 backdrop-blur-[15px] transition-opacity duration-300 ${showConfirm ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-[#0F0F0F] border border-[rgba(232,25,44,0.15)] rounded-[24px] p-9 max-w-[340px] w-full text-center shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          <div className="text-[3rem] mb-4">🎉</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.2rem', letterSpacing: '1px', color: '#fff' }} className="mb-2">Order Received!</div>
          <p className="text-[0.85rem] text-[#A0A0A0] mb-5 leading-[1.5]">Foodician kitchen staff have been alerted to package your meal boxes.</p>
          <div className="bg-[rgba(232,25,44,0.05)] border border-[rgba(232,25,44,0.15)] rounded-[14px] p-4 mb-4">
            <div className="text-[0.65rem] text-[#A0A0A0] tracking-[1.5px] uppercase mb-1 font-bold">Pick up fresh in</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.6rem', color: '#E8192C', letterSpacing: '1px', lineHeight: 1 }}>
              {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
              <small style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', color: '#fff', fontWeight: 500 }}> remaining</small>
            </div>
          </div>
          <div className="bg-[#161616] border border-[#262626] rounded-[12px] p-4 mb-5">
            <div className="text-[0.65rem] text-[#A0A0A0] tracking-[1.5px] uppercase mb-1 font-bold">Verification Code</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.2rem', letterSpacing: '4px', color: '#F5C300', lineHeight: 1 }}>{confirmCode}</div>
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
            GOT IT — I AM ON MY WAY 🚀
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

  // Initialize auth listener once
  useEffect(() => {
    initAuthListener();
  }, [initAuthListener]);

  // Fetch menu items from Supabase
  useEffect(() => {
    async function fetchMenu() {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('Failed to fetch menu:', error.message);
      } else {
        const transformed = (data ?? []).map((item: any) => ({
          ...item,
          cat: item.category,
          image: item.image_url || item.image || FALLBACK_IMAGE,
        }));
        setMenuItems(transformed);
      }
      setLoading(false);
    }
    fetchMenu();
  }, []);

  // Animate bag on cart change
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
    <>
      {/* Topbar, Hero, Pickup strip, Category filter, Section label, Menu grid – unchanged */}
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
              · Pickup Only ·
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
          🌶️ Pay ahead — walk in — pick up
        </div>
        <div
          className="relative z-[2]"
          style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.4rem', letterSpacing: '1px', lineHeight: '0.95', color: '#fff', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
        >
          ORDER. PAY. PICKUP.
        </div>
        <div className="text-[0.8rem] text-[#A0A0A0] mt-1.5 max-w-[60%] font-normal relative z-[2]">
          Your hot local delicacies waiting when you arrive.
        </div>
      </div>

      <div className="mx-4 mt-4 mb-4 bg-[#0F0F0F] border border-[#262626] border-l-4 border-l-[#E8192C] rounded-[10px] px-4 py-3.5 flex items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
        <div>
          <div className="text-[0.6rem] text-[#A0A0A0] tracking-[1.5px] uppercase mb-0.5 font-bold">⏱ Estimated pickup time</div>
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

      <div className="overflow-x-auto no-scrollbar px-4 pb-4">
        <div className="flex gap-2.5 w-max">
          {CATEGORIES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveCat(id)}
              className={`px-4 py-2 rounded-lg border text-[0.8rem] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap ${
                activeCat === id
                  ? 'bg-[#E8192C] text-white border-[#E8192C] shadow-[0_0_16px_rgba(232,25,44,0.4)] -translate-y-px'
                  : 'bg-[#0F0F0F] text-[#A0A0A0] border-[#262626]'
              }`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="px-4 mb-3 flex items-center gap-2"
        style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem', letterSpacing: '2px', color: '#F5C300' }}
      >
        EXPLORE FRESH MENU
        <div className="flex-1 h-px bg-[#262626]" />
      </div>

      <div className="px-4 flex flex-col gap-4 mb-8">
        {loading ? (
          <LoadingScreen />
        ) : filteredMenu.length === 0 ? (
          <p className="text-center text-[#A0A0A0] text-[0.9rem] py-12">No items in this category.</p>
        ) : (
          filteredMenu.map((item) => <MenuCard key={item.id} item={item} />)
        )}
      </div>

      <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} menuItems={menuItems} />
    </>
  );
}