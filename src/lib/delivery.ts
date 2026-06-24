import { haversineDistance } from './distance';

export const RESTAURANT_LAT = 6.5205;
export const RESTAURANT_LNG = 3.3958;

const UNILAG_FLAT_FEE  = 500;
const OUTSIDE_BASE_FEE = 500;
const OUTSIDE_PER_KM   = 200;

export type DeliveryConfig = {
  baseFee?:     number;
  perKmRate?:   number;
  unilagFee?:   number;
  freeFirstKm?: number;
};

export function calculateDeliveryFee(
  isUnilag: boolean,
  customerLat?: number,
  customerLng?: number,
  config?: DeliveryConfig,
): number {
  const unilagFee   = config?.unilagFee   ?? UNILAG_FLAT_FEE;
  const baseFee     = config?.baseFee     ?? OUTSIDE_BASE_FEE;
  const perKmRate   = config?.perKmRate   ?? OUTSIDE_PER_KM;
  const freeFirstKm = config?.freeFirstKm ?? 1;

  if (isUnilag) return unilagFee;
  if (!customerLat || !customerLng) return baseFee;

  const distanceKm = haversineDistance(
    RESTAURANT_LAT, RESTAURANT_LNG,
    customerLat,    customerLng,
  );

  if (distanceKm <= freeFirstKm) return baseFee;

  const extraKm = distanceKm - freeFirstKm;
  return Math.ceil(baseFee + extraKm * perKmRate);
}
