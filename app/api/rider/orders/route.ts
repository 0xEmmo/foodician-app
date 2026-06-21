import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  // Riders see delivery orders that are Ready, Out for Delivery, or Delivered today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('order_type', 'delivery')
    .or(`status.in.(Ready,Out for Delivery),and(status.eq.Delivered,created_at.gte.${todayStart.toISOString()})`)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(request: Request) {
  const { id, status } = await request.json();
  if (!id || !['Out for Delivery', 'Delivered'].includes(status)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from('orders')
    .update({ status })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
