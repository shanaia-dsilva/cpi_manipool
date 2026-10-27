import { Coordinate, Location, PickupArrangement, PickupStop, Student } from '../types/domain';
import { haversineDistance } from './routing';

// Curated list of verified safe, accessible pickup/meeting points in North Bengaluru
export const VERIFIED_MEETING_POINTS: (Location & { safetyScore: number; cabAccessRating: string })[] = [
  {
    id: 'gate',
    name: 'Campus Main Gate · Security Bay',
    area: 'MAHE Bengaluru Entrance',
    kind: 'campus',
    corridor: 'campus',
    coordinate: { latitude: 13.1152, longitude: 77.5885 },
    isPickupSuitable: true,
    safetyScore: 10,
    cabAccessRating: 'Wide turnaround loop, security guards present 24/7, bright lighting',
  },
  {
    id: 'gate2',
    name: 'Campus Rear Gate · Auto Stand',
    area: 'Govindapura Road',
    kind: 'campus',
    corridor: 'campus',
    coordinate: { latitude: 13.1135, longitude: 77.5865 },
    isPickupSuitable: true,
    safetyScore: 8,
    cabAccessRating: 'Designated auto stand, lower main road traffic',
  },
  {
    id: 'kogilu',
    name: 'Kogilu Cross Bus Stand',
    area: 'feeder to Bellary Road / NH 44',
    kind: 'bus',
    corridor: 'north',
    coordinate: { latitude: 13.1072, longitude: 77.5982 },
    isPickupSuitable: true,
    safetyScore: 9,
    cabAccessRating: 'Direct highway slip-road, sheltered BMTC stop, pedestrian zebra crossing',
  },
  {
    id: 'yelahanka',
    name: 'Yelahanka NES Junction',
    area: 'Major arterial junction, North Bengaluru',
    kind: 'city',
    corridor: 'north',
    coordinate: { latitude: 13.1042, longitude: 77.5925 },
    isPickupSuitable: true,
    safetyScore: 9,
    cabAccessRating: 'Adjacent to traffic police station, broad curbside for safe boarding',
  },
  {
    id: 'hebbal',
    name: 'Hebbal Flyover Service Bay',
    area: 'Near Esteem Mall, Outer Ring Rd',
    kind: 'city',
    corridor: 'north',
    coordinate: { latitude: 13.0358, longitude: 77.597 },
    isPickupSuitable: true,
    safetyScore: 8,
    cabAccessRating: 'Dedicated highway service bay, easy merger into elevated expressway',
  },
];

// Helper to resolve student coordinate
function getMemberCoordinate(member: Student, defaultCoord: Coordinate): Coordinate {
  return member.coordinate ?? defaultCoord;
}

// Selects the practical common meeting point minimizing total walking distance
export function findBestMeetingPoint(
  members: Student[],
  defaultCoord: Coordinate,
): { meetingPoint: Location; averageWalkMeters: number; maxWalkMeters: number } {
  const coords = members.map(m => getMemberCoordinate(m, defaultCoord));

  let bestPoint = VERIFIED_MEETING_POINTS[0];
  let minTotalDist = Infinity;
  let bestAvg = 0;
  let bestMax = 0;

  for (const candidate of VERIFIED_MEETING_POINTS) {
    if (!candidate.coordinate) continue;
    let totalDist = 0;
    let maxDist = 0;

    for (const coord of coords) {
      const dist = haversineDistance(candidate.coordinate, coord) * 1000; // in meters
      totalDist += dist;
      if (dist > maxDist) maxDist = dist;
    }

    if (totalDist < minTotalDist) {
      minTotalDist = totalDist;
      bestPoint = candidate;
      bestAvg = Math.round(totalDist / coords.length);
      bestMax = Math.round(maxDist);
    }
  }

  return {
    meetingPoint: bestPoint,
    averageWalkMeters: bestAvg,
    maxWalkMeters: bestMax,
  };
}

// Order sequential stops along the road progression vector toward destination
// Heuristic: Project member coordinates onto the vector from origin to destination
export function orderSequentialPickups(
  origin: Coordinate,
  destination: Coordinate,
  members: Student[],
): Student[] {
  const vX = destination.longitude - origin.longitude;
  const vY = destination.latitude - origin.latitude;
  const vLenSq = vX * vX + vY * vY;

  return members.slice().sort((a, b) => {
    const aCoord = getMemberCoordinate(a, origin);
    const bCoord = getMemberCoordinate(b, origin);

    // Vector projection scalar t = ((P - origin) • V) / |V|^2
    const tA = ((aCoord.longitude - origin.longitude) * vX + (aCoord.latitude - origin.latitude) * vY) / (vLenSq || 1);
    const tB = ((bCoord.longitude - origin.longitude) * vX + (bCoord.latitude - origin.latitude) * vY) / (vLenSq || 1);

    return tA - tB;
  });
}

// Evaluates both pickup arrangements side-by-side
export function comparePickupArrangements(
  originLocation: Location,
  destinationLocation: Location,
  members: Student[],
): {
  common: PickupArrangement;
  sequential: PickupArrangement;
  recommendedMode: 'common' | 'sequential';
  recommendationSummary: string;
} {
  const originCoord = originLocation.coordinate ?? { latitude: 13.1152, longitude: 77.5885 };
  const destCoord = destinationLocation.coordinate ?? { latitude: 13.1986, longitude: 77.7066 };

  // 1. Evaluate Common Meeting Point
  const { meetingPoint, averageWalkMeters } = findBestMeetingPoint(members, originCoord);
  const commonStops: PickupStop[] = members.map((member, _index) => {
    const memberCoord = getMemberCoordinate(member, originCoord);
    const walkMeters = Math.round(
      meetingPoint.coordinate ? haversineDistance(meetingPoint.coordinate, memberCoord) * 1000 : 150,
    );
    const walkMinutes = Math.max(1, Math.round(walkMeters / 75)); // 75m/min walking speed

    return {
      studentId: member.id,
      studentName: member.name,
      locationName: meetingPoint.name,
      coordinate: meetingPoint.coordinate ?? originCoord,
      order: 1, // Single coordinated departure
      walkingDistanceMeters: walkMeters,
      walkingMinutes: walkMinutes,
      curbsideNote: 'Assemble at security gate 5 mins prior to departure',
    };
  });

  const commonArrangement: PickupArrangement = {
    mode: 'common',
    title: 'Common Meeting Point',
    meetingPointName: meetingPoint.name,
    meetingPointCoordinate: meetingPoint.coordinate,
    totalDetourMinutes: 2, // Minimal vehicle deviation
    totalDetourKm: 0.4,
    averageWalkingDistanceMeters: averageWalkMeters,
    stops: commonStops,
    feasibilityScore: 9,
    safetyRating: 'High · Guarded & well-lit campus checkpoint',
    pros: [
      'Single vehicle pickup eliminates 6–10 minutes of city traffic detour',
      'Guarded campus security post with 24/7 CCTV & lighting',
      'No delays waiting outside individual gates or narrow lanes',
    ],
    cons: [
      `Riders walk an average of ~${averageWalkMeters} m (${Math.round(averageWalkMeters / 75)} mins) to the meeting point`,
    ],
    recommendationReason:
      averageWalkMeters <= 350
        ? `Saves ~7 min vehicle detour with only ~${averageWalkMeters} m walk per rider.`
        : 'Saves vehicle time but requires walking to the main gate.',
  };

  // 2. Evaluate Sequential Pickups
  const orderedMembers = orderSequentialPickups(originCoord, destCoord, members);
  let cumulativeDetourMinutes = 0;
  let cumulativeDetourKm = 0;

  const sequentialStops: PickupStop[] = orderedMembers.map((member, index) => {
    const memberCoord = getMemberCoordinate(member, originCoord);
    // Extra detour per pickup stop in Bengaluru (stop & go, boarding)
    const legDetourKm = index === 0 ? 0 : 1.2;
    const legDetourMins = index === 0 ? 0 : 3.5;

    cumulativeDetourKm += legDetourKm;
    cumulativeDetourMinutes += legDetourMins;

    return {
      studentId: member.id,
      studentName: member.name,
      locationName: `${member.name}'s pickup · ${member.area}`,
      coordinate: memberCoord,
      order: index + 1,
      walkingDistanceMeters: 0,
      walkingMinutes: 0,
      curbsideNote: `Stop #${index + 1} en route · Curbside pickup`,
    };
  });

  const sequentialArrangement: PickupArrangement = {
    mode: 'sequential',
    title: 'Sequential Pickups (Ordered Route)',
    totalDetourMinutes: Math.round(cumulativeDetourMinutes),
    totalDetourKm: Number(cumulativeDetourKm.toFixed(1)),
    averageWalkingDistanceMeters: 0,
    stops: sequentialStops,
    feasibilityScore: 7,
    safetyRating: 'Medium · Curbside pickup along residential roads',
    pros: [
      'Zero walking required for riders (direct doorstep/curbside pickup)',
      'Convenient for students travelling with heavy luggage or during rain',
    ],
    cons: [
      `Adds ~${Math.round(cumulativeDetourMinutes)} minutes detour to total journey time`,
      'Subject to localized street parking constraints and traffic bottlenecks',
    ],
    recommendationReason:
      'Convenient if carrying baggage, but increases total trip time by ~' +
      Math.round(cumulativeDetourMinutes) +
      ' mins.',
  };

  // Determine recommendation
  const recommendedMode: 'common' | 'sequential' =
    averageWalkMeters <= 350 ? 'common' : 'sequential';
  const recommendationSummary =
    recommendedMode === 'common'
      ? `We recommend the Common Meeting Point (${meetingPoint.name}). It saves ~${Math.round(
          cumulativeDetourMinutes - 2,
        )} min vehicle detour with an easy ${Math.round(averageWalkMeters / 75)} min walk.`
      : `Sequential pickups recommended due to distance between rider starting locations.`;

  return {
    common: commonArrangement,
    sequential: sequentialArrangement,
    recommendedMode,
    recommendationSummary,
  };
}
