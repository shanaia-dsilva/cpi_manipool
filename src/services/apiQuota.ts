import { ApiQuotaUsage } from '../types/domain';

export const GOOGLE_QUOTA_LIMITS = {
  mapsLoads: 28500, // Monthly free tier dynamic map loads on mobile/web
  placesAutocomplete: 10000, // Autocomplete sessions/per-request limit
  placesDetails: 5000, // Basic place details
  directionsRequests: 10000, // Directions / Routes API requests
  monthlyCreditUsd: 200, // Monthly recurring Google Cloud credit
  usdToInrRate: 86.5,
};

export const MAPPING_PROVIDERS_EVALUATION = [
  {
    id: 'osm_osrm',
    name: 'OpenStreetMap + OSRM (Default Engine)',
    role: 'Primary Active System',
    localCoverage:
      'High for Bengaluru (All NH 44, Bellary Rd, Outer Ring Rd, Yelahanka roads well-tagged)',
    hosting:
      'Free public OSRM server (`router.project-osrm.org`) + embedded offline graph fallback',
    freeLimits: 'Unlimited for reasonable academic demo use (fair-use policy)',
    cost: '₹0.00 / Free & Open Source',
    attribution: '© OpenStreetMap contributors (ODbL license)',
    status: 'ACTIVE_DEFAULT',
  },
  {
    id: 'google_maps',
    name: 'Google Maps Platform (Demo Gate)',
    role: 'Faculty Presentation Mode Only',
    localCoverage:
      'Industry benchmark for Bengaluru (Live traffic, building footprints, places)',
    hosting: 'Cloud SaaS (Google Cloud Platform API Key restricted by SHA-1)',
    freeLimits:
      '~$200 monthly credit (28,500 map loads, 10,000 Directions calls)',
    cost: 'Free within $200 credit; overages billed per 1,000 requests',
    attribution: 'Google logo & attribution required on map view',
    status: 'GATED_DEMO_ONLY',
  },
  {
    id: 'maplibre',
    name: 'MapLibre GL Native / Web',
    role: 'Open-source Vector Renderer',
    localCoverage:
      'Excellent vector styling; requires hosted vector tile source (e.g. Protomaps / MapTiler)',
    hosting:
      'Self-hosted PMTiles or free MapTiler tier (100k requests/month)',
    freeLimits: '100,000 tile requests/month on free tier',
    cost: 'Free for open-source self-hosting; ~$20/mo managed',
    attribution: 'MapLibre + OpenStreetMap contributors',
    status: 'EVALUATED_ALTERNATIVE',
  },
  {
    id: 'tomtom',
    name: 'TomTom Maps & Routing',
    role: 'Commercial Navigation Alternative',
    localCoverage: 'Good coverage across tier-1 Indian metros including BLR',
    hosting: 'TomTom Developer Cloud API',
    freeLimits: '2,500 free requests per day (~75,000/month)',
    cost: 'Free tier available, then pay-as-you-go',
    attribution: 'TomTom attribution required',
    status: 'EVALUATED_ALTERNATIVE',
  },
];

export function isDemoModeActive(quota: ApiQuotaUsage): boolean {
  if (!quota.googleMapsDemoMode) {
    return false;
  }
  if (quota.demoModeExpiresAt) {
    const expires = Date.parse(quota.demoModeExpiresAt);
    if (Number.isFinite(expires) && Date.now() > expires) {
      return false; // Auto-expired to protect quota!
    }
  }
  return true;
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
  const mapsPct = (quota.googleMapsLoads / GOOGLE_QUOTA_LIMITS.mapsLoads) * 100;
  const placesPct =
    (quota.googlePlacesAutocomplete /
      GOOGLE_QUOTA_LIMITS.placesAutocomplete) *
    100;
  const directionsPct =
    (quota.googleDirectionsRequests /
      GOOGLE_QUOTA_LIMITS.directionsRequests) *
    100;

  const maxPct = Math.max(mapsPct, placesPct, directionsPct);
  const status: 'safe' | 'warning' | 'critical' =
    maxPct >= 85 ? 'critical' : maxPct >= 50 ? 'warning' : 'safe';

  // Cost estimation (USD and INR)
  const estimatedCostUsd =
    (quota.googleMapsLoads / 1000) * 7.0 +
    (quota.googlePlacesAutocomplete / 1000) * 2.83 +
    (quota.googleDirectionsRequests / 1000) * 5.0;

  const estimatedCostInr = Math.round(
    estimatedCostUsd * GOOGLE_QUOTA_LIMITS.usdToInrRate,
  );
  const creditRemainingInr = Math.max(
    0,
    Math.round(
      GOOGLE_QUOTA_LIMITS.monthlyCreditUsd *
        GOOGLE_QUOTA_LIMITS.usdToInrRate -
        estimatedCostInr,
    ),
  );

  return {
    mapsPct: Math.min(100, mapsPct),
    placesPct: Math.min(100, placesPct),
    directionsPct: Math.min(100, directionsPct),
    maxPct: Math.min(100, maxPct),
    status,
    estimatedCostInr,
    creditRemainingInr,
    isWithinFreeTier: estimatedCostUsd <= GOOGLE_QUOTA_LIMITS.monthlyCreditUsd,
    totalGoogleCalls:
      quota.googleMapsLoads +
      quota.googlePlacesAutocomplete +
      quota.googlePlacesDetails +
      quota.googleDirectionsRequests,
    totalOpenSourceCalls:
      quota.osrmRouteRequests +
      quota.osmTileRequests +
      quota.offlineFallbackRequests,
  };
}
