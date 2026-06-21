// Shim so Lumistro-derived lib files resolve their import without changes.
// All new feature libs import createClient from "@/src/lib/supabase/client".
import { createClient as _createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createClient() {
  return _createClient(supabaseUrl, supabaseAnonKey);
}
