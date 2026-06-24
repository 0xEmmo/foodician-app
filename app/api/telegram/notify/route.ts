import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramNotification, formatOrderMessage } from '@/src/lib/telegram';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      status:       string;
      customerName: string;
      items:        string[];
      total:        number;
      orderType?:   string;
      address?:     string;
    };

    const { data: config } = await supabaseAdmin
      .from('restaurant_config')
      .select('telegram_bot_token, telegram_chat_id')
      .maybeSingle();

    if (!config?.telegram_bot_token || !config?.telegram_chat_id) {
      return NextResponse.json({ ok: false, error: 'Telegram not configured' });
    }

    const message = formatOrderMessage(
      body.status as Parameters<typeof formatOrderMessage>[0],
      body.customerName,
      body.items,
      body.total,
      body.orderType,
      body.address,
    );

    const ok = await sendTelegramNotification(
      config.telegram_bot_token,
      config.telegram_chat_id,
      message,
    );

    return NextResponse.json({ ok });
  } catch (err) {
    console.error('Telegram notify error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
