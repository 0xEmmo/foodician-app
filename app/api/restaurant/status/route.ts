import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('restaurant_status')
      .select('is_open')
      .maybeSingle();
    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Default to open if table empty
    const isOpen = data ? data.is_open : true;
    return NextResponse.json({ is_open: isOpen });
  } catch (err) {
    console.error('GET restaurant status error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { is_open } = await request.json();
    if (typeof is_open !== 'boolean') {
      return NextResponse.json({ error: 'is_open must be a boolean' }, { status: 400 });
    }
    const { error } = await supabaseAdmin
      .from('restaurant_status')
      .upsert({ id: 1, is_open, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST restaurant status error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}