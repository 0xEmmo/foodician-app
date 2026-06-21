// Replaces the old window.print() approach with a real PDF download via html2pdf.js

function fmt(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    weekday: "long", day: "numeric", month: "long",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

interface ReceiptItem {
  name:     string;
  qty:      number;
  price:    number;
  subtotal: number;
}

interface ReceiptData {
  orderId:        string;
  customerName:   string;
  items:          ReceiptItem[];
  subtotal:       number;
  deliveryFee:    number;
  discount:       number;
  total:          number;
  paymentMethod:  string;
  orderType:      string;
  createdAt:      string;
}

function buildReceiptHTML(data: ReceiptData): string {
  const shortId = String(data.orderId).slice(0, 8).toUpperCase();

  const rows = data.items
    .map((item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1e1e1e;vertical-align:top;">
          <div style="font-weight:600;color:#F5F5F5;font-size:13px;">${item.name}</div>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #1e1e1e;text-align:center;color:#A0A0A0;font-size:13px;">×${item.qty}</td>
        <td style="padding:10px 0;border-bottom:1px solid #1e1e1e;text-align:right;font-weight:600;color:#F5C300;font-size:13px;white-space:nowrap;">${fmt(item.subtotal)}</td>
      </tr>`)
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:24px;background:#111111;font-family:'DM Sans',sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#0F0F0F;border-radius:16px;overflow:hidden;border:1px solid #1e1e1e;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#E8192C 0%,#6B000A 100%);padding:36px 32px 28px;text-align:center;">
      <div style="font-size:10px;color:rgba(255,255,255,0.55);letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">ORDER RECEIPT</div>
      <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.5px;line-height:1;">Treats by Foodician</div>
      <div style="background:rgba(255,255,255,0.18);border-radius:20px;display:inline-block;padding:5px 18px;margin-top:14px;">
        <span style="font-size:12px;color:#fff;font-weight:800;letter-spacing:2px;">#${shortId}</span>
      </div>
    </div>

    <!-- Meta -->
    <div style="background:#161616;padding:14px 24px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div>
        <div style="font-size:9px;color:#A0A0A0;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Date &amp; Time</div>
        <div style="font-size:12px;color:#F5F5F5;font-weight:600;margin-top:3px;line-height:1.3;">${fmtDate(data.createdAt)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:9px;color:#A0A0A0;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Order Type</div>
        <div style="font-size:13px;color:#E8192C;font-weight:800;margin-top:3px;text-transform:capitalize;">${data.orderType}</div>
      </div>
    </div>

    <div style="padding:11px 24px;background:#0F0F0F;border-bottom:1px solid #1e1e1e;">
      <span style="font-size:11px;color:#A0A0A0;">Customer: </span>
      <span style="font-size:12px;color:#F5F5F5;font-weight:600;">${data.customerName}</span>
      &nbsp;&nbsp;
      <span style="font-size:11px;color:#A0A0A0;">Payment: </span>
      <span style="font-size:12px;color:#F5F5F5;font-weight:600;text-transform:capitalize;">${data.paymentMethod}</span>
    </div>

    <!-- Items -->
    <div style="padding:20px 24px 8px;">
      <div style="font-size:9px;font-weight:700;color:#A0A0A0;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;">Order Items</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding-bottom:8px;font-size:9px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #1e1e1e;">Item</th>
            <th style="text-align:center;padding-bottom:8px;font-size:9px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #1e1e1e;">Qty</th>
            <th style="text-align:right;padding-bottom:8px;font-size:9px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #1e1e1e;">Price</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Totals -->
    <div style="padding:4px 24px 24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${data.discount > 0 ? `
          <tr>
            <td colspan="2" style="padding:7px 0;font-size:12px;color:#22C55E;font-weight:600;">Promo Discount</td>
            <td style="padding:7px 0;text-align:right;font-size:12px;color:#22C55E;font-weight:700;">-${fmt(data.discount)}</td>
          </tr>` : ""}
          ${data.deliveryFee > 0 ? `
          <tr>
            <td colspan="2" style="padding:7px 0;font-size:12px;color:#A0A0A0;">Delivery Fee</td>
            <td style="padding:7px 0;text-align:right;font-size:12px;color:#A0A0A0;">${fmt(data.deliveryFee)}</td>
          </tr>` : ""}
          <tr>
            <td colspan="2" style="padding:16px 0 8px;font-size:15px;font-weight:800;color:#F5F5F5;border-top:2.5px solid #E8192C;">Total Paid</td>
            <td style="padding:16px 0 8px;text-align:right;font-size:20px;font-weight:900;color:#E8192C;border-top:2.5px solid #E8192C;">${fmt(data.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="background:#050505;padding:24px 28px;text-align:center;border-top:1px solid #1e1e1e;">
      <div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:6px;">Thank you for your order!</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:12px;">We appreciate your business.</div>
      <div style="font-size:9px;color:rgba(255,255,255,0.2);letter-spacing:0.5px;">
        Order #${shortId} · Generated ${new Date().toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>

  </div>
</body>
</html>`;
}

export async function generateReceiptPDF(data: ReceiptData): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html2pdf = ((await import("html2pdf.js")) as any).default;
  const shortId  = String(data.orderId).slice(0, 8).toUpperCase();

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;left:-9999px;top:0;width:520px;";
  wrapper.innerHTML = buildReceiptHTML(data);
  document.body.appendChild(wrapper);

  try {
    await html2pdf()
      .from(wrapper.firstElementChild as HTMLElement)
      .set({
        margin:     [8, 0, 8, 0],
        filename:   `Foodician_Order_${shortId}.pdf`,
        image:      { type: "jpeg", quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF:      { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .save();
  } finally {
    document.body.removeChild(wrapper);
  }
}
