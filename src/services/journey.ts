import { getLocation } from '../data/fixtures';
import { Location, RideDraft, RideStatus } from '../types/domain';
const transitions: Record<RideStatus, readonly RideStatus[]> = {
  DRAFT: ['SEARCHING', 'CANCELLED'],
  SEARCHING: ['MATCH_FOUND', 'NO_MATCH', 'CANCELLED', 'EXPIRED'],
  MATCH_FOUND: ['WAITING_FOR_ACCEPTANCE', 'REMATCHING', 'CANCELLED', 'EXPIRED'],
  WAITING_FOR_ACCEPTANCE: ['GROUP_FORMED', 'CANCELLED', 'EXPIRED'],
  GROUP_FORMED: ['RIDE_BOOKED', 'CANCELLED'],
  RIDE_BOOKED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  NO_MATCH: ['REMATCHING', 'CANCELLED', 'EXPIRED'],
  REMATCHING: ['MATCH_FOUND', 'NO_MATCH', 'CANCELLED', 'EXPIRED'],
  CANCELLED: [],
  EXPIRED: [],
};
export function canTransition(from: RideStatus, to: RideStatus) {
  return transitions[from].includes(to);
}
export function departureFromDraft(draft: RideDraft): Date | undefined {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !/^\d{2}:\d{2}$/.test(draft.time)
  ) {
    return undefined;
  }
  const [year, month, day] = draft.date.split('-').map(Number);
  const [hour, minute] = draft.time.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return undefined;
  }
  return date;
}
export function validateDraft(
  draft: RideDraft,
  now = Date.now(),
  customPlaces: Location[] = [],
): string | undefined {
  const pickup = getLocation(draft.pickupId, customPlaces);
  const destination = getLocation(draft.destinationId, customPlaces);
  if (!pickup || !destination) {
    return 'Choose a pickup and destination.';
  }
  if (draft.pickupId === draft.destinationId) {
    return 'Pickup and destination must be different.';
  }
  if (
    pickup.coordinate &&
    destination.coordinate &&
    pickup.coordinate.latitude === destination.coordinate.latitude &&
    pickup.coordinate.longitude === destination.coordinate.longitude
  ) {
    return 'Pickup and destination must be different.';
  }
  const departure = departureFromDraft(draft);
  if (!departure) {
    return 'Choose a valid departure date and time.';
  }
  if (departure.getTime() <= now) {
    return 'Choose a departure in the future.';
  }
  if (![0, 15, 30, 45].includes(draft.flexibility)) {
    return 'Choose a supported time flexibility.';
  }
  return undefined;
}
export function splitFare(totalPaise: number, passengers: number): number[] {
  if (
    !Number.isSafeInteger(totalPaise) ||
    totalPaise < 0 ||
    !Number.isInteger(passengers) ||
    passengers < 1 ||
    passengers > 4
  ) {
    throw new Error('Invalid fare or group size.');
  }
  const base = Math.floor(totalPaise / passengers);
  const remainder = totalPaise % passengers;
  return Array.from(
    { length: passengers },
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}
export const money = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const dateLabel = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
export const statusLabel = (status: RideStatus) =>
  status
    .toLowerCase()
    .split('_')
    .map(word => word[0].toUpperCase() + word.slice(1))
    .join(' ');
export const isOpen = (status: RideStatus) =>
  !['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(status);
