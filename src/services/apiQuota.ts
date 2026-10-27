import { ApiQuotaUsage } from '../types/domain';

// Legacy in-memory demo telemetry only. Live budgets are enforced by the gateway.
export const GOOGLE_QUOTA_LIMITS = {
  mapsLoads: 0,
  placesAutocomplete: 0,
  placesDetails: 0,
  directionsRequests: 30,
};

export function isDemoModeActive(quota: ApiQuotaUsage): boolean {
  if (!quota.googleMapsDemoMode) {
    return false;
  }
  const expires = Date.parse(quota.demoModeExpiresAt ?? '');
  return Number.isFinite(expires) && Date.now() < expires;
}

export function recordQuotaCall(
  quota: ApiQuotaUsage,
  type:
    | 'maps_load'
    | 'places_autocomplete'
    | 'places_details'
    | 'directions'
    | 'osrm'
    | 'offline',
  now = new Date().toISOString(),
): ApiQuotaUsage {
  switch (type) {
    case 'maps_load':
      return {
        ...quota,
        googleMapsLoads: quota.googleMapsLoads + 1,
        lastCallTimestamp: now,
        lastCallProvider: 'Google Maps SDK (Demo Mode)',
      };
    case 'places_autocomplete':
      return {
        ...quota,
        googlePlacesAutocomplete: quota.googlePlacesAutocomplete + 1,
        lastCallTimestamp: now,
        lastCallProvider: 'Google Places Autocomplete (Demo Mode)',
      };
    case 'places_details':
      return {
        ...quota,
        googlePlacesDetails: quota.googlePlacesDetails + 1,
        lastCallTimestamp: now,
        lastCallProvider: 'Google Places Details (Demo Mode)',
      };
    case 'directions':
      return {
        ...quota,
        googleDirectionsRequests: quota.googleDirectionsRequests + 1,
        lastCallTimestamp: now,
        lastCallProvider: 'Google Directions API (Demo Mode)',
      };
    case 'osrm':
      return {
        ...quota,
        osrmRouteRequests: quota.osrmRouteRequests + 1,
        lastCallTimestamp: now,
        lastCallProvider: 'OSRM Engine (Open Source - Free)',
      };
    case 'offline':
      return {
        ...quota,
        offlineFallbackRequests: quota.offlineFallbackRequests + 1,
        lastCallTimestamp: now,
        lastCallProvider: 'Offline Bengaluru Road Topology (Embedded - Free)',
      };
    default:
      return quota;
  }
}

export function getQuotaGauges(quota: ApiQuotaUsage) {
  const totalGoogleCalls =
    quota.googleMapsLoads +
    quota.googlePlacesAutocomplete +
    quota.googlePlacesDetails +
    quota.googleDirectionsRequests;
  return {
    totalGoogleCalls,
    totalOpenSourceCalls:
      quota.osrmRouteRequests +
      quota.osmTileRequests +
      quota.offlineFallbackRequests,
    status: totalGoogleCalls >= 30 ? 'critical' : 'safe',
  };
}
