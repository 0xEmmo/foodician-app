'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/src/lib/supabase';

const field = "w-full bg-[rgba(255,255,255,0.05)] border border-[#262626] rounded-[12px] py-3.5 pr-4 text-white outline-none transition-all focus:border-[#534AB7] placeholder:text-[#555]";

// useSearchParams must be inside a Suspense boundary in App Router
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ResetForm />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <PageShell>
      <div className="text-center py-6">
        <div className="w-8 h-8 rounded-full border-2 border-[#534AB7] border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-[0.8rem] text-[#555]">Verifying reset link…</p>
      </div>
    </PageShell>
  );
}

function ResetForm() {
  const router      = useRouter();
  const searchParams = useSearchParams();

  // PKCE flow sends ?code=XXX  |  Implicit flow uses URL hash (auto-parsed by supabase-js)
  const code = searchParams.get('code');

  type Stage = 'loading' | 'ready' | 'invalid' | 'done';
  const [stage,    setStage]    = useState<Stage>('loading');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // ── PKCE flow: exchange the one-time code for a session ────────────────
      if (code) {
        const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchErr) { setStage('invalid'); return; }
        setStage('ready');
        return;
      }

      // ── Implicit / hash flow: supabase-js parses the hash automatically ───
      // onAuthStateChange fires PASSWORD_RECOVERY when it succeeds
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (cancelled) return;
        if (event === 'PASSWORD_RECOVERY') setStage('ready');
      });

      // Fallback: if a session is already present (page refresh after exchange)
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) { subscription.unsubscribe(); return; }

      if (session) {
        setStage('ready');
      } else {
        // Give supabase-js 1.5 s to parse the hash and emit the event
        setTimeout(async () => {
          if (cancelled) return;
          const { data: { session: s } } = await supabase.auth.getSession();
          if (!s && !cancelled) setStage('invalid');
        }, 1500);
      }

      return () => { cancelled = true; subscription.unsubscribe(); };
    }

    bootstrap();
    return () => { cancelled = true; };
  }, [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8)    { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm)    { setError('Passwords do not match'); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) { setError(err.message); return; }

    // Sign out so they log back in fresh with the new password
    await supabase.auth.signOut();
    setStage('done');
    setTimeout(() => router.push('/'), 2500);
  };

  return (
    <PageShell>
      {stage === 'loading' && (
        <div className="text-center py-6">
          <div className="w-8 h-8 rounded-full border-2 border-[#534AB7] border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-[0.8rem] text-[#555]">Verifying reset link…</p>
        </div>
      )}

      {stage === 'invalid' && (
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-[#F5F5F5] font-semibold mb-2">Link expired or invalid</p>
          <p className="text-[0.8rem] text-[#666] mb-5 leading-relaxed">
            Reset links expire after 1 hour. Please request a new one.
          </p>
          <a
            href="/auth/forgot-password"
            className="block w-full text-center text-white py-3.5 rounded-[12px] text-[1rem] tracking-[1px]"
            style={{ fontFamily: "'Bebas Neue', sans-serif", background: '#534AB7' }}
          >
            Request New Link
          </a>
        </div>
      )}

      {stage === 'done' && (
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <p className="text-[#F5F5F5] font-semibold mb-2">Password updated!</p>
          <p className="text-[0.8rem] text-[#666]">Redirecting to sign in…</p>
        </div>
      )}

      {stage === 'ready' && (
        <>
          <p className="text-[0.875rem] text-[#666] mb-6 text-center">
            Choose a strong new password.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="relative">
              <LockIcon />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (min 8 chars)"
                className={`${field} pl-11`}
                autoFocus
              />
            </div>
            <div className="relative">
              <LockIcon />
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                className={`${field} pl-11`}
              />
            </div>

            {error && (
              <p className="text-[0.8rem] text-[#E8192C] flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white border-none cursor-pointer py-4 rounded-[12px] text-[1.1rem] tracking-[2px] transition-all disabled:opacity-50 mt-1 hover:opacity-90"
              style={{ fontFamily: "'Bebas Neue', sans-serif", background: loading ? '#3A328F' : '#534AB7' }}
            >
              {loading ? 'UPDATING…' : 'UPDATE PASSWORD →'}
            </button>
          </form>
        </>
      )}
    </PageShell>
  );
}

// ── Shared layout shell ────────────────────────────────────────────────────────
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col justify-end p-5"
      style={{ background: "linear-gradient(180deg,rgba(0,0,0,0.55) 0%,#050505 100%),url('https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=480&q=80') center/cover" }}
    >
      <div className="bg-[rgba(12,12,12,0.92)] backdrop-blur-[24px] border border-[#1f1f1f] rounded-[24px] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
        <div className="flex flex-col items-center mb-6">
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
        {children}
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    </span>
  );
}
