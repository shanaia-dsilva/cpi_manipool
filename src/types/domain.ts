export type RideStatus =
  | 'DRAFT'
  | 'SEARCHING'
  | 'MATCH_FOUND'
  | 'WAITING_FOR_ACCEPTANCE'
  | 'GROUP_FORMED'
  | 'RIDE_BOOKED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NO_MATCH'
  | 'REMATCHING'
  | 'CANCELLED'
  | 'EXPIRED';

export type Flexibility = 0 | 15 | 30 | 45;
export type DemoScenario = 'normal' | 'no-match' | 'two-riders';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  area: string;
  coordinate?: Coordinate;
}

export interface Location {
  id: string;
  name: string;
  area: string;
  kind: 'campus' | 'metro' | 'airport' | 'railway' | 'city' | 'bus';
  corridor: string;
  coordinate?: Coordinate;
  placeId?: string;
  source?: 'preset' | 'osm' | 'google' | 'pin' | 'gps';
  attributions?: string[];
  accessNote?: string;
  isPickupSuitable?: boolean;
}

export interface RideDraft {
  pickupId: string;
  destinationId: string;
  date: string;
  time: string;
  flexibility: Flexibility;
}

export interface RouteGeometry {
  coordinates: Coordinate[];
  distanceKm: number;
  durationMinutes: number;
  summary: string;
  provider: 'osrm' | 'google' | 'offline_bengaluru';
  status: 'success' | 'fallback' | 'failed';
  error?: string;
}

export interface PickupStop {
  studentId: string;
  studentName: string;
  locationName: string;
  coordinate: Coordinate;
  order: number;
  walkingDistanceMeters: number;
  walkingMinutes: number;
  curbsideNote?: string;
}

export interface PickupArrangement {
  mode: 'common' | 'sequential';
  title: string;
  meetingPointName?: string;
  meetingPointCoordinate?: Coordinate;
  totalDetourMinutes: number;
  totalDetourKm: number;
  averageWalkingDistanceMeters: number;
  stops: PickupStop[];
  feasibilityScore: number; // 1 to 10
  safetyRating: string;
  pros: string[];
  cons: string[];
  recommendationReason: string;
}

export interface MatchCandidate {
  id: string;
  student: Student;
  departure: string;
  flexibility: Flexibility;
  destinationId: string;
  corridor: string;
  pickupKm: number;
  detourMinutes: number;
  routeOverlap: number;
  reliability: number;
  score: number;
  pickupLocation?: Location;
  roadDistanceKm?: number;
}

export interface RideRequest {
  id: string;
  userId: string;
  pickup: Location;
  destination: Location;
  departure: string;
  flexibility: Flexibility;
  createdAt: string;
  status: RideStatus;
  matches: MatchCandidate[];
  groupId?: string;
  route?: RouteGeometry;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  sender: string;
  text: string;
  timestamp: string;
  system: boolean;
}

export interface VehicleOption {
  id: 'cab' | 'auto';
  name: string;
  capacity: number;
  farePaise: number;
}

export interface RideBooking {
  option: VehicleOption;
  confirmedAt: string;
}

export interface CarpoolGroup {
  id: string;
  rideId: string;
  members: Student[];
  pickupMode: 'common' | 'sequential';
  status: 'GROUP_FORMED' | 'RIDE_BOOKED' | 'IN_PROGRESS' | 'COMPLETED';
  messages: ChatMessage[];
  booking?: RideBooking;
  agreedRoute?: RouteGeometry;
  pickupArrangement?: PickupArrangement;
  meetingPoint?: Location;
}

export interface DemoReport {
  id: string;
  rideId?: string;
  text: string;
  timestamp: string;
}

export interface ApiQuotaUsage {
  googleMapsDemoMode: boolean;
  demoModeExpiresAt?: string;
  autoTimeoutMinutes: number;
  googleMapsLoads: number;
  googlePlacesAutocomplete: number;
  googlePlacesDetails: number;
  googleDirectionsRequests: number;
  osmTileRequests: number;
  osrmRouteRequests: number;
  offlineFallbackRequests: number;
  lastCallTimestamp?: string;
  lastCallProvider?: string;
}

export interface AppState {
  profile: Student;
  signedIn: boolean;
  draft: RideDraft;
  rides: RideRequest[];
  groups: CarpoolGroup[];
  customPlaces: Location[];
  scenario: DemoScenario;
  notifications: boolean;
  savedPlaces: string[];
  reports: DemoReport[];
  apiQuota: ApiQuotaUsage;
  error?: string;
}
