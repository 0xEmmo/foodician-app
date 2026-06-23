const PICKUP_RATE   = 0.05;  // 5% for pickup
const DELIVERY_RATE = 0.07;  // 7% for delivery (both UNILAG and outside)

/**
 * Returns the hidden service charge in Naira (rounded).
 * Never shown as a line item to the customer.
 */
export function calculateServiceCharge(
  subtotal:        number,
  fulfillmentType: 'pickup' | 'delivery',
): number {
  const rate = fulfillmentType === 'pickup' ? PICKUP_RATE : DELIVERY_RATE;
  return Math.round(subtotal * rate);
}
