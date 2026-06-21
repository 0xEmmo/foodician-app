"use client";

import { useEffect, useState } from "react";
import { Trophy, Gift } from "lucide-react";
import {
  getLoyaltyPoints, getLoyaltyTransactions, redeemLoyaltyPoints,
  getNextTierInfo, TIER_META, REDEMPTION_RATE, REDEMPTION_VALUE,
  type LoyaltyPoints, type LoyaltyTransaction,
} from "@/src/lib/loyalty";
import { useAppStore } from "@/src/store/useAppStore";

export default function LoyaltySection() {
  const sessionUser = useAppStore((s) => s.sessionUser);
  const topUpWallet = useAppStore((s) => s.topUpWallet);

  const [data,         setData]         = useState<LoyaltyPoints | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [redeeming,    setRedeeming]    = useState(false);
  const [msg,          setMsg]          = useState<string | null>(null);

  useEffect(() => {
    if (!sessionUser) return;
    Promise.all([
      getLoyaltyPoints(sessionUser.id),
      getLoyaltyTransactions(sessionUser.id),
    ]).then(([pts, txs]) => {
      setData(pts);
      setTransactions(txs);
      setLoading(false);
    });
  }, [sessionUser]);

  async function handleRedeem() {
    if (!sessionUser || !data || data.points < REDEMPTION_RATE) return;
    setRedeeming(true);
    const result = await redeemLoyaltyPoints(sessionUser.id);
    if (result.success && result.creditAdded) {
      await topUpWallet(result.creditAdded);
      setData((prev) => prev ? { ...prev, points: result.newPoints ?? 0 } : prev);
      setMsg(`₦${result.creditAdded.toLocaleString()} added to your wallet!`);
      setTimeout(() => setMsg(null), 4000);
    } else {
      setMsg(result.error ?? "Redemption failed.");
      setTimeout(() => setMsg(null), 3000);
    }
    setRedeeming(false);
  }

  if (loading) {
    return (
      <div className="bg-[#0F0F0F] rounded-2xl border border-[#262626] p-4 space-y-3 animate-pulse">
        <div className="h-4 bg-[#262626] rounded w-1/3" />
        <div className="h-16 bg-[#262626] rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[#0F0F0F] rounded-2xl border border-[#262626] p-4 text-center">
        <Trophy size={28} className="text-[#A0A0A0] mx-auto mb-2" />
        <p className="text-sm text-[#A0A0A0]">Place your first order to start earning points.</p>
      </div>
    );
  }

  const tier     = data.tier as keyof typeof TIER_META;
  const meta     = TIER_META[tier];
  const nextInfo = getNextTierInfo(data.total_earned, tier);

  return (
    <div className="space-y-3">
      {/* Tier card */}
      <div className={`rounded-2xl border p-4 ${meta.bg}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{meta.emoji}</span>
            <div>
              <p className={`text-sm font-semibold ${meta.color}`}>{meta.label} Member</p>
              <p className="text-xs text-[#A0A0A0]">{data.total_earned.toLocaleString()} pts earned total</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-[#F5F5F5]">{data.points.toLocaleString()}</p>
            <p className="text-xs text-[#A0A0A0]">points</p>
          </div>
        </div>

        {/* Progress to next tier */}
        {nextInfo.nextTier && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#A0A0A0]">
              <span>Progress to {TIER_META[nextInfo.nextTier].label}</span>
              <span>{nextInfo.pointsNeeded.toLocaleString()} pts away</span>
            </div>
            <div className="h-1.5 bg-[#262626] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#E8192C] rounded-full transition-all"
                style={{ width: `${nextInfo.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Redeem */}
      <div className="bg-[#0F0F0F] rounded-2xl border border-[#262626] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={16} className="text-[#F5C300]" />
          <p className="text-sm font-semibold text-[#F5F5F5]">Redeem Points</p>
        </div>
        <p className="text-xs text-[#A0A0A0] mb-3">
          Use {REDEMPTION_RATE.toLocaleString()} pts to get ₦{REDEMPTION_VALUE.toLocaleString()} wallet credit.
          You have <span className="text-[#F5F5F5] font-semibold">{data.points.toLocaleString()} pts</span>.
        </p>
        {msg && <p className="text-xs text-[#22C55E] mb-2">{msg}</p>}
        <button
          onClick={handleRedeem}
          disabled={data.points < REDEMPTION_RATE || redeeming}
          className="w-full py-2.5 rounded-xl bg-[#E8192C] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#FF2E43] transition-colors"
        >
          {redeeming ? "Redeeming…" : `Redeem ${REDEMPTION_RATE} pts → ₦${REDEMPTION_VALUE.toLocaleString()}`}
        </button>
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div className="bg-[#0F0F0F] rounded-2xl border border-[#262626] overflow-hidden">
          <p className="text-xs font-semibold text-[#A0A0A0] px-4 py-3 border-b border-[#262626] uppercase tracking-widest">History</p>
          <div className="divide-y divide-[#1a1a1a]">
            {transactions.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-[#F5F5F5]">
                    {tx.transaction_type === "earned" ? "Points earned" : "Points redeemed"}
                  </p>
                  <p className="text-[10px] text-[#A0A0A0]">
                    {new Date(tx.created_at).toLocaleDateString("en-NG")}
                  </p>
                </div>
                <span className={`text-sm font-bold ${tx.transaction_type === "earned" ? "text-[#22C55E]" : "text-[#E8192C]"}`}>
                  {tx.transaction_type === "earned" ? "+" : "−"}{(tx.points_earned ?? tx.points_redeemed ?? 0).toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
