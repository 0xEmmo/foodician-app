import { NextRequest, NextResponse } from 'next/server';
import { RESTAURANT_LAT, RESTAURANT_LNG, calculateDeliveryFee } from '@/src/lib/delivery';

// Use the server-only key — never expose this to the client
const MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY_SECRET;

async function geocode(address: string): Promise<{ lat: number; lng: number; formatted: string }> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`;
  const res  = await fetch(url);
  const data = await res.json() as { results?: { geometry: { location: { lat: number; lng: number } }; formatted_address: string }[]; status: string };

  if (!data.results?.length) {
    throw new Error(`Address not found: "${address}" (Maps status: ${data.status})`);
  }
  const { lat, lng }    = data.results[0].geometry.location;
  const formatted       = data.results[0].formatted_address;
  return { lat, lng, formatted };
}

async function distanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): Promise<{ km: number; durationSec: number }> {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat1},${lng1}&destinations=${lat2},${lng2}&key=${MAPS_KEY}`;
  const res  = await fetch(url);
  const data = await res.json() as {
    rows?: { elements?: { status: string; distance?: { value: number }; duration?: { value: number } }[] }[];
  };

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK' || !element.distance) {
    throw new Error(`Could not calculate distance (Maps element status: ${element?.status ?? 'none'})`);
  }
  return {
    km:          Math.round((element.distance.value / 1000) * 100) / 100,
    durationSec: element.duration?.value ?? 0,
  };
}

// POST /api/checkout/calculate-delivery-fee
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      deliveryAddress?: string;
      isUnilag?:        boolean;
      prepTimeMinutes?: number;
    };

    const { deliveryAddress, isUnilag = false, prepTimeMinutes = 15 } = body;

    if (!MAPS_KEY) {
      return NextResponse.json({ error: 'Maps API key not configured on server.' }, { status: 500 });
    }

    // ── UNILAG flat rate — no geocoding needed ─────────────────────────────
    if (isUnilag) {
      const { fee, breakdown } = calculateDeliveryFee(true);
      return NextResponse.json({
        success:          true,
        deliveryFee:      fee,
        feeBreakdown:     breakdown,
        distanceKm:       0,
        estimatedMinutes: prepTimeMinutes + 10, // 10-min on-campus delivery
        deliveryAddress:  deliveryAddress || 'UNILAG Campus',
        deliveryLat:      RESTAURANT_LAT,
        deliveryLng:      RESTAURANT_LNG,
      });
    }

    // ── Outside UNILAG — geocode + distance calc ───────────────────────────
    if (!deliveryAddress || deliveryAddress.trim().length < 5) {
      return NextResponse.json({ error: 'Delivery address is required.' }, { status: 400 });
    }

    const { lat, lng, formatted } = await geocode(deliveryAddress);
    const { km, durationSec }     = await distanceKm(RESTAURANT_LAT, RESTAURANT_LNG, lat, lng);

    if (km > 20) {
      return NextResponse.json(
        { error: `Address is ${km} km away — maximum delivery radius is 20 km.` },
        { status: 400 },
      );
    }

    const { fee, breakdown } = calculateDeliveryFee(false, km);
    const estimatedMinutes   = Math.ceil(prepTimeMinutes + durationSec / 60);

    return NextResponse.json({
      success:          true,
      deliveryFee:      fee,
      feeBreakdown:     breakdown,
      distanceKm:       km,
      estimatedMinutes,
      deliveryAddress:  formatted,
      deliveryLat:      lat,
      deliveryLng:      lng,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delivery fee calculation failed.';
    console.error('[calculate-delivery-fee]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
