import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email, name, orderCode, total, items, mins } = await request.json();
    if (!email || !name) {
      return NextResponse.json({ error: 'Missing email or name' }, { status: 400 });
    }
    const { data, error } = await resend.emails.send({
      from: 'Treats by Foodician <onboarding@resend.dev>',
      to: [email],
      subject: `Order Confirmed #${orderCode}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h1 style="color: #E8192C;">Thank you, ${name}!</h1>
          <p>Order <strong>#${orderCode}</strong> has been received.</p>
          <p><strong>Total:</strong> ₦${total.toLocaleString()}</p>
          <p><strong>Items:</strong></p>
          <ul>${items.map((i: string) => `<li>${i}</li>`).join('')}</ul>
          <p>Ready in approx. ${mins} minutes.</p>
          <p>Code at pickup: <strong>${orderCode}</strong></p>
        </div>
      `,
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Email send error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}