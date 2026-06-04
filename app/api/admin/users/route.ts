import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  // 1. Fetch all profiles
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, name, wallet, created_at');

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  // 2. Fetch total spent per email from orders (using user_email column)
  const { data: spentData, error: spentError } = await supabaseAdmin
    .from('orders')
    .select('user_email, total_amount')
    .not('user_email', 'is', null);

  if (spentError) {
    return NextResponse.json({ error: spentError.message }, { status: 500 });
  }

  // 3. Calculate total spent per email
  const spentMap: Record<string, number> = {};
  (spentData ?? []).forEach((order: any) => {
    const email = order.user_email;
    if (email) {
      spentMap[email] = (spentMap[email] || 0) + order.total_amount;
    }
  });

  // 4. Merge totals into profiles
  const usersWithSpent = profiles.map(user => ({
    ...user,
    total_spent: spentMap[user.email] || 0,
  }));

  return NextResponse.json(usersWithSpent);
}