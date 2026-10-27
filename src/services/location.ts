import { PermissionsAndroid, Platform } from 'react-native';
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
    return 'granted';
  }
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'MAHE Carpool Location Access',
        message:
          'Allow MAHE Carpool to detect your location to set your pickup point near campus or transit stops.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'Allow',
      },
    );

    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      return 'granted';
    }
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

  // When permission is granted, resolve coordinate
  // On device/emulator without GPS fix or when simulation provided
  const targetCoord: Coordinate =
    simulatedCoord ?? { latitude: 13.1152, longitude: 77.5885 }; // Default to MAHE Main Gate coordinates

  const nearest = findNearestLandmark(targetCoord, 1.5);
  const location: Location = nearest ?? {
    id: `gps:${targetCoord.latitude.toFixed(4)},${targetCoord.longitude.toFixed(4)}`,
    name: 'Current Device Location',
    area: 'Near MAHE Bengaluru Campus',
    kind: 'campus',
    corridor: 'campus',
    coordinate: targetCoord,
    source: 'gps',
    isPickupSuitable: true,
    accessNote: 'Current device GPS position',
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
