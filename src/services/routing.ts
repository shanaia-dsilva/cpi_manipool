import { liveRoutingActive, requestLiveRoute } from './liveRouting';
import { Coordinate, Location, RouteGeometry } from '../types/domain';

// Haversine direct distance in kilometers
export function haversineDistance(a: Coordinate, b: Coordinate): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);

  const h =
    sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

// Bengaluru arterial corridors speed and road winding factors
function getBengaluruCorridorProfile(
  origin: Coordinate,
  destination: Coordinate,
) {
  // Check if journey is primarily on the northern NH 44 airport corridor
  const isAirportCorridor =
    (origin.latitude > 13.15 || destination.latitude > 13.15) &&
    origin.longitude > 77.58 &&
    destination.longitude > 77.58;

  if (isAirportCorridor) {
    return {
      windingFactor: 1.18, // NH 44 elevated expressway is relatively straight
      averageSpeedKmh: 55, // Fast expressway traffic
      summary: 'via NH 44 / Bellary Rd (Airport Expressway)',
    };
  }

  // Check if journey involves Yelahanka - Hebbal - Ring Road
  const isNorthCorridor =
    origin.latitude > 13.05 && destination.latitude > 13.05;
  if (isNorthCorridor) {
    return {
      windingFactor: 1.25,
      averageSpeedKmh: 35,
      summary: 'via Bellary Road / Doddaballapur Main Rd',
    };
  }

  // Central / Western Bengaluru (Yeshwanthpur, Majestic, Church St)
  return {
    windingFactor: 1.34, // Higher winding due to city grid, one-ways, junctions
    averageSpeedKmh: 24, // Typical Bengaluru urban congestion
    summary: 'via City Arterial / Outer Ring Road',
  };
}

// Generates smooth realistic curved polyline points between two coordinates
function generateCurvedPath(
  start: Coordinate,
  end: Coordinate,
  steps = 8,
): Coordinate[] {
  const points: Coordinate[] = [start];
  const midLat = (start.latitude + end.latitude) / 2;
  const midLng = (start.longitude + end.longitude) / 2;

  // Add realistic arterial road curve offset perpendicular to vector
  const dLat = end.latitude - start.latitude;
  const dLng = end.longitude - start.longitude;
  const perpLat = -dLng * 0.12;
  const perpLng = dLat * 0.12;

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    // Quadratic Bezier curve interpolation
    const lat =
      (1 - t) * (1 - t) * start.latitude +
      2 * (1 - t) * t * (midLat + perpLat) +
      t * t * end.latitude;
    const lng =
      (1 - t) * (1 - t) * start.longitude +
      2 * (1 - t) * t * (midLng + perpLng) +
      t * t * end.longitude;
    points.push({
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    });
  }

  points.push(end);
  return points;
}

// Deterministic demo estimate, NOT a road graph or a navigable route.
export function computeOfflineRoute(
  waypoints: Coordinate[],
  summaryHint?: string,
): RouteGeometry {
  if (waypoints.length < 2) {
    return {
      coordinates: waypoints,
      distanceKm: 0,
      durationMinutes: 0,
      summary: 'Single location',
      provider: 'offline_bengaluru',
      status: 'success',
    };
  }

  let totalDistanceKm = 0;
  let totalDurationMinutes = 0;
  const fullPolyline: Coordinate[] = [];
  const start = waypoints[0];
  const end = waypoints[waypoints.length - 1];
  const profile = getBengaluruCorridorProfile(start, end);

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const directKm = haversineDistance(from, to);
    const legRoadKm = directKm * profile.windingFactor;
    const legMinutes =
      (legRoadKm / profile.averageSpeedKmh) * 60 + (i > 0 ? 3 : 0);

    totalDistanceKm += legRoadKm;
    totalDurationMinutes += legMinutes;

    const segmentPoints = generateCurvedPath(from, to, 6);
    if (i === 0) {
      fullPolyline.push(...segmentPoints);
    } else {
      fullPolyline.push(...segmentPoints.slice(1));
    }
  }

  return {
    coordinates: fullPolyline,
    distanceKm: Number(Math.max(0.5, totalDistanceKm).toFixed(1)),
    durationMinutes: Math.max(2, Math.round(totalDurationMinutes)),
    summary: `Demo estimate · ${
      summaryHint ?? profile.summary
    } · not road routing`,
    provider: 'offline_bengaluru',
    status: 'fallback',
  };
}

/* eslint-disable no-bitwise */
// Polyline decoding helper for OSRM / Google polyline format
export function decodePolyline(encoded: string): Coordinate[] {
  const points: Coordinate[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      if (index >= len || shift > 30)
        throw new Error('Invalid route polyline.');
      b = encoded.charCodeAt(index++) - 63;
      if (b < 0 || b > 63) throw new Error('Invalid route polyline.');
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      if (index >= len || shift > 30)
        throw new Error('Invalid route polyline.');
      b = encoded.charCodeAt(index++) - 63;
      if (b < 0 || b > 63) throw new Error('Invalid route polyline.');
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }
  return points;
}

export interface RoutingOptions {
  useGoogleDemo?: boolean;
  timeoutMs?: number;
  mode?: 'DRIVE' | 'WALK';
}
export function isValidCoordinate(
  coord: Coordinate | undefined,
): coord is Coordinate {
  return (
    !!coord &&
    Number.isFinite(coord.latitude) &&
    Number.isFinite(coord.longitude) &&
    Math.abs(coord.latitude) <= 90 &&
    Math.abs(coord.longitude) <= 180
  );
}
export async function calculateRoute(
  locations: (Location | Coordinate)[],
  options: RoutingOptions = {},
): Promise<RouteGeometry> {
  const coords = locations.map(loc => ('id' in loc ? loc.coordinate : loc));
  const failure = (error: string): RouteGeometry => ({
    coordinates: [],
    distanceKm: 0,
    durationMinutes: 0,
    summary: 'Route unavailable',
    provider: 'offline_bengaluru',
    status: 'failed',
    error,
  });
  if (coords.length < 2 || !coords.every(isValidCoordinate)) {
    return failure(
      'Every stop needs valid coordinates. Choose another location.',
    );
  }
  const points = coords as Coordinate[];
  const live = options.useGoogleDemo ?? liveRoutingActive();
  if (!live) return computeOfflineRoute(points);
  try {
    return await requestLiveRoute(
      points,
      options.mode ?? 'DRIVE',
      decodePolyline,
    );
  } catch (error) {
    return failure(
      error instanceof Error
        ? error.message
        : 'Routing failed. Retry or switch to demo mode.',
    );
  }
}

// Road-derived metrics for Nathan. Never accept fallback estimates as live evidence.
export function compatibilityFromRoutes(
  direct: RouteGeometry,
  combined: RouteGeometry,
  pickup: RouteGeometry,
) {
  if (
    [direct, combined, pickup].some(
      r => r.status !== 'success' || r.provider !== 'google',
    )
  ) {
    throw new Error('Real routing data is required for live matching.');
  }
  const nearby = (point: Coordinate) =>
    combined.coordinates.some(other => haversineDistance(point, other) <= 0.1);
  let sharedKm = 0;
  let geometryKm = 0;
  for (let i = 1; i < direct.coordinates.length; i++) {
    const start = direct.coordinates[i - 1];
    const end = direct.coordinates[i];
    const length = haversineDistance(start, end);
    geometryKm += length;
    if (nearby(start) && nearby(end)) sharedKm += length;
  }
  return {
    routeOverlap: geometryKm ? Math.min(1, sharedKm / geometryKm) : 0,
    detourMinutes:
      Math.max(0, combined.durationMinutes - direct.durationMinutes) + 3,
    pickupKm: pickup.distanceKm,
    directDistanceKm: direct.distanceKm,
    combinedDistanceKm: combined.distanceKm,
  };
}
export async function calculateLiveCompatibility(
  pickup: Location,
  candidate: Location,
  destination: Location,
) {
  const direct = await calculateRoute([pickup, destination], {
    useGoogleDemo: true,
  });
  const combined = await calculateRoute([pickup, candidate, destination], {
    useGoogleDemo: true,
  });
  const approach = await calculateRoute([pickup, candidate], {
    useGoogleDemo: true,
  });
  return compatibilityFromRoutes(direct, combined, approach);
}

// Calculate route compatibility (overlap % and detour minutes) for Nathan's matching algorithm
export function calculateRouteCompatibility(
  requesterPickup: Location,
  candidatePickup: Location,
  sharedDestination: Location,
): {
  routeOverlap: number;
  detourMinutes: number;
  pickupKm: number;
  directDistanceKm: number;
  combinedDistanceKm: number;
} {
  const reqCoord = requesterPickup.coordinate ?? {
    latitude: 13.1152,
    longitude: 77.5885,
  };
  const candCoord = candidatePickup.coordinate ?? {
    latitude: 13.1072,
    longitude: 77.5982,
  };
  const destCoord = sharedDestination.coordinate ?? {
    latitude: 13.1986,
    longitude: 77.7066,
  };

  // 1. Distance between the two pickups
  const pickupDirectKm = haversineDistance(reqCoord, candCoord);
  const pickupKm = Number((pickupDirectKm * 1.25).toFixed(1));

  // 2. Direct route distance: Requester -> Destination
  const directDirectKm = haversineDistance(reqCoord, destCoord);
  const directDistanceKm = Number((directDirectKm * 1.22).toFixed(1));

  // 3. Combined route: Requester -> Candidate Pickup -> Destination
  const leg1 = haversineDistance(reqCoord, candCoord) * 1.25;
  const leg2 = haversineDistance(candCoord, destCoord) * 1.22;
  const combinedDistanceKm = Number((leg1 + leg2).toFixed(1));

  // 4. Detour calculation
  const detourDistanceKm = Math.max(0, combinedDistanceKm - directDistanceKm);
  // Average city road travel time + 3 minutes vehicle slowdown/boarding time
  const detourMinutes = Math.max(
    2,
    Math.round((detourDistanceKm / 32) * 60 + 3),
  );

  // 5. Route overlap ratio
  // If candidate is directly along the corridor to destination, overlap is high (>0.85)
  const overlapRatio = Math.min(
    0.98,
    Math.max(
      0.65,
      Number((1 - detourDistanceKm / (directDistanceKm * 0.45)).toFixed(2)),
    ),
  );

  return {
    routeOverlap: overlapRatio,
    detourMinutes,
    pickupKm,
    directDistanceKm,
    combinedDistanceKm,
  };
}
