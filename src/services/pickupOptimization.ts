import {
  Coordinate,
  Location,
  PickupArrangement,
  PickupStop,
  Student,
} from '../types/domain';
import {
  calculateRoute,
  computeOfflineRoute,
  haversineDistance,
} from './routing';

// Candidate landmarks; access and stopping legality require on-site confirmation.
export const VERIFIED_MEETING_POINTS: (Location & {
  safetyScore: number;
  cabAccessRating: string;
})[] = [
  {
    id: 'gate',
    name: 'Campus Main Gate · Security Bay',
    area: 'MAHE Bengaluru Entrance',
    kind: 'campus',
    corridor: 'campus',
    coordinate: { latitude: 13.1152, longitude: 77.5885 },
    isPickupSuitable: true,
    safetyScore: 0,
    cabAccessRating:
      'Access not field-verified; confirm legal stopping and pedestrian access',
  },
  {
    id: 'gate2',
    name: 'Campus Rear Gate · Auto Stand',
    area: 'Govindapura Road',
    kind: 'campus',
    corridor: 'campus',
    coordinate: { latitude: 13.1135, longitude: 77.5865 },
    isPickupSuitable: true,
    safetyScore: 0,
    cabAccessRating:
      'Access not field-verified; confirm legal stopping and pedestrian access',
  },
  {
    id: 'kogilu',
    name: 'Kogilu Cross Bus Stand',
    area: 'feeder to Bellary Road / NH 44',
    kind: 'bus',
    corridor: 'north',
    coordinate: { latitude: 13.1072, longitude: 77.5982 },
    isPickupSuitable: true,
    safetyScore: 0,
    cabAccessRating:
      'Access not field-verified; confirm legal stopping and pedestrian access',
  },
  {
    id: 'yelahanka',
    name: 'Yelahanka NES Junction',
    area: 'Major arterial junction, North Bengaluru',
    kind: 'city',
    corridor: 'north',
    coordinate: { latitude: 13.1042, longitude: 77.5925 },
    isPickupSuitable: true,
    safetyScore: 0,
    cabAccessRating:
      'Access not field-verified; confirm legal stopping and pedestrian access',
  },
  {
    id: 'hebbal',
    name: 'Hebbal Flyover Service Bay',
    area: 'Near Esteem Mall, Outer Ring Rd',
    kind: 'city',
    corridor: 'north',
    coordinate: { latitude: 13.0358, longitude: 77.597 },
    isPickupSuitable: true,
    safetyScore: 0,
    cabAccessRating:
      'Access not field-verified; confirm legal stopping and pedestrian access',
  },
];

export function findBestMeetingPoint(members: Student[], origin: Coordinate) {
  if (!members.length) throw new Error('At least one rider is required.');
  const ranked = VERIFIED_MEETING_POINTS.map(meetingPoint => {
    const distances = members.map(
      m =>
        haversineDistance(m.coordinate ?? origin, meetingPoint.coordinate!) *
        1000,
    );
    return {
      meetingPoint,
      averageWalkMeters: Math.round(
        distances.reduce((a, b) => a + b, 0) / members.length,
      ),
      maxWalkMeters: Math.round(Math.max(...distances)),
    };
  }).sort(
    (a, b) =>
      a.maxWalkMeters - b.maxWalkMeters ||
      a.averageWalkMeters - b.averageWalkMeters,
  );
  return ranked[0];
}
export function orderSequentialPickups(
  origin: Coordinate,
  destination: Coordinate,
  members: Student[],
): Student[] {
  // Small demo groups: evaluate all permutations with the local estimate model.
  return (
    permutations(members.slice(1))
      .map(rest => [members[0], ...rest])
      .sort((a, b) => {
        const cost = (items: Student[]) =>
          computeOfflineRoute([
            origin,
            ...items.slice(1).map(m => m.coordinate ?? origin),
            destination,
          ]).durationMinutes;
        return cost(a) - cost(b);
      })[0] ?? []
  );
}
function permutations<T>(items: T[]): T[][] {
  if (items.length > 4) throw new Error('At most four riders are supported.');
  return items.length
    ? items.flatMap((item, i) =>
        permutations(items.filter((_, j) => j !== i)).map(rest => [
          item,
          ...rest,
        ]),
      )
    : [[]];
}
export interface PickupComparison {
  common: PickupArrangement;
  sequential: PickupArrangement;
  recommendedMode: 'common' | 'sequential';
  recommendationSummary: string;
}
function buildComparison(
  origin: Location,
  destination: Location,
  members: Student[],
  ordered: Student[],
  direct: import('../types/domain').RouteGeometry,
  commonRoute: import('../types/domain').RouteGeometry,
  sequentialRoute: import('../types/domain').RouteGeometry,
  walkMeters: number[],
  live: boolean,
): PickupComparison {
  const { meetingPoint } = findBestMeetingPoint(members, origin.coordinate!);
  const avg = Math.round(
    walkMeters.reduce((a, b) => a + b, 0) / members.length,
  );
  const max = Math.max(...walkMeters);
  const stops = (mode: 'common' | 'sequential'): PickupStop[] =>
    (mode === 'common' ? members : ordered).map((m, i) => ({
      studentId: m.id,
      studentName: m.name,
      locationName:
        mode === 'common' ? meetingPoint.name : `${m.name} · ${m.area}`,
      coordinate: mode === 'common' ? meetingPoint.coordinate! : m.coordinate!,
      order: mode === 'common' ? 1 : i + 1,
      walkingDistanceMeters: mode === 'common' ? Math.round(walkMeters[i]) : 0,
      walkingMinutes: mode === 'common' ? Math.ceil(walkMeters[i] / 75) : 0,
      curbsideNote:
        'Confirm legal stopping, pavement access, luggage and mobility needs with all riders.',
    }));
  const make = (
    mode: 'common' | 'sequential',
    route: import('../types/domain').RouteGeometry,
  ): PickupArrangement => ({
    mode,
    title: mode === 'common' ? 'Common meeting point' : 'Sequential pickups',
    ...(mode === 'common'
      ? {
          meetingPointName: meetingPoint.name,
          meetingPointCoordinate: meetingPoint.coordinate,
        }
      : {}),
    totalDetourMinutes:
      Math.max(0, route.durationMinutes - direct.durationMinutes) +
      (mode === 'common' ? 3 : members.length * 3),
    totalDetourKm: Math.max(0, route.distanceKm - direct.distanceKm),
    averageWalkingDistanceMeters: mode === 'common' ? avg : 0,
    stops: stops(mode),
    feasibilityScore: mode === 'common' && max > 500 ? 0 : 5,
    safetyRating: 'Access unverified · riders must confirm safe, legal pickup',
    pros: [
      mode === 'common'
        ? 'One shared boarding stop'
        : 'Avoids walking to a common point',
    ],
    cons: [
      mode === 'common'
        ? `Longest walk: ${Math.round(max)} m; 500 m maximum preferred`
        : 'Three minutes boarding allowance per rider',
    ],
    recommendationReason: live
      ? 'Google road distances; boarding and walking time are estimates.'
      : 'Demo estimates only; not road measurements.',
    route,
    evidence: live ? 'google' : 'demo',
    feasible: mode !== 'common' || max <= 500,
  });
  const common = make('common', commonRoute);
  const sequential = make('sequential', sequentialRoute);
  const recommendedMode =
    max <= 500 && common.totalDetourMinutes <= sequential.totalDetourMinutes
      ? 'common'
      : 'sequential';
  return {
    common,
    sequential,
    recommendedMode,
    recommendationSummary: `${
      live ? 'Google Maps road comparison' : 'Demo estimate comparison'
    }: ${
      recommendedMode === 'common' ? 'meet together' : 'use sequential pickups'
    }. Longest walk ${Math.round(
      max,
    )} m. Access must be confirmed; no safety certification.`,
  };
}
export function comparePickupArrangements(
  origin: Location,
  destination: Location,
  members: Student[],
): PickupComparison {
  const normalized = members.map(m => ({
    ...m,
    coordinate: m.coordinate ?? origin.coordinate!,
  }));
  const { meetingPoint } = findBestMeetingPoint(normalized, origin.coordinate!);
  const ordered = orderSequentialPickups(
    origin.coordinate!,
    destination.coordinate!,
    normalized,
  );
  return buildComparison(
    origin,
    destination,
    normalized,
    ordered,
    computeOfflineRoute([origin.coordinate!, destination.coordinate!]),
    computeOfflineRoute([meetingPoint.coordinate!, destination.coordinate!]),
    computeOfflineRoute([
      origin.coordinate!,
      ...ordered.slice(1).map(m => m.coordinate!),
      destination.coordinate!,
    ]),
    normalized.map(
      m => haversineDistance(m.coordinate!, meetingPoint.coordinate!) * 1000,
    ),
    false,
  );
}
export async function compareLivePickupArrangements(
  origin: Location,
  destination: Location,
  members: Student[],
): Promise<PickupComparison> {
  if (
    !origin.coordinate ||
    !destination.coordinate ||
    members.some(m => !m.coordinate)
  )
    throw new Error('All riders need pickup coordinates.');
  // Anchor requester at origin. With up to three riders, test at most two orders.
  if (members.length < 1 || members.length > 3)
    throw new Error('Faculty demo supports up to three riders.');
  const { meetingPoint } = findBestMeetingPoint(members, origin.coordinate);
  const route = async (
    points: Coordinate[],
    mode: 'DRIVE' | 'WALK' = 'DRIVE',
  ) => {
    const result = await calculateRoute(points, { useGoogleDemo: true, mode });
    if (result.status !== 'success')
      throw new Error(
        result.error ||
          'No road route. Change the pickup or switch to demo mode.',
      );
    return result;
  };
  const direct = await route([origin.coordinate, destination.coordinate]);
  const common = await route([
    meetingPoint.coordinate!,
    destination.coordinate,
  ]);
  const walks: number[] = [];
  for (const member of members) {
    walks.push(
      haversineDistance(member.coordinate!, meetingPoint.coordinate!) < 0.01
        ? 0
        : (await route([member.coordinate!, meetingPoint.coordinate!], 'WALK'))
            .distanceKm * 1000,
    );
  }
  const alternatives = permutations(members.slice(1));
  let best:
    | { ordered: Student[]; route: import('../types/domain').RouteGeometry }
    | undefined;
  for (const order of alternatives) {
    const result = await route([
      origin.coordinate,
      ...order.map(m => m.coordinate!),
      destination.coordinate,
    ]);
    if (!best || result.durationMinutes < best.route.durationMinutes)
      best = { ordered: [members[0], ...order], route: result };
  }
  return buildComparison(
    origin,
    destination,
    members,
    best!.ordered,
    direct,
    common,
    best!.route,
    walks,
    true,
  );
}
