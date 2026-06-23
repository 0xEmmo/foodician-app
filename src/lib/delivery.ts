// Jaja Complex, UNILAG — restaurant origin for distance calc
export const RESTAURANT_LAT = 6.5205;
export const RESTAURANT_LNG = 3.3958;

const BASE_FEE    = 500;  // ₦500 minimum / UNILAG flat rate
const PER_KM_RATE = 350;  // ₦350 per km after first 1 km

export type DeliveryResult = {
  fee:       number;
  breakdown: string;
};

/**
 * Pure fee calculation (no network calls).
 * UNILAG mode: always ₦500 flat.
 * Outside mode: ₦500 base + ₦350 × max(0, distance_km − 1)
 */
export function calculateDeliveryFee(
  isUnilag: boolean,
  distance_km = 0,
): DeliveryResult {
  if (isUnilag) {
    return { fee: BASE_FEE, breakdown: 'UNILAG flat rate' };
  }
  const billableKm = Math.max(0, distance_km - 1);
  const fee        = BASE_FEE + Math.round(billableKm * PER_KM_RATE);
  return {
    fee,
    breakdown: billableKm === 0
      ? 'within 1 km (₦500 base)'
      : `₦500 base + ${billableKm.toFixed(1)} km × ₦350`,
  };
}
