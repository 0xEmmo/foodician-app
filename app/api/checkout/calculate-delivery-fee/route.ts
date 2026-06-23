import { NextRequest, NextResponse } from 'next/server';
import { RESTAURANT_LAT, RESTAURANT_LNG, calculateDeliveryFee } from '@/src/lib/delivery';
import { haversineDistance } from '@/src/lib/distance';

const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY_SECRET;

async function geocode(address: string): Promise<{ lat: number; lng: number; formatted: string }> {
  const url  = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`;
  const res  = await fetch(url);
  const data = await res.json() as {
    results?: { geometry: { location: { lat: number; lng: number } }; formatted_address: string }[];
    status: string;
  };
  if (!data.results?.length) throw new Error(`Address not found (status: ${data.status})`);
  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng, formatted: data.results[0].formatted_address };
}

// POST /api/checkout/calculate-delivery-fee
// Fallback server-side route (checkout now calculates client-side with Haversine).
// Kept for server-triggered flows (e.g. email confirmations).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      deliveryAddress?: string;
      isUnilag?:        boolean;
      prepTimeMinutes?: number;
    };
    const { deliveryAddress, isUnilag = false, prepTimeMinutes = 15 } = body;

    if (isUnilag) {
      return NextResponse.json({
        success:          true,
        deliveryFee:      calculateDeliveryFee(true),
        distanceKm:       0,
        estimatedMinutes: prepTimeMinutes + 10,
        deliveryAddress:  deliveryAddress || 'UNILAG Campus',
      });
    }

    if (!MAPS_KEY) return NextResponse.json({ error: 'Maps key not configured.' }, { status: 500 });
    if (!deliveryAddress) return NextResponse.json({ error: 'Address required.' }, { status: 400 });

    const { lat, lng, formatted } = await geocode(deliveryAddress);
    const km                      = haversineDistance(RESTAURANT_LAT, RESTAURANT_LNG, lat, lng);

    if (km > 20) return NextResponse.json({ error: `${km.toFixed(1)} km exceeds 20 km radius.` }, { status: 400 });

    const fee = calculateDeliveryFee(false, lat, lng);
    return NextResponse.json({
      success:          true,
      deliveryFee:      fee,
      distanceKm:       Math.round(km * 100) / 100,
      estimatedMinutes: prepTimeMinutes + Math.ceil(km * 3),
      deliveryAddress:  formatted,
      deliveryLat:      lat,
      deliveryLng:      lng,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Calculation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
