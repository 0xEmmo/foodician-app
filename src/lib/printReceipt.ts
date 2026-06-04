export const printReceipt = (order: {
  code: string;
  date: string;
  customer: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
}) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>Receipt - Treats by Foodician</title>
        <style>
          body { font-family: monospace; width: 300px; margin: 0 auto; padding: 20px; }
          h1 { font-size: 1.5rem; text-align: center; }
          hr { margin: 10px 0; }
          .items { width: 100%; margin: 10px 0; }
          .items td { padding: 4px 0; }
          .total { font-weight: bold; font-size: 1.2rem; text-align: right; margin-top: 10px; }
          .footer { text-align: center; margin-top: 20px; font-size: 0.8rem; }
        </style>
      </head>
      <body>
        <h1>Treats by Foodician</h1>
        <p>Order #${order.code}<br>${new Date(order.date).toLocaleString()}<br>${order.customer}</p>
        <hr>
        <table class="items">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
          <tbody>
            ${order.items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>₦${i.price.toLocaleString()}</td></tr>`).join('')}
          </tbody>
        </table>
        <hr>
        <div class="total">Total: ₦${order.total.toLocaleString()}</div>
        <div class="footer">Thank you for ordering!<br>Present this receipt at pickup.</div>
        <script>window.print();</script>
      </body>
    </html>
  `);
  printWindow.document.close();
};