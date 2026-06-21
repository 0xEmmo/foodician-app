import { supabase } from "@/src/lib/supabase";

export interface DeliveryAddress {
  id:           string;
  user_id:      string;
  address_name: string;
  street:       string;
  city:         string;
  state:        string;
  phone:        string;
  is_default:   boolean;
  created_at:   string;
}

export async function fetchUserAddresses(userId: string): Promise<DeliveryAddress[]> {
  const { data } = await supabase
    .from("delivery_addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at",  { ascending: false });
  return (data ?? []) as DeliveryAddress[];
}

export async function addAddress(
  userId: string,
  address: Omit<DeliveryAddress, "id" | "user_id" | "created_at">
): Promise<{ data: DeliveryAddress | null; error: string | null }> {
  if (address.is_default) {
    await supabase
      .from("delivery_addresses")
      .update({ is_default: false })
      .eq("user_id", userId);
  }
  const { data, error } = await supabase
    .from("delivery_addresses")
    .insert({ ...address, user_id: userId })
    .select()
    .single();
  return { data: data as DeliveryAddress | null, error: error?.message ?? null };
}

export async function updateAddress(
  userId: string,
  id: string,
  address: Partial<Omit<DeliveryAddress, "id" | "user_id" | "created_at">>
): Promise<{ error: string | null }> {
  if (address.is_default) {
    await supabase
      .from("delivery_addresses")
      .update({ is_default: false })
      .eq("user_id", userId);
  }
  const { error } = await supabase
    .from("delivery_addresses")
    .update(address)
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteAddress(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("delivery_addresses").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function setDefaultAddress(userId: string, id: string): Promise<{ error: string | null }> {
  await supabase
    .from("delivery_addresses")
    .update({ is_default: false })
    .eq("user_id", userId);
  const { error } = await supabase
    .from("delivery_addresses")
    .update({ is_default: true })
    .eq("id", id);
  return { error: error?.message ?? null };
}
