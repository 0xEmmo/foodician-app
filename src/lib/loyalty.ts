import { supabase } from "@/src/lib/supabase";

export type Tier = "bronze" | "silver" | "gold" | "platinum";

export const TIER_THRESHOLDS: Record<Tier, number> = {
  bronze:   0,
  silver:   5_000,
  gold:     15_000,
  platinum: 50_000,
};

export const TIER_MULTIPLIERS: Record<Tier, number> = {
  bronze:   1.0,
  silver:   1.1,
  gold:     1.25,
  platinum: 1.5,
};

// Foodician palette colours (no purple)
export const TIER_META: Record<Tier, { label: string; emoji: string; color: string; bg: string }> = {
  bronze:   { label: "Bronze",   emoji: "🥉", color: "text-amber-600",   bg: "bg-[#1a1000] border-amber-700/40"  },
  silver:   { label: "Silver",   emoji: "🥈", color: "text-gray-300",    bg: "bg-[#161616] border-gray-600/40"   },
  gold:     { label: "Gold",     emoji: "🥇", color: "text-[#F5C300]",   bg: "bg-[#1a1500] border-[#F5C300]/30"  },
  platinum: { label: "Platinum", emoji: "💎", color: "text-[#E8192C]",   bg: "bg-[#1a0005] border-[#E8192C]/30"  },
};

export const POINTS_PER_100  = 1;   // 1 pt per ₦100 spent
export const REDEMPTION_RATE  = 1_000;
export const REDEMPTION_VALUE = 10_000;  // ₦10,000 credited per redemption

export interface LoyaltyPoints {
  id: string;
  user_id: string;
  points: number;
  tier: Tier;
  total_earned: number;
  created_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  user_id: string;
  order_id: string | null;
  points_earned: number | null;
  points_redeemed: number | null;
  transaction_type: "earned" | "redeemed";
  created_at: string;
}

export function calculatePointsEarned(orderTotal: number, tier: Tier): number {
  const base = Math.floor(orderTotal / 100) * POINTS_PER_100;
  return Math.floor(base * TIER_MULTIPLIERS[tier]);
}

export function getTierFromTotalEarned(totalEarned: number): Tier {
  if (totalEarned >= TIER_THRESHOLDS.platinum) return "platinum";
  if (totalEarned >= TIER_THRESHOLDS.gold)     return "gold";
  if (totalEarned >= TIER_THRESHOLDS.silver)   return "silver";
  return "bronze";
}

export function getNextTierInfo(totalEarned: number, tier: Tier) {
  if (tier === "platinum") {
    return { nextTier: null as Tier | null, pointsNeeded: 0, progress: 100 };
  }
  const tiers: Tier[] = ["bronze", "silver", "gold", "platinum"];
  const nextTier = tiers[tiers.indexOf(tier) + 1] as Tier;
  const nextThreshold    = TIER_THRESHOLDS[nextTier];
  const currentThreshold = TIER_THRESHOLDS[tier];
  const progress = Math.min(
    100,
    Math.round(((totalEarned - currentThreshold) / (nextThreshold - currentThreshold)) * 100),
  );
  return { nextTier, pointsNeeded: nextThreshold - totalEarned, progress };
}

export async function getLoyaltyPoints(userId: string): Promise<LoyaltyPoints | null> {
  const { data } = await supabase
    .from("loyalty_points")
    .select("*")
    .eq("user_id", userId)
    .single();
  return (data as LoyaltyPoints) ?? null;
}

export async function getLoyaltyTransactions(userId: string): Promise<LoyaltyTransaction[]> {
  const { data } = await supabase
    .from("loyalty_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data as LoyaltyTransaction[]) ?? [];
}

export async function awardLoyaltyPoints(
  userId: string,
  orderId: string,
  orderTotal: number,
  tier: Tier = "bronze",
): Promise<number> {
  const points = calculatePointsEarned(orderTotal, tier);
  if (points <= 0) return 0;
  await supabase.rpc("award_loyalty_points", {
    p_user_id: userId,
    p_order_id: orderId,
    p_points:   points,
  });
  return points;
}

export async function redeemLoyaltyPoints(userId: string): Promise<{
  success: boolean;
  error?: string;
  creditAdded?: number;
  newPoints?: number;
}> {
  const { data, error } = await supabase.rpc("redeem_loyalty_points", {
    p_user_id: userId,
  });
  if (error) return { success: false, error: error.message };
  const result = data as { success: boolean; error?: string; credit_added?: number; new_points?: number };
  if (!result?.success) return { success: false, error: result?.error ?? "Redemption failed." };
  return { success: true, creditAdded: result.credit_added, newPoints: result.new_points };
}
