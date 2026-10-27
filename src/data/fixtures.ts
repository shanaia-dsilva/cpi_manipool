import { Location, Student, VehicleOption } from '../types/domain';

export const demoProfile: Student = {
  id: 'you',
  name: 'Prathyush',
  email: 'prathyush@learner.manipal.edu',
  area: 'MAHE Campus',
  coordinate: { latitude: 13.1152, longitude: 77.5885 },
};

export const students: Student[] = [
  {
    id: 'ananya',
    name: 'Ananya',
    email: 'ananya@learner.manipal.edu',
    area: 'Campus area',
    coordinate: { latitude: 13.1072, longitude: 77.5982 },
  },
  {
    id: 'rahul',
    name: 'Rahul',
    email: 'rahul@learner.manipal.edu',
    area: 'Yelahanka area',
    coordinate: { latitude: 13.1042, longitude: 77.5925 },
  },
  {
    id: 'sneha',
    name: 'Sneha',
    email: 'sneha@learner.manipal.edu',
    area: 'Bagalur area',
    coordinate: { latitude: 13.125, longitude: 77.618 },
  },
];

export const locations: Location[] = [
  {
    id: 'campus',
    name: 'MAHE Bengaluru Campus',
    area: 'Govindapura, Yelahanka',
    kind: 'campus',
    corridor: 'campus',
    coordinate: { latitude: 13.1147, longitude: 77.5878 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'Main administrative driveway, 24/7 security booth',
  },
  {
    id: 'gate',
    name: 'Campus main gate',
    area: 'MAHE Bengaluru',
    kind: 'campus',
    corridor: 'campus',
    coordinate: { latitude: 13.1152, longitude: 77.5885 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'Dedicated vehicle turnaround bay, illuminated & guard monitored',
  },
  {
    id: 'gate2',
    name: 'Campus rear gate',
    area: 'Govindapura Road',
    kind: 'campus',
    corridor: 'campus',
    coordinate: { latitude: 13.1135, longitude: 77.5865 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'Adjacent to local auto stand, lower traffic congestion',
  },
  {
    id: 'yelahanka',
    name: 'Yelahanka New Town',
    area: 'North Bengaluru',
    kind: 'city',
    corridor: 'north',
    coordinate: { latitude: 13.1007, longitude: 77.5963 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'NES Office circle, broad curbside for safe boarding',
  },
  {
    id: 'kogilu',
    name: 'Kogilu Cross Junction',
    area: 'Airport Road feeder',
    kind: 'bus',
    corridor: 'north',
    coordinate: { latitude: 13.1072, longitude: 77.5982 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'BMTC bus shelter, safe meeting point before Bellary Road',
  },
  {
    id: 'airport',
    name: 'Kempegowda Airport',
    area: 'Terminal 1 • Bengaluru',
    kind: 'airport',
    corridor: 'airport',
    coordinate: { latitude: 13.1986, longitude: 77.7066 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'T1 Arrivals Carpool Bay / Lane 3',
  },
  {
    id: 'metro',
    name: 'Yeshwanthpur Metro',
    area: 'Green Line • Bengaluru',
    kind: 'metro',
    corridor: 'west',
    coordinate: { latitude: 13.0232, longitude: 77.5501 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'Metro Gate A drop-off zone, escalator access',
  },
  {
    id: 'railway',
    name: 'Yeshwanthpur Railway Station',
    area: 'Bengaluru',
    kind: 'railway',
    corridor: 'west',
    coordinate: { latitude: 13.0245, longitude: 77.5515 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'Platform 1 Main Portico entrance',
  },
  {
    id: 'majestic',
    name: 'Majestic Bus Station',
    area: 'Kempegowda Bus Station',
    kind: 'bus',
    corridor: 'central',
    coordinate: { latitude: 12.9774, longitude: 77.5727 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'BMTC Terminal 1 Entrance, wide pedestrian plaza',
  },
  {
    id: 'church',
    name: 'Church Street',
    area: 'Central Bengaluru',
    kind: 'city',
    corridor: 'central',
    coordinate: { latitude: 12.9753, longitude: 77.6067 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'Cobblestone walkway entry near Brigade Road',
  },
  {
    id: 'hebbal',
    name: 'Hebbal Flyover Junction',
    area: 'Outer Ring Road / NH 44',
    kind: 'city',
    corridor: 'north',
    coordinate: { latitude: 13.0358, longitude: 77.597 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'Esteem Mall service road, major northern transit hub',
  },
  {
    id: 'manyata',
    name: 'Manyata Tech Park',
    area: 'Nagavara, Outer Ring Rd',
    kind: 'city',
    corridor: 'north',
    coordinate: { latitude: 13.0487, longitude: 77.62 },
    source: 'preset',
    isPickupSuitable: true,
    accessNote: 'Gate 1 Visitor Entrance cab bay',
  },
];

export const vehicleOptions: VehicleOption[] = [
  { id: 'cab', name: 'Shared cab', capacity: 4, farePaise: 84000 },
  { id: 'auto', name: 'Shared auto', capacity: 2, farePaise: 62000 },
];

export const quickMessages = [
  '5 minutes away',
  "I've arrived",
  'Running late',
  'Confirm pickup',
  'Can we leave 10 minutes later?',
  'Ride booked',
  "I'm cancelling",
];

export const matchingConfig = {
  pickupKm: 2,
  detourMinutes: 8,
  capacity: 4,
  weights: {
    route: 0.35,
    detour: 0.25,
    time: 0.2,
    destination: 0.15,
    reliability: 0.05,
  },
};

export const initialQuotaUsage = {
  googleMapsDemoMode: false,
  autoTimeoutMinutes: 20,
  googleMapsLoads: 0,
  googlePlacesAutocomplete: 0,
  googlePlacesDetails: 0,
  googleDirectionsRequests: 0,
  osmTileRequests: 0,
  osrmRouteRequests: 0,
  offlineFallbackRequests: 0,
  lastCallTimestamp: undefined,
  lastCallProvider: 'OSRM / OpenStreetMap (Default Safe Mode)',
};

export function getLocation(
  id: string,
  customPlaces: Location[] = [],
): Location | undefined {
  return (
    customPlaces.find(location => location.id === id) ??
    locations.find(location => location.id === id)
  );
}
