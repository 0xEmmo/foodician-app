import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Restaurant coordinates - UPDATE THESE WITH YOUR ACTUAL LOCATION
const RESTAURANT_LAT = 6.6271; // Lagos latitude (example)
const RESTAURANT_LNG = 3.3955; // Lagos longitude (example)

// Delivery pricing configuration
const BASE_FEE = 500; // ₦500 base fee
const PER_KM_RATE = 150; // ₦150 per km
const MAX_FEE = 5000; // ₦5000 maximum cap
const MAX_RADIUS_KM = 15; // 15 km maximum delivery radius

/**
 * Get coordinates from delivery address using Google Geocoding API
 */
async function getCoordinatesFromAddress(address: string) {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${GOOGLE_MAPS_API_KEY}`
    );

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error(`Address not found: "${address}"`);
    }

    const { lat, lng } = data.results[0].geometry.location;
    const formatted_address = data.results[0].formatted_address;

    return { lat, lng, formatted_address };
  } catch (error) {
    throw new Error(
      `Geocoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculate distance and duration between two points using Google Distance Matrix API
 */
async function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?` +
      `origins=${lat1},${lng1}&` +
      `destinations=${lat2},${lng2}&` +
      `key=${GOOGLE_MAPS_API_KEY}`
    );

    const data = await response.json();

    // Check if we got valid results
    if (
      !data.rows ||
      !data.rows[0] ||
      !data.rows[0].elements ||
      !data.rows[0].elements[0] ||
      !data.rows[0].elements[0].distance
    ) {
      throw new Error('Could not calculate distance from Google Maps API');
    }

    const element = data.rows[0].elements[0];

    if (element.status === 'ZERO_RESULTS') {
      throw new Error('No route found between restaurant and delivery address');
    }

    if (element.status !== 'OK') {
      throw new Error(`Google Maps API error: ${element.status}`);
    }

    const distanceMeters = element.distance.value;
    const durationSeconds = element.duration.value;
    const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100; // Round to 2 decimals

    return { distanceKm, durationSeconds };
  } catch (error) {
    throw new Error(
      `Distance calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculate delivery fee based on distance
 * Formula: BASE_FEE + (distance - 2km) * PER_KM_RATE, capped at MAX_FEE
 */
function calculateDeliveryFee(distanceKm: number): number {
  let fee = BASE_FEE;

  // Charge per km only after first 2km
  if (distanceKm > 2) {
    fee += (distanceKm - 2) * PER_KM_RATE;
  }

  // Cap at maximum fee
  return Math.min(fee, MAX_FEE);
}

/**
 * Calculate estimated delivery time
 * Formula: prep time + delivery time
 */
function getEstimatedTime(
  durationSeconds: number,
  prepTimeMinutes: number = 15
): number {
  const totalSeconds = prepTimeMinutes * 60 + durationSeconds;
  const minutes = Math.ceil(totalSeconds / 60);
  return minutes;
}

/**
 * Main API handler
 * POST /api/checkout/calculate-delivery-fee
 * 
 * Request body:
 * {
 *   "deliveryAddress": "Ikoyi, Lagos",
 *   "prepTimeMinutes": 15
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "deliveryAddress": "Ikoyi, Lagos, Nigeria",
 *   "deliveryLat": 6.4969,
 *   "deliveryLng": 3.4339,
 *   "distanceKm": 8.5,
 *   "deliveryFee": 1475,
 *   "estimatedMinutes": 42,
 *   "durationSeconds": 1620
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { deliveryAddress, prepTimeMinutes } = await request.json();

    // Validate input
    if (!deliveryAddress || typeof deliveryAddress !== 'string') {
      return NextResponse.json(
        { error: 'Valid delivery address is required' },
        { status: 400 }
      );
    }

    if (!GOOGLE_MAPS_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Google Maps API key not configured. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to environment variables.',
        },
        { status: 500 }
      );
    }

    // Step 1: Geocode the delivery address
    const { lat: deliveryLat, lng: deliveryLng, formatted_address } =
      await getCoordinatesFromAddress(deliveryAddress);

    // Step 2: Calculate distance from restaurant to delivery address
    const { distanceKm, durationSeconds } = await calculateDistance(
      RESTAURANT_LAT,
      RESTAURANT_LNG,
      deliveryLat,
      deliveryLng
    );

    // Step 3: Check if within delivery radius
    if (distanceKm > MAX_RADIUS_KM) {
      return NextResponse.json(
        {
          error: `Delivery location is ${distanceKm}km away. Maximum delivery radius is ${MAX_RADIUS_KM}km. Please select a closer location.`,
        },
        { status: 400 }
      );
    }

    // Step 4: Calculate delivery fee
    const deliveryFee = calculateDeliveryFee(distanceKm);

    // Step 5: Estimate total time (prep + delivery)
    const estimatedMinutes = getEstimatedTime(durationSeconds, prepTimeMinutes);

    // Success response
    return NextResponse.json({
      success: true,
      deliveryAddress: formatted_address,
      deliveryLat,
      deliveryLng,
      distanceKm,
      deliveryFee, // in naira
      estimatedMinutes,
      durationSeconds, // raw delivery time in seconds
    });
  } catch (error) {
    console.error('Delivery calculation error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Calculation failed';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}