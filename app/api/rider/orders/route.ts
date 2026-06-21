import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Rider sees: Out for Delivery, Arrived, and today's Delivered
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('order_type', 'delivery')
    .or(`status.in.(Out for Delivery,Arrived),and(status.eq.Delivered,created_at.gte.${todayStart.toISOString()})`)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(request: Request) {
  const { id, status } = await request.json();
  // Rider can only move: Out for Delivery → Arrived, or Arrived → Delivered
  if (!id || !['Arrived', 'Delivered'].includes(status)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from('orders')
    .update({ status })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
