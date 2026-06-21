'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Check, ChevronRight, ChevronDown, MapPin, Gift, Trophy, Shield, LogOut, HelpCircle, Wallet, ClipboardList } from 'lucide-react';
import { useAppStore } from '@/src/store/useAppStore';
import LoyaltySection from '@/src/components/LoyaltySection';
import AddressManager from '@/src/components/AddressManager';
import { getReferralStats, type ReferralStats } from '@/src/lib/referrals';

interface PaystackHandler { openIframe: () => void; }
interface PaystackPopStatic { setup: (cfg: Record<string, unknown>) => PaystackHandler; }
declare global {
  interface Window { PaystackPop: PaystackPopStatic; }
}

const ADMIN_EMAIL = 'emmospeak@gmail.com';

// ─── Transaction History Sheet ──────────────────────────────────────────────
function TxSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const txs = useAppStore((s) => s.sessionUser?.transactions ?? []);
  return (
    <div
      className={`fixed inset-0 z-[300] transition-opacity duration-300 bg-black/60 backdrop-blur-[12px] flex items-end justify-center ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      onClick={onClose}
    >
      <div
        className={`bg-[rgba(15,15,15,0.92)] backdrop-blur-[20px] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] w-full max-w-[480px] rounded-t-[24px] p-5 pb-8 flex flex-col max-h-[85vh] transition-transform duration-400 ${open ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#262626] rounded-full mx-auto mb-5 flex-shrink-0" />
        <div className="flex-shrink-0 mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', letterSpacing: '1px', color: '#fff' }}>
          Transaction History
        </div>
        <div className="overflow-y-auto no-scrollbar max-h-[50vh]">
          {txs.length === 0 ? (
            <div className="text-center text-[#A0A0A0] py-8">No transactions yet.</div>
          ) : (
            txs.map((tx, i) => (
              <div key={i} className="flex justify-between items-center py-4 border-b border-[#1a1a1a] last:border-b-0">
                <div className="flex flex-col gap-1">
                  <span className="text-[0.9rem] text-white font-medium">{tx.desc}</span>
                  <span className="text-[0.75rem] text-[#A0A0A0]">{tx.time}</span>
                </div>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem' }}
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

// ─── Top-up Sheet ───────────────────────────────────────────────────────────
function TopupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sessionUser = useAppStore((s) => s.sessionUser);
  const topUpWallet = useAppStore((s) => s.topUpWallet);
  const [amount, setAmount] = useState('');
  const [toast,  setToast]  = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400); };

  const initiatePaystackTopup = () => {
    const val = parseInt(amount);
    if (isNaN(val) || val <= 0) { showToast('Enter a valid amount'); return; }
    if (!sessionUser?.email) { showToast('Please log in first'); return; }
    if (typeof window === 'undefined' || !window.PaystackPop) { showToast('Payment service not ready. Please refresh.'); return; }
    setIsLoading(true);
    const paystackKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!paystackKey || paystackKey === 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      showToast('Paystack key not configured.'); setIsLoading(false); return;
    }
    const handler = window.PaystackPop.setup({
      key: paystackKey, email: sessionUser.email, amount: val * 100, currency: 'NGN',
      ref: 'TOPUP-' + crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase(),
      callback: () => { topUpWallet(val); showToast(`✅ Added ₦${val.toLocaleString()} to wallet`); setAmount(''); onClose(); setIsLoading(false); },
      onClose: () => { showToast('Payment cancelled.'); setIsLoading(false); },
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
          className={`bg-[rgba(15,15,15,0.92)] backdrop-blur-[20px] border-t border-white/10 w-full max-w-[480px] rounded-t-[24px] p-5 pb-8 flex flex-col transition-transform duration-400 ${open ? 'translate-y-0' : 'translate-y-full'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1 bg-[#262626] rounded-full mx-auto mb-5" />
          <div className="mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: '#fff' }}>Top Up Wallet</div>
          <p className="text-[0.825rem] text-[#A0A0A0] mb-6 leading-[1.4]">Add funds to your Foodician wallet for instant checkouts.</p>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (e.g. 5000)"
            className="bg-[#161616] border border-[#262626] rounded-[10px] px-4 py-3.5 text-white w-full outline-none focus:border-[#E8192C] mb-6"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem' }}
          />
          <button
            onClick={initiatePaystackTopup} disabled={isLoading}
            className="w-full bg-[#E8192C] text-white py-4 rounded-[10px] text-[1.25rem] tracking-[2px] hover:bg-[#FF2E43] disabled:opacity-50"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {isLoading ? 'PROCESSING...' : 'PROCEED TO PAYSTACK →'}
          </button>
          <p className="text-[0.75rem] text-[#A0A0A0] text-center mt-3">🔒 Secure Payment</p>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-[84px] left-1/2 -translate-x-1/2 bg-[#161616] text-white border border-[#E8192C] px-5 py-3 rounded-[10px] text-[0.85rem] font-semibold z-[900] whitespace-nowrap">
          {toast}
        </div>
      )}
    </>
  );
}

// ─── Referral Panel ─────────────────────────────────────────────────────────
function ReferralPanel({ userId }: { userId: string }) {
  const [stats,   setStats]   = useState<ReferralStats | null>(null);
  const [copied,  setCopied]  = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReferralStats(userId).then((s) => { setStats(s); setLoading(false); });
  }, [userId]);

  const copyCode = () => {
    if (!stats?.code) return;
    navigator.clipboard.writeText(stats.referralUrl ?? stats.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div style={{ height: 80, margin: '0 1rem 1rem', borderRadius: 12, background: '#161616' }} />;
  if (!stats)  return null;

  return (
    <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ background: '#0F0F0F', borderRadius: 12, border: '1px solid #262626', padding: '0.875rem 1rem' }}>
        <p style={{ fontSize: 10, color: '#A0A0A0', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Your Referral Code</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.75rem', color: '#F5C300', letterSpacing: 4 }}>
            {stats.code ?? '—'}
          </span>
          <button
            onClick={copyCode}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: copied ? '#22C55E' : '#A0A0A0', background: 'none', border: '1px solid #262626', borderRadius: 8, padding: '0.375rem 0.75rem', cursor: 'pointer' }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Pending',   value: stats.pending,   color: '#F5C300' },
          { label: 'Completed', value: stats.completed, color: '#22C55E' },
          { label: 'Earned',    value: `₦${(stats.earned ?? 0).toLocaleString()}`, color: '#E8192C' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#0F0F0F', border: '1px solid #262626', borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.25rem', color }}>{value}</div>
            <div style={{ fontSize: 10, color: '#A0A0A0', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: '#A0A0A0', textAlign: 'center' }}>
        Earn <span style={{ color: '#F5C300', fontWeight: 600 }}>₦2,000</span> wallet credit for every friend who completes their first order.
      </p>
    </div>
  );
}

// ─── Profile Row ─────────────────────────────────────────────────────────────
function Row({
  icon, label, desc, badge, onClick, expanded, danger, children,
}: {
  icon: React.ReactNode; label: string; desc?: string; badge?: string;
  onClick?: () => void; expanded?: boolean; danger?: boolean; children?: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid #1a1a1a' }}>
      <button
        onClick={onClick}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem', background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default', textAlign: 'left' }}
      >
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: danger ? '#E8192C' : '#888', flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: danger ? '#E8192C' : '#F5F5F5' }}>{label}</div>
          {desc && <div style={{ fontSize: '0.75rem', color: '#A0A0A0', marginTop: 2 }}>{desc}</div>}
        </div>
        {badge && <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F5C300' }}>{badge}</span>}
        {onClick && (
          expanded !== undefined
            ? <ChevronDown size={16} color="#444" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            : <ChevronRight size={16} color="#444" />
        )}
      </button>
      {expanded && children && <div>{children}</div>}
    </div>
  );
}

// ─── Profile Page ────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const sessionUser = useAppStore((s) => s.sessionUser);
  const logout      = useAppStore((s) => s.logout);
  const router      = useRouter();

  const [txOpen,       setTxOpen]       = useState(false);
  const [topupOpen,    setTopupOpen]    = useState(false);
  const [rewardsOpen,  setRewardsOpen]  = useState(false);
  const [addressOpen,  setAddressOpen]  = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);

  const handleLogout = () => { logout(); router.push('/'); };

  const isAdmin = sessionUser?.email === ADMIN_EMAIL;
  const initial = sessionUser?.name?.charAt(0).toUpperCase() ?? '?';
  const name    = sessionUser?.name  ?? 'Foodician User';
  const email   = sessionUser?.email ?? '';
  const wallet  = sessionUser?.wallet ?? 0;

  return (
    <>
      <div style={{ minHeight: '100%', background: '#050505', fontFamily: "'DM Sans', sans-serif" }}>

        {/* Profile header */}
        <div style={{ padding: '1.25rem 1rem 1.25rem', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(232,25,44,0.1)', border: '1.5px solid rgba(232,25,44,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#E8192C', fontWeight: 800, fontSize: '1.35rem' }}>{initial}</span>
          </div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.35rem', letterSpacing: 1, color: '#fff', textTransform: 'uppercase', lineHeight: 1 }}>
              {name}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#A0A0A0', marginTop: 3 }}>{email}</div>
          </div>
        </div>

        {/* Admin Dashboard – only for admin email */}
        {isAdmin && (
          <div style={{ borderBottom: '1px solid #1a1a1a' }}>
            <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem', textDecoration: 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(232,25,44,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E8192C', flexShrink: 0 }}>
                <Shield size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#F5F5F5' }}>Admin Dashboard</div>
                <div style={{ fontSize: '0.75rem', color: '#A0A0A0', marginTop: 2 }}>Manage orders, products &amp; settings</div>
              </div>
              <ChevronRight size={16} color="#444" />
            </Link>
          </div>
        )}

        {/* Wallet */}
        <div style={{ borderBottom: '1px solid #1a1a1a', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', flexShrink: 0 }}>
            <Wallet size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#F5F5F5' }}>Wallet</div>
            <div style={{ fontSize: '0.75rem', color: '#A0A0A0', marginTop: 2 }}>
              Balance: <span style={{ color: '#F5C300', fontWeight: 700 }}>₦{wallet.toLocaleString()}</span>
            </div>
          </div>
          <button
            onClick={() => setTopupOpen(true)}
            style={{ background: '#E8192C', color: '#fff', border: 'none', borderRadius: 8, padding: '0.375rem 0.875rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Top Up
          </button>
          <button
            onClick={() => setTxOpen(true)}
            style={{ background: '#161616', color: '#A0A0A0', border: '1px solid #262626', borderRadius: 8, padding: '0.375rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            History
          </button>
        </div>

        {/* Order History */}
        <div style={{ borderBottom: '1px solid #1a1a1a' }}>
          <Link href="/orders" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem', textDecoration: 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', flexShrink: 0 }}>
              <ClipboardList size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#F5F5F5' }}>Order History</div>
              <div style={{ fontSize: '0.75rem', color: '#A0A0A0', marginTop: 2 }}>View your past orders</div>
            </div>
            <ChevronRight size={16} color="#444" />
          </Link>
        </div>

        {/* Delivery Addresses */}
        <Row
          icon={<MapPin size={18} />}
          label="Delivery Addresses"
          desc="Manage saved locations"
          expanded={addressOpen}
          onClick={() => setAddressOpen((v) => !v)}
        >
          <div style={{ padding: '0 1rem 1rem' }}>
            <AddressManager />
          </div>
        </Row>

        {/* Loyalty Points */}
        <Row
          icon={<Trophy size={18} />}
          label="Loyalty Points"
          desc="Earn & redeem points on every order"
          expanded={rewardsOpen}
          onClick={() => setRewardsOpen((v) => !v)}
        >
          {sessionUser && <div style={{ padding: '0 1rem 1rem' }}><LoyaltySection /></div>}
        </Row>

        {/* Referrals & Rewards */}
        <Row
          icon={<Gift size={18} />}
          label="Referrals & Rewards"
          desc="Invite friends, earn ₦2,000 each"
          expanded={referralOpen}
          onClick={() => setReferralOpen((v) => !v)}
        >
          {sessionUser && <ReferralPanel userId={sessionUser.id} />}
        </Row>

        {/* Help & Support */}
        <Row
          icon={<HelpCircle size={18} />}
          label="Help & Support"
          desc="Get in touch with us"
          onClick={() => {}}
        />

        {/* Log Out */}
        <Row
          icon={<LogOut size={18} />}
          label="Log Out"
          onClick={handleLogout}
          danger
        />

      </div>

      <TxSheet    open={txOpen}    onClose={() => setTxOpen(false)} />
      <TopupSheet open={topupOpen} onClose={() => setTopupOpen(false)} />
    </>
  );
}
