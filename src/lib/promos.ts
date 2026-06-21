import { supabase } from "@/src/lib/supabase";

export interface PromoCode {
  id:               string;
  code:             string;
  discount_type:    "percentage" | "fixed";
  discount_value:   number;
  max_uses:         number | null;
  current_uses:     number;
  min_order_amount: number | null;
  expiry_date:      string | null;
  is_active:        boolean;
  description:      string | null;
  created_at:       string;
}

export function calculateDiscount(promo: PromoCode, subtotal: number): number {
  if (promo.discount_type === "percentage") {
    return Math.min(Math.round((subtotal * promo.discount_value) / 100), subtotal);
  }
  return Math.min(promo.discount_value, subtotal);
}

export async function validatePromoCode(
  code: string,
  userId: string,
  subtotal: number,
): Promise<{ valid: boolean; discount: number; message: string; promo: PromoCode | null }> {
  const { data } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("is_active", true)
    .single();

  if (!data) return { valid: false, discount: 0, message: "Invalid or inactive promo code.", promo: null };

  const promo = data as PromoCode;

  if (promo.expiry_date && new Date(promo.expiry_date) < new Date()) {
    return { valid: false, discount: 0, message: "This promo code has expired.", promo: null };
  }

  if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
    return { valid: false, discount: 0, message: "This promo code has reached its usage limit.", promo: null };
  }

  if (promo.min_order_amount !== null && subtotal < promo.min_order_amount) {
    return {
      valid: false, discount: 0,
      message: `Minimum order of ₦${promo.min_order_amount.toLocaleString()} required.`,
      promo: null,
    };
  }

  const { data: used } = await supabase
    .from("promo_usage")
    .select("id")
    .eq("promo_code_id", promo.id)
    .eq("user_id", userId)
    .single();

  if (used) return { valid: false, discount: 0, message: "You have already used this promo code.", promo: null };

  const discount = calculateDiscount(promo, subtotal);
  return { valid: true, discount, message: "Promo code applied! 🎉", promo };
}

export async function recordPromoUsage(
  userId:          string,
  promoId:         string,
  orderId:         string,
  discountApplied: number,
): Promise<void> {
  await Promise.all([
    supabase.from("promo_usage").insert({
      user_id:          userId,
      promo_code_id:    promoId,
      order_id:         orderId,
      discount_applied: discountApplied,
    }),
    supabase.rpc("increment_promo_uses", { p_promo_id: promoId }),
  ]);
}

// Admin helpers
export async function fetchAllPromos(): Promise<PromoCode[]> {
  const { data } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as PromoCode[];
}

export async function createPromo(data: Omit<PromoCode, "id" | "current_uses" | "created_at">): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("promo_codes")
    .insert({ ...data, code: data.code.toUpperCase(), current_uses: 0 });
  return { error: error?.message ?? null };
}

export async function deletePromo(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  return { error: error?.message ?? null };
}
