import { supabase } from "@/src/lib/supabase";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function getOrCreateReferralCode(userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();

  if ((profile as { referral_code?: string } | null)?.referral_code) {
    return (profile as { referral_code: string }).referral_code;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase
      .from("profiles")
      .update({ referral_code: code })
      .eq("id", userId);
    if (!error) return code;
  }

  return null;
}

export interface ReferralStats {
  code:        string;
  referralUrl: string;
  pending:     number;
  completed:   number;
  earned:      number;
  list: Array<{ id: string; status: string; created_at: string; reward_amount: number }>;
}

export async function getReferralStats(userId: string): Promise<ReferralStats | null> {
  const code = await getOrCreateReferralCode(userId);
  if (!code) return null;

  const { data: referrals } = await supabase
    .from("referrals")
    .select("id, status, created_at, reward_amount")
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false });

  const list = (referrals ?? []) as Array<{ id: string; status: string; created_at: string; reward_amount: number }>;
  const completed = list.filter((r) => r.status === "completed").length;
  const pending   = list.filter((r) => r.status === "pending").length;
  const earned    = list.filter((r) => r.status === "completed").reduce((s, r) => s + r.reward_amount, 0);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return { code, referralUrl: `${baseUrl}/invite?ref=${code}`, pending, completed, earned, list };
}

export async function applyReferralCode(
  code:             string,
  referredUserId:   string,
): Promise<{ success: boolean; error: string | null }> {
  const { data, error } = await supabase.rpc("use_referral_code", {
    p_code:              code.toUpperCase().trim(),
    p_referred_user_id: referredUserId,
  });
  if (error) return { success: false, error: error.message };
  const result = data as { success: boolean; error?: string };
  return { success: result.success, error: result.error ?? null };
}
