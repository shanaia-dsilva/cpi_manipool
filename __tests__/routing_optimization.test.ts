import {
  locations,
  demoProfile,
  students,
  matchingConfig,
} from '../src/data/fixtures';
import { Location, Coordinate } from '../src/types/domain';
import { appReducer, initialState } from '../src/state/reducer';
import {
  haversineDistance,
  computeOfflineRoute,
  calculateRouteCompatibility,
  decodePolyline,
  calculateRoute,
} from '../src/services/routing';
import {
  comparePickupArrangements,
  findBestMeetingPoint,
  orderSequentialPickups,
  VERIFIED_MEETING_POINTS,
} from '../src/services/pickupOptimization';
import {
  findNearestLandmark,
  getDeviceLocationWithFallback,
} from '../src/services/location';
import {
  isDemoModeActive,
  recordQuotaCall,
  getQuotaGauges,
} from '../src/services/apiQuota';
import {
  rankCandidates,
  buildRoadCompatibleCandidates,
} from '../src/services/matching';

describe('Real location coordinates and Bengaluru landmarks', () => {
  it('all standard landmarks possess realistic GPS coordinates in Bengaluru', () => {
    expect(locations.length).toBeGreaterThanOrEqual(8);
    for (const loc of locations) {
      expect(loc.coordinate).toBeDefined();
      expect(Number.isFinite(loc.coordinate!.latitude)).toBe(true);
      expect(Number.isFinite(loc.coordinate!.longitude)).toBe(true);
      // Bengaluru latitude is roughly 12.8 - 13.3 N, longitude is roughly 77.4 - 77.8 E
      expect(loc.coordinate!.latitude).toBeGreaterThan(12.8);
      expect(loc.coordinate!.latitude).toBeLessThan(13.3);
      expect(loc.coordinate!.longitude).toBeGreaterThan(77.4);
      expect(loc.coordinate!.longitude).toBeLessThan(77.8);
    }
  });

  it('MAHE campus and Airport coordinates match real Bengaluru positions', () => {
    const campus = locations.find(l => l.id === 'campus')!;
    const airport = locations.find(l => l.id === 'airport')!;
    expect(campus.coordinate!.latitude).toBeCloseTo(13.1147, 2);
    expect(campus.coordinate!.longitude).toBeCloseTo(77.5878, 2);
    expect(airport.coordinate!.latitude).toBeCloseTo(13.1986, 2);
    expect(airport.coordinate!.longitude).toBeCloseTo(77.7066, 2);
  });

  it('supports selecting custom places with coordinate validation', () => {
    const customPoint: Location = {
      id: 'custom:yelahanka-cafe',
      name: 'Yelahanka Cafe Stop',
      area: 'Yelahanka Old Town',
      kind: 'city',
      corridor: 'north',
      coordinate: { latitude: 13.102, longitude: 77.595 },
      source: 'pin',
    };
    let state = appReducer(initialState(), {
      type: 'SELECT_PLACE',
      field: 'pickupId',
      location: customPoint,
    });
    expect(state.error).toBeUndefined();
    expect(state.customPlaces).toHaveLength(1);
    expect(state.draft.pickupId).toBe('custom:yelahanka-cafe');

    // Rejects invalid coordinates
    const invalidPoint: Location = {
      ...customPoint,
      id: 'custom:invalid',
      coordinate: { latitude: 95, longitude: 77.595 },
    };
    state = appReducer(state, {
      type: 'SELECT_PLACE',
      field: 'pickupId',
      location: invalidPoint,
    });
    expect(state.error).toBeDefined();
    expect(state.customPlaces).toHaveLength(1);
  });
});

describe('Road-based distance and travel time calculations', () => {
  const campusCoord: Coordinate = { latitude: 13.1152, longitude: 77.5885 };
  const airportCoord: Coordinate = { latitude: 13.1986, longitude: 77.7066 };

  it('calculates accurate Haversine distance between MAHE and Airport', () => {
    const distanceKm = haversineDistance(campusCoord, airportCoord);
    // Straight-line distance from Yelahanka MAHE to BLR Airport is ~15-18 km
    expect(distanceKm).toBeGreaterThan(14);
    expect(distanceKm).toBeLessThan(20);
  });

  it('computes explicitly labeled demo estimates without road evidence', () => {
    const route = computeOfflineRoute([campusCoord, airportCoord]);
    expect(route.status).toBe('fallback');
    expect(route.provider).toBe('offline_bengaluru');
    // Road distance via NH 44 is ~18-24 km
    expect(route.distanceKm).toBeGreaterThan(16);
    expect(route.distanceKm).toBeLessThan(26);
    // Travel time is realistic for airport expressway (~20 to 35 mins)
    expect(route.durationMinutes).toBeGreaterThan(15);
    expect(route.durationMinutes).toBeLessThan(40);
    expect(route.coordinates.length).toBeGreaterThanOrEqual(6);
    expect(route.summary).toContain('NH 44');
  });

  it('decodes encoded polylines accurately', () => {
    // Encoded polyline for sample segment
    const samplePoly = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    const decoded = decodePolyline(samplePoly);
    expect(decoded.length).toBeGreaterThan(0);
    expect(Number.isFinite(decoded[0].latitude)).toBe(true);
    expect(Number.isFinite(decoded[0].longitude)).toBe(true);
  });

  it('handles empty or single coordinate gracefully without crashing', async () => {
    const res = await calculateRoute([campusCoord]);
    expect(res.status).toBe('failed');
    expect(res.distanceKm).toBe(0);
  });
});

describe('Pickup arrangement comparison (Common Meeting Point vs Sequential)', () => {
  const origin = locations.find(l => l.id === 'gate')!;
  const destination = locations.find(l => l.id === 'airport')!;
  const members = [demoProfile, students[0], students[1]];

  it('finds the practical common meeting point minimizing walking distance', () => {
    const { meetingPoint, averageWalkMeters } = findBestMeetingPoint(
      members,
      origin.coordinate!,
    );
    expect(meetingPoint).toBeDefined();
    expect(meetingPoint.isPickupSuitable).toBe(true);
    expect(VERIFIED_MEETING_POINTS.some(p => p.id === meetingPoint.id)).toBe(
      true,
    );
    // Average walking distance around campus is reasonable (< 1500m)
    expect(averageWalkMeters).toBeGreaterThanOrEqual(0);
    expect(averageWalkMeters).toBeLessThan(2000);
  });

  it('orders sequential pickups progressively along the road toward destination', () => {
    const ordered = orderSequentialPickups(
      origin.coordinate!,
      destination.coordinate!,
      members,
    );
    expect(ordered).toHaveLength(members.length);
    expect(new Set(ordered.map(m => m.id)).size).toBe(members.length);
  });

  it('evaluates both arrangements side-by-side with trade-offs', () => {
    const comparison = comparePickupArrangements(origin, destination, members);

    // Common meeting point metrics
    expect(comparison.common.mode).toBe('common');
    expect(comparison.common.evidence).toBe('demo');
    expect(comparison.common.safetyRating).toContain('unverified');
    expect(comparison.common.pros.length).toBeGreaterThan(0);
    expect(comparison.common.cons.length).toBeGreaterThan(0);

    // Sequential pickup metrics
    expect(comparison.sequential.mode).toBe('sequential');
    expect(comparison.sequential.averageWalkingDistanceMeters).toBe(0); // Curbside!
    expect(comparison.sequential.stops).toHaveLength(members.length);
    expect(comparison.sequential.stops[0].order).toBe(1);
    expect(comparison.sequential.stops[1].order).toBe(2);
    expect(comparison.sequential.totalDetourMinutes).toBeGreaterThanOrEqual(5);

    // Practical recommendation rationale
    expect(comparison.recommendationSummary).toBeDefined();
    expect(typeof comparison.recommendationSummary).toBe('string');
  });
});

describe('Route compatibility integration with Nathan matching rules', () => {
  const requesterPickup = locations.find(l => l.id === 'campus')!;
  const candidatePickup = locations.find(l => l.id === 'kogilu')!;
  const destination = locations.find(l => l.id === 'airport')!;

  it('supplies illustrative demo compatibility (live uses a separate measured adapter)', () => {
    const compat = calculateRouteCompatibility(
      requesterPickup,
      candidatePickup,
      destination,
    );
    expect(compat.pickupKm).toBeGreaterThan(0);
    expect(compat.pickupKm).toBeLessThanOrEqual(matchingConfig.pickupKm);
    expect(compat.detourMinutes).toBeGreaterThan(0);
    expect(compat.detourMinutes).toBeLessThanOrEqual(
      matchingConfig.detourMinutes,
    );
    expect(compat.routeOverlap).toBeGreaterThanOrEqual(0.65);
    expect(compat.routeOverlap).toBeLessThanOrEqual(1.0);
  });

  it('ranks demo candidates using illustrative compatibility metrics', () => {
    const req = {
      id: 'req-test',
      userId: 'you',
      pickup: requesterPickup,
      destination,
      departure: new Date(Date.now() + 3600000).toISOString(),
      flexibility: 30 as const,
      createdAt: new Date().toISOString(),
      status: 'SEARCHING' as const,
      matches: [],
    };

    const candidates = buildRoadCompatibleCandidates(req, 'normal');
    expect(candidates).toHaveLength(2);
    const ranked = rankCandidates(req, candidates);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].score).toBeGreaterThan(0);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });
});

describe('Device location and permission handling with fallback', () => {
  it('finds nearest landmark given coordinate', () => {
    // Near campus gate
    const nearGate: Coordinate = { latitude: 13.1153, longitude: 77.5886 };
    const landmark = findNearestLandmark(nearGate, 0.5);
    expect(landmark).toBeDefined();
    expect(landmark!.id).toBe('gate');
  });

  it('falls back safely to Campus Main Gate when permission is denied or simulated', async () => {
    const res = await getDeviceLocationWithFallback();
    expect(res.resolvedLocation).toBeDefined();
    expect(res.resolvedLocation.isPickupSuitable).toBe(true);
    expect(typeof res.message).toBe('string');
  });
});

describe('Google Maps Demo Mode and API Limits Protection', () => {
  it('Google Maps Demo Mode is OFF by default to strictly protect quota', () => {
    const state = initialState();
    expect(state.apiQuota.googleMapsDemoMode).toBe(false);
    expect(isDemoModeActive(state.apiQuota)).toBe(false);
  });

  it('enabling demo mode sets expiration timeout', () => {
    let state = initialState();
    state = appReducer(state, {
      type: 'SET_DEMO_MODE',
      enabled: true,
      timeoutMinutes: 15,
    });
    expect(state.apiQuota.googleMapsDemoMode).toBe(true);
    expect(state.apiQuota.demoModeExpiresAt).toBeDefined();
    expect(isDemoModeActive(state.apiQuota)).toBe(true);

    // Auto-timeout reverts to safe mode once expired
    const expiredQuota = {
      ...state.apiQuota,
      demoModeExpiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    expect(isDemoModeActive(expiredQuota)).toBe(false);
  });

  it('tracks API usage counters and gauges accurately', () => {
    let quota = initialState().apiQuota;
    quota = recordQuotaCall(quota, 'maps_load');
    quota = recordQuotaCall(quota, 'places_autocomplete');
    quota = recordQuotaCall(quota, 'directions');
    quota = recordQuotaCall(quota, 'osrm');
    quota = recordQuotaCall(quota, 'offline');

    expect(quota.googleMapsLoads).toBe(1);
    expect(quota.googlePlacesAutocomplete).toBe(1);
    expect(quota.googleDirectionsRequests).toBe(1);
    expect(quota.osrmRouteRequests).toBe(1);
    expect(quota.offlineFallbackRequests).toBe(1);

    const gauges = getQuotaGauges(quota);

    expect(gauges.status).toBe('safe');
    expect(gauges.totalGoogleCalls).toBe(3);
    expect(gauges.totalOpenSourceCalls).toBe(2);
  });

  it('resets usage counters on command', () => {
    let state = initialState();
    state = appReducer(state, {
      type: 'RECORD_API_CALL',
      callType: 'directions',
    });
    expect(state.apiQuota.googleDirectionsRequests).toBe(1);

    state = appReducer(state, { type: 'RESET_API_QUOTA' });
    expect(state.apiQuota.googleDirectionsRequests).toBe(0);
  });
});
