import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    // 1. Get order details
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('user_email, total_amount, payment_method')
      .eq('id', orderId)
      .single();
    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.payment_method !== 'wallet') {
      return NextResponse.json({ error: 'Only wallet payments can be auto-refunded' }, { status: 400 });
    }

    // 2. Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('wallet, transactions')
      .eq('email', order.user_email)
      .single();
    if (profileError) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // 3. Refund wallet
    const newWallet = profile.wallet + order.total_amount;
    const newTx = {
      type: 'credit',
      amount: order.total_amount,
      desc: `Refund for cancelled order #${orderId}`,
      time: new Date().toISOString(),
    };
    const newTransactions = [newTx, ...(profile.transactions || [])];

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ wallet: newWallet, transactions: newTransactions })
      .eq('email', order.user_email);
    if (updateError) {
      return NextResponse.json({ error: 'Refund failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Refund error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}