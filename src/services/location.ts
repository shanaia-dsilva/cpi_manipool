import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { Coordinate, Location } from '../types/domain';
import { locations } from '../data/fixtures';
import { haversineDistance } from './routing';

export type LocationPermissionResult = 'granted' | 'denied' | 'unavailable';

export interface DeviceLocationResponse {
  status: LocationPermissionResult;
  coordinate?: Coordinate;
  resolvedLocation: Location;
  message: string;
}

// Fallback default landmark when device location is denied or unavailable
export const CAMPUS_GATE_FALLBACK: Location = locations[1]; // Campus main gate

// Check Android location permission
export async function checkLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    return await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
  } catch {
    return false;
  }
}

// Request Android location permission with user-facing rationale
export async function requestLocationPermission(): Promise<LocationPermissionResult> {
  if (Platform.OS !== 'android') {
    return 'unavailable';
  }
  try {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    if (
      Object.values(granted).some(
        value => value === PermissionsAndroid.RESULTS.GRANTED,
      )
    )
      return 'granted';
    return 'denied';
  } catch {
    return 'unavailable';
  }
}

// Find closest landmark in database to a given coordinate
export function findNearestLandmark(
  coord: Coordinate,
  maxDistanceKm = 5,
): Location | undefined {
  let nearest: Location | undefined;
  let minDistance = Infinity;

  for (const loc of locations) {
    if (!loc.coordinate) continue;
    const dist = haversineDistance(coord, loc.coordinate);
    if (dist < minDistance && dist <= maxDistanceKm) {
      minDistance = dist;
      nearest = loc;
    }
  }

  return nearest;
}

// Resolve device location with strict fallback behavior
export async function getDeviceLocationWithFallback(
  simulatedCoord?: Coordinate,
): Promise<DeviceLocationResponse> {
  const permStatus = await requestLocationPermission();

  if (permStatus !== 'granted') {
    return {
      status: permStatus,
      resolvedLocation: CAMPUS_GATE_FALLBACK,
      message:
        permStatus === 'denied'
          ? 'Location permission was denied. Selected Campus Main Gate as your fallback pickup.'
          : 'Location services unavailable. Selected Campus Main Gate as your fallback pickup.',
    };
  }

  let targetCoord: Coordinate;
  try {
    targetCoord =
      simulatedCoord ??
      (await NativeModules.DeviceLocation.getCurrentPosition());
    if (
      !Number.isFinite(targetCoord.latitude) ||
      !Number.isFinite(targetCoord.longitude)
    )
      throw new Error('Invalid location');
  } catch {
    return {
      status: 'unavailable',
      resolvedLocation: CAMPUS_GATE_FALLBACK,
      message:
        'No device location fix available. Campus main gate is a fallback, not your detected location. Choose a landmark or retry with location services enabled.',
    };
  }

  const nearest = findNearestLandmark(targetCoord, 0.1);
  const location: Location = nearest ?? {
    id: `gps:${targetCoord.latitude.toFixed(4)},${targetCoord.longitude.toFixed(
      4,
    )}`,
    name: 'Current Device Location',
    area: 'Device coordinates · confirm pickup access',
    kind: 'city',
    corridor: 'custom',
    coordinate: targetCoord,
    source: 'gps',
    isPickupSuitable: false,
    accessNote: 'Device position; confirm legal vehicle access before pickup',
  };

  return {
    status: 'granted',
    coordinate: targetCoord,
    resolvedLocation: location,
    message: nearest
      ? `Detected your location near ${nearest.name}.`
      : 'Location detected successfully.',
  };
}
