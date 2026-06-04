'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/src/store/useAppStore';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

// ─── Transaction History Sheet ────────────────────────────────────────────────
function TxSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sessionUser = useAppStore((s) => s.sessionUser);
  const txs = sessionUser?.transactions ?? [];

  return (
    <div
      className={`fixed inset-0 z-[300] transition-opacity duration-300 bg-black/60 backdrop-blur-[12px] flex items-end justify-center ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
    >
      <div
        className={`bg-[rgba(15,15,15,0.85)] backdrop-blur-[20px] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] w-full max-w-[480px] rounded-t-[24px] p-5 pb-8 flex flex-col max-h-[85vh] transition-transform duration-400 ${open ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#262626] rounded-full mx-auto mb-5 flex-shrink-0" />
        <div className="flex-shrink-0 mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '1px', color: '#fff' }}>
          Transaction History 📄
        </div>
        <div className="overflow-y-auto no-scrollbar max-h-[50vh]">
          {txs.length === 0 ? (
            <div className="text-center text-[#A0A0A0] py-8">No transactions yet.</div>
          ) : (
            txs.map((tx, i) => (
              <div key={i} className="flex justify-between items-center py-4 border-b border-[#262626] last:border-b-0">
                <div className="flex flex-col gap-1">
                  <span className="text-[0.9rem] text-white font-medium">{tx.desc}</span>
                  <span className="text-[0.75rem] text-[#A0A0A0]">{tx.time}</span>
                </div>
                <span
                  style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '0.5px' }}
                  className={tx.type === 'credit' ? 'text-[#22C55E]' : 'text-[#E8192C]'}
                >
                  {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Top-up Sheet with Paystack integration ──────────────────────────────────
function TopupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sessionUser = useAppStore((s) => s.sessionUser);
  const topUpWallet = useAppStore((s) => s.topUpWallet);
  const [amount, setAmount] = useState('');
  const [toast, setToast] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2400);
  };

  const initiatePaystackTopup = () => {
    const val = parseInt(amount);
    if (isNaN(val) || val <= 0) {
      showToast('Enter a valid amount');
      return;
    }

    if (!sessionUser?.email) {
      showToast('Please log in first');
      return;
    }

    if (typeof window === 'undefined' || !window.PaystackPop) {
      showToast('Payment service not ready. Please refresh the page.');
      return;
    }

    setIsLoading(true);

    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!paystackKey || paystackKey === 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      showToast('Paystack key not configured. Please contact support.');
      setIsLoading(false);
      return;
    }

    const handler = window.PaystackPop.setup({
      key: paystackKey,
      email: sessionUser.email,
      amount: val * 100, // kobo
      currency: 'NGN',
      ref: 'TOPUP-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      callback: (response: any) => {
        // Payment successful – add funds to wallet
        topUpWallet(val);
        showToast(`✅ Successfully added ₦${val.toLocaleString()} to wallet`);
        setAmount('');
        onClose();
        setIsLoading(false);
      },
      onClose: () => {
        showToast('Payment cancelled. Your wallet was not funded.');
        setIsLoading(false);
      },
    });
    handler.openIframe();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[300] transition-opacity duration-300 bg-black/60 backdrop-blur-[12px] flex items-end justify-center ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      >
        <div
          className={`bg-[rgba(15,15,15,0.85)] backdrop-blur-[20px] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] w-full max-w-[480px] rounded-t-[24px] p-5 pb-8 flex flex-col max-h-[85vh] transition-transform duration-400 ${open ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-[#262626] rounded-full mx-auto mb-5 flex-shrink-0" />
          <div className="flex-shrink-0 mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '1px', color: '#fff' }}>
            Top Up Wallet 💳
          </div>
          <p className="text-[0.825rem] text-[#A0A0A0] mb-6 leading-[1.4]">Add funds to your Foodician wallet for instant, zero-fee checkouts.</p>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount to add (e.g. 5000)"
            className="bg-[#161616] border border-[#262626] rounded-[10px] px-4 py-3.5 text-white w-full outline-none transition-all duration-200 focus:border-[#E8192C] focus:shadow-[0_0_10px_rgba(232,25,44,0.1)] mb-6"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '1px' }}
          />
          <button
            onClick={initiatePaystackTopup}
            disabled={isLoading}
            className="w-full bg-[#E8192C] text-white border-none cursor-pointer py-4 rounded-[10px] text-[1.25rem] tracking-[2px] transition-all duration-200 shadow-[0_4px_15px_rgba(232,25,44,0.3)] hover:bg-[#FF2E43] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {isLoading ? 'PROCESSING...' : 'PROCEED TO PAYSTACK →'}
          </button>
          <p className="text-[0.75rem] text-[#A0A0A0] text-center font-medium mt-3">🔒 Secure Gateway Connection</p>
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

// ─── Profile Page ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const sessionUser = useAppStore((s) => s.sessionUser);
  const logout      = useAppStore((s) => s.logout);
  const router      = useRouter();

  const [txOpen,    setTxOpen]    = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const initial  = sessionUser?.name?.charAt(0).toUpperCase() ?? '?';
  const name     = sessionUser?.name ?? 'TREATS BY FOODICIAN';
  const email    = sessionUser?.email ?? 'MY ACCOUNT';
  const wallet   = sessionUser?.wallet ?? 0;

  return (
    <>
      <div className="px-5 py-6">

        {/* Profile header */}
        <div className="flex items-center gap-4 mb-6 mt-2">
          <div className="w-[52px] h-[52px] rounded-full border-[1.5px] border-[#E8192C] bg-black flex items-center justify-center shadow-[0_0_15px_rgba(232,25,44,0.3)] flex-shrink-0">
            <span className="text-[#E8192C] font-extrabold text-[1.25rem]">{initial}</span>
          </div>
          <div className="flex flex-col">
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '1px', color: '#fff', lineHeight: 1, textTransform: 'uppercase' }}>
              {name}
            </h1>
            <p className="text-[0.65rem] font-bold text-[#F5C300] tracking-[2px] mt-1 uppercase">{email}</p>
          </div>
        </div>

        {/* Wallet card */}
        <div className="bg-[#0F0F0F] rounded-[16px] p-6 mb-6 border border-[#262626] shadow-[0_8px_25px_rgba(0,0,0,0.5)]">
          <p className="text-[0.65rem] text-[#A0A0A0] font-extrabold tracking-[1.5px] mb-1.5 uppercase">Wallet Balance</p>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '3rem', color: '#F5C300', lineHeight: 1, letterSpacing: '1px' }} className="mb-5">
            ₦{wallet.toLocaleString()}
          </h2>
          <div className="flex justify-between items-center">
            <button
              onClick={() => setTxOpen(true)}
              className="bg-transparent border-none text-[#A0A0A0] text-[0.85rem] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors hover:text-white"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
              </svg>
              View Transactions ›
            </button>
            <button
              onClick={() => setTopupOpen(true)}
              className="bg-[#E8192C] text-white border-none rounded-lg px-5 py-2.5 font-bold text-[0.9rem] cursor-pointer transition-all hover:bg-[#FF2E43] hover:-translate-y-px shadow-[0_4px_12px_rgba(232,25,44,0.3)]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Top-up +
            </button>
          </div>
        </div>

        {/* Menu items */}
        <div className="flex flex-col gap-4">

          {/* Admin switch */}
          <Link
            href="/admin"
            className="w-full flex items-center justify-between p-4 bg-[#111] border-[1.5px] border-dashed border-[rgba(245,195,0,0.5)] rounded-[12px] cursor-pointer transition-all hover:bg-[#1a1a1a] no-underline"
          >
            <div className="flex items-center gap-3">
              <div className="w-[34px] h-[34px] bg-[#222] rounded-lg flex items-center justify-center text-[#A0A0A0]">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-[#F5C300] text-[0.85rem] font-semibold tracking-[0.3px]">[DEMO] Switch to Admin Portal</span>
            </div>
            <span className="text-[#F5C300] text-[1.4rem] font-semibold leading-none">→</span>
          </Link>

          {/* Main menu box */}
          <div className="bg-[#111] rounded-[12px] border border-[#262626] overflow-hidden">
            {/* User Profile */}
            <button className="w-full flex items-center justify-between p-4 bg-transparent border-none border-b border-white/[0.05] cursor-pointer transition-all hover:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <div className="w-[34px] h-[34px] bg-[#222] rounded-lg flex items-center justify-center text-[#818cf8]">
                  <svg fill="currentColor" viewBox="0 0 20 20" className="w-[18px] h-[18px]">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white text-[0.85rem] font-semibold tracking-[0.3px]">User Profile Details</span>
              </div>
              <span className="text-[#A0A0A0] text-[1.2rem] font-semibold leading-none">›</span>
            </button>

            {/* Rewards */}
            <button className="w-full flex items-center justify-between p-4 bg-transparent border-none border-b border-white/[0.05] cursor-pointer transition-all hover:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <div className="w-[34px] h-[34px] bg-[#222] rounded-lg flex items-center justify-center text-[#60a5fa]">
                  <svg fill="currentColor" viewBox="0 0 20 20" className="w-[18px] h-[18px]">
                    <path d="M2.11 7.182C3.12 4.103 6.275 2 9.9 2c3.626 0 6.78 2.103 7.79 5.182.2.61.42 1.25.64 1.918l.84 2.505c.34 1.01.21 2.14-.38 3.03l-2.02 3.03a3 3 0 01-2.5 1.335H5.73a3 3 0 01-2.5-1.335l-2.02-3.03a3.52 3.52 0 01-.38-3.03l.84-2.505c.22-.668.44-1.308.64-1.918zm4.51 3.522l1.65 2.47a1 1 0 001.66 0l1.65-2.47a1 1 0 00-.83-1.554H7.45a1 1 0 00-.83 1.554z" />
                  </svg>
                </div>
                <span className="text-white text-[0.85rem] font-semibold tracking-[0.3px]">Foodician Rewards</span>
              </div>
              <span className="text-[#A0A0A0] text-[1.2rem] font-semibold leading-none">›</span>
            </button>

            {/* Help */}
            <button className="w-full flex items-center justify-between p-4 bg-transparent border-none cursor-pointer transition-all hover:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <div className="w-[34px] h-[34px] bg-[#222] rounded-lg flex items-center justify-center text-[#ec4899]">
                  <svg fill="currentColor" viewBox="0 0 20 20" className="w-[18px] h-[18px]">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-white text-[0.85rem] font-semibold tracking-[0.3px]">Help & Support</span>
              </div>
              <span className="text-[#A0A0A0] text-[1.2rem] font-semibold leading-none">›</span>
            </button>
          </div>

          {/* Logout box */}
          <div className="bg-[#111] rounded-[12px] border border-[#262626] overflow-hidden mt-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-4 bg-transparent border-none cursor-pointer transition-all hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-3">
                <div className="w-[34px] h-[34px] bg-[#222] rounded-lg flex items-center justify-center text-[#E8192C]">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-[18px] h-[18px]">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <span className="text-[#E8192C] text-[0.85rem] font-semibold tracking-[0.3px]">Log Out Account</span>
              </div>
              <span className="text-[#A0A0A0] text-[1.2rem] font-semibold leading-none">›</span>
            </button>
          </div>

        </div>
      </div>

      {/* Sheets */}
      <TxSheet    open={txOpen}    onClose={() => setTxOpen(false)} />
      <TopupSheet open={topupOpen} onClose={() => setTopupOpen(false)} />
    </>
  );
}