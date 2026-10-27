import {
  demoProfile,
  getLocation,
  initialQuotaUsage,
  vehicleOptions,
} from '../data/fixtures';
import {
  AppState,
  ChatMessage,
  DemoScenario,
  Location,
  PickupArrangement,
  RideDraft,
  RideRequest,
  RouteGeometry,
  Student,
} from '../types/domain';
import {
  canTransition,
  departureFromDraft,
  isOpen,
  validateDraft,
} from '../services/journey';
import { demoMatchingService } from '../services/matching';
import { computeOfflineRoute } from '../services/routing';
import { comparePickupArrangements } from '../services/pickupOptimization';
import { recordQuotaCall } from '../services/apiQuota';

export function initialDraft(now = new Date()): RideDraft {
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return {
    pickupId: 'campus',
    destinationId: 'airport',
    date: `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(tomorrow.getDate()).padStart(2, '0')}`,
    time: '18:45',
    flexibility: 30,
  };
}

export const initialState = (): AppState => ({
  profile: demoProfile,
  signedIn: false,
  draft: initialDraft(),
  rides: [],
  groups: [],
  customPlaces: [],
  scenario: 'normal',
  notifications: false,
  savedPlaces: ['campus', 'airport'],
  reports: [],
  apiQuota: initialQuotaUsage,
});

export type Action =
  | { type: 'SIGN_IN'; profile: Student }
  | { type: 'DRAFT'; patch: Partial<RideDraft> }
  | {
      type: 'SELECT_PLACE';
      field: 'pickupId' | 'destinationId';
      location: Location;
    }
  | { type: 'SEARCH'; id: string; now: string }
  | { type: 'SEARCH_DONE'; rideId: string; now: string }
  | { type: 'REMATCH'; rideId: string; flexibility?: RideDraft['flexibility'] }
  | {
      type: 'JOIN' | 'ACCEPT_DEMO' | 'START' | 'COMPLETE' | 'LEAVE';
      rideId: string;
      now: string;
    }
  | {
      type: 'PICKUP';
      rideId: string;
      mode: 'common' | 'sequential';
      now: string;
    }
  | { type: 'MESSAGE'; rideId: string; text: string; now: string; id: string }
  | { type: 'DELAY'; rideId: string; now: string }
  | { type: 'BOOK'; rideId: string; optionId: 'cab' | 'auto'; now: string }
  | { type: 'SCENARIO'; scenario: DemoScenario }
  | { type: 'NOTIFICATIONS'; enabled: boolean }
  | { type: 'SAVE'; locationId: string }
  | { type: 'REPORT'; text: string; rideId?: string; id: string; now: string }
  | {
      type: 'SET_DEMO_MODE';
      enabled: boolean;
      timeoutMinutes?: number;
    }
  | {
      type: 'RECORD_API_CALL';
      callType:
        | 'maps_load'
        | 'places_autocomplete'
        | 'places_details'
        | 'directions'
        | 'osrm'
        | 'offline';
    }
  | { type: 'RESET_API_QUOTA' }
  | { type: 'SET_ROUTE'; rideId: string; route: RouteGeometry }
  | {
      type: 'SET_PICKUP_ARRANGEMENT';
      rideId: string;
      arrangement: PickupArrangement;
    }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

function event(text: string, now: string, id: string): ChatMessage {
  return {
    id,
    senderId: 'system',
    sender: 'Carpool',
    text,
    timestamp: now,
    system: true,
  };
}

export function appReducer(state: AppState, action: Action): AppState {
  const reject = (error: string) => ({ ...state, error });

  if (action.type === 'CLEAR_ERROR') {
    return { ...state, error: undefined };
  }

  if (action.type === 'RESET') {
    return {
      ...initialState(),
      profile: state.profile,
      signedIn: state.signedIn,
      apiQuota: {
        ...initialQuotaUsage,
        googleMapsDemoMode: state.apiQuota.googleMapsDemoMode,
      },
    };
  }

  if (action.type === 'SET_DEMO_MODE') {
    const timeout = action.timeoutMinutes ?? state.apiQuota.autoTimeoutMinutes;
    const expiresAt = action.enabled
      ? new Date(Date.now() + timeout * 60000).toISOString()
      : undefined;

    return {
      ...state,
      apiQuota: {
        ...state.apiQuota,
        googleMapsDemoMode: action.enabled,
        demoModeExpiresAt: expiresAt,
        autoTimeoutMinutes: timeout,
        lastCallProvider: action.enabled
          ? 'Google Maps Platform (Demo Mode Activated)'
          : 'OSRM / OpenStreetMap (Safe Free Mode)',
      },
    };
  }

  if (action.type === 'RECORD_API_CALL') {
    return {
      ...state,
      apiQuota: recordQuotaCall(state.apiQuota, action.callType),
    };
  }

  if (action.type === 'RESET_API_QUOTA') {
    return {
      ...state,
      apiQuota: {
        ...initialQuotaUsage,
        googleMapsDemoMode: state.apiQuota.googleMapsDemoMode,
      },
    };
  }

  if (action.type === 'SIGN_IN') {
    if (
      !action.profile.name.trim() ||
      !/^[^\s@]+@(?:learner\.)?manipal\.edu$/i.test(action.profile.email)
    ) {
      return reject('Enter a name and a MAHE-style demo email.');
    }
    return {
      ...state,
      profile: {
        ...action.profile,
        name: action.profile.name.trim(),
        email: action.profile.email.trim(),
      },
      signedIn: true,
      error: undefined,
    };
  }

  if (action.type === 'DRAFT') {
    return {
      ...state,
      draft: { ...state.draft, ...action.patch },
      error: undefined,
    };
  }

  if (action.type === 'SELECT_PLACE') {
    const location = action.location;
    const point = location.coordinate;
    if (
      !location.id ||
      !location.name.trim() ||
      !point ||
      !Number.isFinite(point.latitude) ||
      Math.abs(point.latitude) > 90 ||
      !Number.isFinite(point.longitude) ||
      Math.abs(point.longitude) > 180 ||
      getLocation(location.id)
    ) {
      return reject('Choose a valid place or map point.');
    }
    return {
      ...state,
      customPlaces: [
        ...state.customPlaces.filter(item => item.id !== location.id),
        location,
      ],
      draft: { ...state.draft, [action.field]: location.id },
      error: undefined,
    };
  }

  if (action.type === 'SCENARIO') {
    return { ...state, scenario: action.scenario };
  }

  if (action.type === 'NOTIFICATIONS') {
    return { ...state, notifications: action.enabled };
  }

  if (action.type === 'SAVE') {
    return getLocation(action.locationId, state.customPlaces)
      ? {
          ...state,
          savedPlaces: state.savedPlaces.includes(action.locationId)
            ? state.savedPlaces.filter(id => id !== action.locationId)
            : [...state.savedPlaces, action.locationId],
        }
      : reject('That demo place is unavailable.');
  }

  if (action.type === 'REPORT') {
    if (!action.text.trim()) {
      return reject('Describe the issue before saving a report.');
    }
    return {
      ...state,
      reports: [
        ...state.reports,
        {
          id: action.id,
          rideId: action.rideId,
          text: action.text.trim(),
          timestamp: action.now,
        },
      ],
      error: undefined,
    };
  }

  if (action.type === 'SEARCH') {
    if (state.rides.some(ride => isOpen(ride.status))) {
      return reject(
        'Resume or cancel your existing request before creating another.',
      );
    }
    const error = validateDraft(
      state.draft,
      Date.parse(action.now),
      state.customPlaces,
    );
    if (error) {
      return reject(error);
    }
    const pickup = getLocation(state.draft.pickupId, state.customPlaces);
    const destination = getLocation(
      state.draft.destinationId,
      state.customPlaces,
    );
    const departure = departureFromDraft(state.draft);
    if (!pickup || !destination || !departure) {
      return reject('Choose valid journey details.');
    }

    const route =
      pickup.coordinate && destination.coordinate
        ? computeOfflineRoute([pickup.coordinate, destination.coordinate])
        : undefined;

    const ride: RideRequest = {
      id: action.id,
      userId: state.profile.id,
      pickup,
      destination,
      departure: departure.toISOString(),
      flexibility: state.draft.flexibility,
      createdAt: action.now,
      status: 'SEARCHING',
      matches: [],
      route,
    };
    return { ...state, rides: [...state.rides, ride], error: undefined };
  }

  const ride = state.rides.find(item => item.id === action.rideId);
  if (!ride) {
    return reject('This demo ride is unavailable. Return to Home.');
  }
  const group = state.groups.find(item => item.id === ride.groupId);

  function update(nextRide: RideRequest, nextGroup = group): AppState {
    return {
      ...state,
      error: undefined,
      rides: state.rides.map(item => (item.id === ride?.id ? nextRide : item)),
      groups: nextGroup
        ? state.groups.some(item => item.id === nextGroup.id)
          ? state.groups.map(item =>
              item.id === nextGroup.id ? nextGroup : item,
            )
          : [...state.groups, nextGroup]
        : state.groups,
    };
  }

  if (action.type === 'SET_ROUTE') {
    return update({ ...ride, route: action.route });
  }

  if (action.type === 'SET_PICKUP_ARRANGEMENT') {
    if (!group) return state;
    return update(ride, { ...group, pickupArrangement: action.arrangement });
  }

  if (action.type === 'SEARCH_DONE') {
    if (!['SEARCHING', 'REMATCHING'].includes(ride.status)) {
      return state;
    }
    if (Date.parse(ride.departure) <= Date.parse(action.now)) {
      return update({ ...ride, status: 'EXPIRED' });
    }
    const matches = demoMatchingService.findMatches(ride, state.scenario);
    return update({
      ...ride,
      matches,
      status: matches.length ? 'MATCH_FOUND' : 'NO_MATCH',
    });
  }

  if (action.type === 'REMATCH') {
    if (!canTransition(ride.status, 'REMATCHING')) {
      return reject('This request cannot be searched again.');
    }
    return update({
      ...ride,
      status: 'REMATCHING',
      matches: [],
      flexibility: action.flexibility ?? ride.flexibility,
    });
  }

  if (action.type === 'JOIN') {
    if (
      !canTransition(ride.status, 'WAITING_FOR_ACCEPTANCE') ||
      !ride.matches.length
    ) {
      return reject('Choose an available match first.');
    }
    return update({ ...ride, status: 'WAITING_FOR_ACCEPTANCE' });
  }

  if (action.type === 'ACCEPT_DEMO') {
    if (
      !canTransition(ride.status, 'GROUP_FORMED') ||
      !ride.matches.length ||
      group
    ) {
      return reject('Group acceptance is already resolved or unavailable.');
    }
    const members = [
      state.profile,
      ...ride.matches.map(match => match.student),
    ];
    if (
      members.length < 2 ||
      members.length > 4 ||
      new Set(members.map(member => member.id)).size !== members.length
    ) {
      return reject('The demo group needs 2–4 distinct riders.');
    }

    // Evaluate practical pickup arrangement
    const pickupAnalysis = comparePickupArrangements(
      ride.pickup,
      ride.destination,
      members,
    );
    const chosenArrangement = pickupAnalysis.common;
    const meetingPointLoc = chosenArrangement.meetingPointCoordinate
      ? {
          id: 'meeting-point',
          name: chosenArrangement.meetingPointName || 'Common Meeting Point',
          area: 'Agreed Group Pickup Zone',
          kind: 'campus' as const,
          corridor: ride.destination.corridor,
          coordinate: chosenArrangement.meetingPointCoordinate,
          isPickupSuitable: true,
        }
      : undefined;

    const groupId = `group-${ride.id}`;
    return update(
      { ...ride, status: 'GROUP_FORMED', groupId },
      {
        id: groupId,
        rideId: ride.id,
        members,
        pickupMode: 'common',
        pickupArrangement: chosenArrangement,
        meetingPoint: meetingPointLoc,
        status: 'GROUP_FORMED',
        messages: [
          event(
            `${members
              .map(member => member.name)
              .join(', ')} joined after simulated mutual acceptance.`,
            action.now,
            `${groupId}-joined`,
          ),
          {
            id: `${groupId}-hello`,
            senderId: members[1].id,
            sender: members[1].name,
            text: chosenArrangement.meetingPointName
              ? `Shall we meet at ${chosenArrangement.meetingPointName}?`
              : 'Shall we meet at the campus main gate?',
            timestamp: action.now,
            system: false,
          },
        ],
      },
    );
  }

  if (action.type === 'LEAVE') {
    if (!canTransition(ride.status, 'CANCELLED')) {
      return reject('This ride is already finished.');
    }
    return update(
      { ...ride, status: 'CANCELLED' },
      group
        ? {
            ...group,
            members: group.members.filter(
              member => member.id !== state.profile.id,
            ),
            messages: [
              ...group.messages,
              event(
                `${state.profile.name} left. Remaining demo riders retain their trip; the fare split is recalculated.`,
                action.now,
                `${ride.id}-left`,
              ),
            ],
          }
        : undefined,
    );
  }

  if (
    !group ||
    !group.members.some(member => member.id === state.profile.id) ||
    !['GROUP_FORMED', 'RIDE_BOOKED', 'IN_PROGRESS', 'COMPLETED'].includes(
      ride.status,
    )
  ) {
    return reject('Join a formed carpool to use this action.');
  }

  if (action.type === 'PICKUP') {
    if (ride.status !== 'GROUP_FORMED') {
      return reject('Pickup arrangements are locked after booking.');
    }
    if (group.pickupMode === action.mode) {
      return state;
    }

    const analysis = comparePickupArrangements(
      ride.pickup,
      ride.destination,
      group.members,
    );
    const nextArrangement =
      action.mode === 'common' ? analysis.common : analysis.sequential;

    return update(ride, {
      ...group,
      pickupMode: action.mode,
      pickupArrangement: nextArrangement,
      messages: [
        ...group.messages,
        event(
          `Pickup changed to ${
            action.mode === 'common'
              ? `the common meeting point (${nextArrangement.meetingPointName ?? 'Campus Main Gate'})`
              : 'sequential pickups (stops ordered by road progression)'
          }.`,
          action.now,
          `${ride.id}-pickup-${group.messages.length}`,
        ),
      ],
    });
  }

  if (action.type === 'MESSAGE') {
    if (ride.status === 'COMPLETED') {
      return reject('Completed chats are read-only.');
    }
    const text = action.text.trim();
    if (!text || text.length > 500) {
      return reject('Write a message of 1–500 characters.');
    }
    if (group.messages.some(message => message.id === action.id)) {
      return state;
    }
    return update(ride, {
      ...group,
      messages: [
        ...group.messages,
        {
          id: action.id,
          senderId: state.profile.id,
          sender: state.profile.name,
          text,
          timestamp: action.now,
          system: false,
        },
      ],
    });
  }

  if (action.type === 'DELAY') {
    if (ride.status !== 'GROUP_FORMED') {
      return reject('Departure changes are locked after booking.');
    }
    const departure = new Date(
      Date.parse(ride.departure) + 10 * 60000,
    ).toISOString();
    return update(
      { ...ride, departure },
      {
        ...group,
        messages: [
          ...group.messages,
          event(
            'Demo riders agreed to leave 10 minutes later.',
            action.now,
            `${ride.id}-delay-${group.messages.length}`,
          ),
        ],
      },
    );
  }

  if (action.type === 'BOOK') {
    const option = vehicleOptions.find(item => item.id === action.optionId);
    if (
      !canTransition(ride.status, 'RIDE_BOOKED') ||
      !option ||
      option.capacity < group.members.length ||
      group.members.length < 2
    ) {
      return reject('Choose a vehicle that fits the formed group.');
    }
    return update(
      { ...ride, status: 'RIDE_BOOKED' },
      {
        ...group,
        status: 'RIDE_BOOKED',
        booking: { option, confirmedAt: action.now },
        messages: [
          ...group.messages,
          event(
            `${option.name} booking simulated. No provider was contacted.`,
            action.now,
            `${ride.id}-booked`,
          ),
        ],
      },
    );
  }

  if (action.type === 'START' || action.type === 'COMPLETE') {
    const status = action.type === 'START' ? 'IN_PROGRESS' : 'COMPLETED';
    if (!canTransition(ride.status, status) || !group.booking) {
      return reject('Complete the previous ride step first.');
    }
    return update(
      { ...ride, status },
      {
        ...group,
        status,
        messages: [
          ...group.messages,
          event(
            status === 'COMPLETED'
              ? 'Demo journey completed.'
              : 'Demo journey started.',
            action.now,
            `${ride.id}-${status}`,
          ),
        ],
      },
    );
  }

  return state;
}
