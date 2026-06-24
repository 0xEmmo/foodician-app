type NotifyPayload = {
  status:       'received' | 'cooking' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';
  customerName: string;
  items:        string[];
  total:        number;
  orderType?:   string;
  address?:     string;
};

export async function notifyTelegram(payload: NotifyPayload): Promise<void> {
  try {
    await fetch('/api/telegram/notify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch {
    // silent — notifications are best-effort
  }
}
