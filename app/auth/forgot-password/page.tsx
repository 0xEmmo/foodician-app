'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/src/lib/supabase';

const field = "w-full bg-[rgba(255,255,255,0.05)] border border-[#262626] rounded-[12px] py-3.5 pr-4 text-white outline-none transition-all focus:border-[#534AB7] placeholder:text-[#555]";

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address'); return; }
    setLoading(true);
    setError('');

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  };

  return (
    <div
      className="min-h-screen flex flex-col justify-end p-5"
      style={{ background: "linear-gradient(180deg,rgba(0,0,0,0.55) 0%,#050505 100%),url('https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=480&q=80') center/cover" }}
    >
      <div className="bg-[rgba(12,12,12,0.92)] backdrop-blur-[24px] border border-[#1f1f1f] rounded-[24px] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
        <div className="flex flex-col items-center mb-5">
          <Image
            src="/logo.jpg"
            alt="Treats by Foodician"
            width={80}
            height={80}
            className="rounded-full border-2 border-[#6B000A] shadow-[0_0_24px_rgba(232,25,44,0.4)] mb-3"
          />
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.6rem', color: '#fff', letterSpacing: 1, textAlign: 'center' }}>
            Reset Password
          </div>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-4">📧</div>
            <p className="text-[#F5F5F5] font-semibold mb-2">Check your inbox</p>
            <p className="text-[0.8rem] text-[#666] mb-6 leading-relaxed">
              We sent a reset link to <span className="text-[#A0A0A0]">{email}</span>.
              Click it to set your new password.
            </p>
            <p className="text-[0.72rem] text-[#444]">
              Didn't get it? Check spam or{' '}
              <button
                onClick={() => setSent(false)}
                className="underline hover:text-[#666] transition-colors"
                style={{ color: '#534AB7', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit' }}
              >
                try again
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            <p className="text-[0.875rem] text-[#666] mb-6 text-center">
              Enter your email and we&apos;ll send a reset link.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 6 10-6"/></svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={`${field} pl-11`}
                />
              </div>

              {error && <p className="text-[0.8rem] text-[#E8192C]">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white border-none cursor-pointer py-4 rounded-[12px] text-[1.1rem] tracking-[2px] transition-all disabled:opacity-50 mt-1"
                style={{ fontFamily: "'Bebas Neue', sans-serif", background: '#534AB7' }}
              >
                {loading ? 'SENDING…' : 'SEND RESET LINK →'}
              </button>
            </form>
          </>
        )}

        <Link
          href="/"
          className="block w-full text-center text-[#555] text-[0.85rem] hover:text-[#A0A0A0] transition mt-2"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
