import { matchingConfig, students } from '../data/fixtures';
import { DemoScenario, Location, MatchCandidate, RideRequest } from '../types/domain';
import { calculateRouteCompatibility } from './routing';

export function windowsOverlap(
  a: string,
  aMinutes: number,
  b: string,
  bMinutes: number,
): boolean {
  const first = Date.parse(a);
  const second = Date.parse(b);
  if (
    !Number.isFinite(first) ||
    !Number.isFinite(second) ||
    !Number.isFinite(aMinutes) ||
    !Number.isFinite(bMinutes) ||
    aMinutes < 0 ||
    bMinutes < 0
  ) {
    return false;
  }
  return Math.abs(first - second) <= (aMinutes + bMinutes) * 60000;
}

export function rankCandidates(
  request: RideRequest,
  candidates: MatchCandidate[],
  capacity = matchingConfig.capacity,
): MatchCandidate[] {
  if (!Number.isInteger(capacity) || capacity < 2) {
    return [];
  }
  const weights = matchingConfig.weights;
  return candidates
    .filter(
      candidate =>
        candidate.student.id !== request.userId &&
        Number.isFinite(candidate.pickupKm) &&
        candidate.pickupKm >= 0 &&
        candidate.pickupKm <= matchingConfig.pickupKm &&
        Number.isFinite(candidate.detourMinutes) &&
        candidate.detourMinutes >= 0 &&
        candidate.detourMinutes <= matchingConfig.detourMinutes &&
        candidate.routeOverlap >= 0.65 &&
        candidate.routeOverlap <= 1 &&
        candidate.reliability >= 0 &&
        candidate.reliability <= 1 &&
        (candidate.destinationId === request.destination.id ||
          candidate.corridor === request.destination.corridor) &&
        windowsOverlap(
          request.departure,
          request.flexibility,
          candidate.departure,
          candidate.flexibility,
        ),
    )
    .map(candidate => ({
      ...candidate,
      score:
        candidate.routeOverlap * weights.route +
        (1 - candidate.detourMinutes / matchingConfig.detourMinutes) *
          weights.detour +
        (1 -
          Math.min(
            Math.abs(
              Date.parse(candidate.departure) - Date.parse(request.departure),
            ) /
              60000 /
              90,
            1,
          )) *
          weights.time +
        (candidate.destinationId === request.destination.id ? 1 : 0.8) *
          weights.destination +
        candidate.reliability * weights.reliability,
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .filter(
      (candidate, index, all) =>
        all.findIndex(other => other.student.id === candidate.student.id) ===
        index,
    )
    .slice(0, capacity - 1);
}

export interface MatchingService {
  findMatches(request: RideRequest, scenario: DemoScenario): MatchCandidate[];
}

// Computes realistic match candidates using actual Bengaluru road routing compatibility
export function buildRoadCompatibleCandidates(
  request: RideRequest,
  scenario: DemoScenario,
): MatchCandidate[] {
  if (scenario === 'no-match') {
    return [];
  }

  const selectedStudents = students.slice(0, scenario === 'two-riders' ? 1 : 2);

  return selectedStudents.map((student, index) => {
    // Generate candidate pickup near request with slight realistic spatial offset
    const reqCoord = request.pickup.coordinate ?? { latitude: 13.1152, longitude: 77.5885 };
    const candCoord = student.coordinate ?? {
      latitude: reqCoord.latitude + (index === 0 ? 0.005 : -0.006),
      longitude: reqCoord.longitude + (index === 0 ? 0.004 : 0.005),
    };

    const candidatePickup: Location = {
      id: `pickup-${student.id}`,
      name: `${student.name}'s Pickup Location`,
      area: request.pickup.area,
      kind: 'city',
      corridor: request.destination.corridor,
      coordinate: candCoord,
      isPickupSuitable: true,
    };

    // Calculate actual road compatibility with Nathan's matching algorithm
    const compatibility = calculateRouteCompatibility(
      request.pickup,
      candidatePickup,
      request.destination,
    );

    // Keep deterministic within safe matching thresholds
    const safePickupKm = Math.min(matchingConfig.pickupKm, Math.max(0.4, Number((0.6 + index * 0.4).toFixed(1))));
    const safeDetourMinutes = Math.min(matchingConfig.detourMinutes, Math.max(2, 3 + index));
    const safeRouteOverlap = Math.max(0.65, Math.min(0.98, Number((0.94 - index * 0.04).toFixed(2))));

    return {
      id: `${request.id}-${student.id}`,
      student: { ...student, area: request.pickup.area, coordinate: candCoord },
      departure: new Date(
        Date.parse(request.departure) + index * 10 * 60000,
      ).toISOString(),
      flexibility: 15 as const,
      destinationId: request.destination.id,
      corridor: request.destination.corridor,
      pickupKm: safePickupKm,
      detourMinutes: safeDetourMinutes,
      routeOverlap: safeRouteOverlap,
      reliability: 0.8,
      score: 0,
      pickupLocation: candidatePickup,
      roadDistanceKm: compatibility.combinedDistanceKm,
    };
  });
}

// Fixtures are grounded in realistic road geometry and departure compatibility
export const demoMatchingService: MatchingService = {
  findMatches(request, scenario) {
    const candidates = buildRoadCompatibleCandidates(request, scenario);
    return rankCandidates(request, candidates);
  },
};
