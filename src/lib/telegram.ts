export async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  message: string,
): Promise<boolean> {
  try {
    const res  = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
    const data = await res.json() as { ok: boolean };
    return data.ok;
  } catch (err) {
    console.error('Telegram notification failed:', err);
    return false;
  }
}

type TelegramStatus = 'received' | 'cooking' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';

export function formatOrderMessage(
  status:       TelegramStatus,
  customerName: string,
  items:        string[],
  total:        number,
  orderType?:   string,
  address?:     string,
): string {
  const itemsList = items.map(i => `• ${i}`).join('\n');
  const typeLabel  = orderType === 'delivery' ? '🛵 Delivery' : '🏪 Pickup';

  switch (status) {
    case 'received':
      return [
        `📱 <b>NEW ORDER RECEIVED</b>`,
        ``,
        `<b>Customer:</b> ${customerName}`,
        `<b>Type:</b> ${typeLabel}`,
        address ? `<b>Address:</b> ${address}` : '',
        `<b>Total:</b> ₦${total.toLocaleString()}`,
        ``,
        `<b>Items:</b>`,
        itemsList,
      ].filter(Boolean).join('\n');

    case 'cooking':
      return `👨‍🍳 <b>NOW COOKING</b>\n\n<b>Customer:</b> ${customerName}\n<b>Items:</b>\n${itemsList}`;

    case 'ready':
      return `🚀 <b>ORDER READY</b>\n\n<b>Customer:</b> ${customerName}\n${typeLabel} — please ${orderType === 'delivery' ? 'dispatch rider' : 'notify customer to collect'}.`;

    case 'out_for_delivery':
      return `🛵 <b>OUT FOR DELIVERY</b>\n\n<b>Customer:</b> ${customerName}\n${address ? `<b>Address:</b> ${address}` : ''}`;

    case 'completed':
      return `✔️ <b>ORDER COMPLETED</b>\n\n<b>Customer:</b> ${customerName}\n<b>Total:</b> ₦${total.toLocaleString()}`;

    case 'cancelled':
      return `❌ <b>ORDER CANCELLED</b>\n\n<b>Customer:</b> ${customerName}\n<b>Total:</b> ₦${total.toLocaleString()}`;
  }
}
