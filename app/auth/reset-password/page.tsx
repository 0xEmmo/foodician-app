'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/src/lib/supabase';

const field = "w-full bg-[rgba(255,255,255,0.05)] border border-[#262626] rounded-[12px] py-3.5 pr-4 text-white outline-none transition-all focus:border-[#534AB7] placeholder:text-[#555]";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready,    setReady]    = useState(false);   // session confirmed
  const [invalid,  setInvalid]  = useState(false);   // link expired/invalid
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState('');

  // Supabase fires PASSWORD_RECOVERY when the reset link is followed
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // Also check if there's already an active recovery session (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
      else {
        // Give Supabase 1.5s to parse the hash from the URL and emit the event
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (!s) setInvalid(true);
          });
        }, 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm)  { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');

    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => router.push('/'), 2500);
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
            New Password
          </div>
        </div>

        {done && (
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <p className="text-[#F5F5F5] font-semibold mb-2">Password updated!</p>
            <p className="text-[0.8rem] text-[#666]">Taking you back to sign in…</p>
          </div>
        )}

        {!done && invalid && (
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-[#F5F5F5] font-semibold mb-2">Link expired or invalid</p>
            <p className="text-[0.8rem] text-[#666] mb-5">Reset links expire after 1 hour. Please request a new one.</p>
            <a
              href="/auth/forgot-password"
              className="block w-full text-center text-white py-3 rounded-[12px] text-[1rem] tracking-[1px]"
              style={{ fontFamily: "'Bebas Neue', sans-serif", background: '#534AB7' }}
            >
              Request New Link
            </a>
          </div>
        )}

        {!done && !invalid && !ready && (
          <div className="text-center py-6">
            <div className="w-8 h-8 rounded-full border-2 border-[#534AB7] border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-[0.8rem] text-[#555]">Verifying reset link…</p>
          </div>
        )}

        {!done && !invalid && ready && (
          <>
            <p className="text-[0.875rem] text-[#666] mb-6 text-center">
              Choose a strong new password.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  className={`${field} pl-11`}
                />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm new password"
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
                {loading ? 'UPDATING…' : 'SET NEW PASSWORD →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
