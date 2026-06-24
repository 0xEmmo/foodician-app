import { haversineDistance } from './distance';

export const RESTAURANT_LAT = 6.5205;
export const RESTAURANT_LNG = 3.3958;

const UNILAG_FLAT_FEE  = 500;
const OUTSIDE_BASE_FEE = 500;
const OUTSIDE_PER_KM   = 200;

export function calculateDeliveryFee(
  isUnilag: boolean,
  customerLat?: number,
  customerLng?: number,
): number {
  if (isUnilag) return UNILAG_FLAT_FEE;

  if (!customerLat || !customerLng) return OUTSIDE_BASE_FEE;

  const distanceKm = haversineDistance(
    RESTAURANT_LAT, RESTAURANT_LNG,
    customerLat,    customerLng,
  );

  if (distanceKm <= 1) return OUTSIDE_BASE_FEE;

  const extraKm = distanceKm - 1;
  return Math.ceil(OUTSIDE_BASE_FEE + extraKm * OUTSIDE_PER_KM);
}
