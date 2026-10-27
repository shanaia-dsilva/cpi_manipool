import { Coordinate, RouteGeometry } from '../types/domain';

export interface GatewayStatus {
  configured: boolean;
  active: boolean;
  expiresAt: number | null;
  total: number;
  daily: number;
  session: number;
  lastAttempt: string | null;
  day: string;
  limits: {
    total: number;
    daily: number;
    session: number;
    perMinute: number;
    minutes: number;
  };
  sessionId?: string;
}
let baseUrl = '';
let accessToken = '';
let sessionId = '';
let expiresAt = 0;
let version = 0;
const listeners = new Set<() => void>();
export const subscribeRouting = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const routingVersion = () => version;
const notify = () => {
  version++;
  listeners.forEach(fn => fn());
};
export const liveRoutingActive = () => !!sessionId && Date.now() < expiresAt;
export function configureGateway(url: string, token: string) {
  const clean = url.trim().replace(/\/$/, '');
  if (
    !/^https:\/\//.test(clean) &&
    !/^http:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2):\d+$/.test(clean)
  ) {
    throw new Error('Use HTTPS, or a local development gateway address.');
  }
  if (token.trim().length < 24)
    throw new Error('Enter the demo access token (at least 24 characters).');
  baseUrl = clean;
  accessToken = token.trim();
  sessionId = '';
  expiresAt = 0;
  notify();
}
async function request(path: string, body?: object) {
  if (!baseUrl)
    throw new Error(
      'Connect the local demo gateway on the API status page first.',
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || 'Demo gateway unavailable.');
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export async function getGatewayStatus(): Promise<GatewayStatus> {
  const result = await request('/status');
  if (!result.active && sessionId) {
    sessionId = '';
    expiresAt = 0;
    notify();
  }
  return result;
}
export async function setLiveRouting(enabled: boolean): Promise<GatewayStatus> {
  if (!enabled) {
    sessionId = '';
    expiresAt = 0;
    notify();
  }
  const result = await request('/mode', { enabled });
  sessionId = result.sessionId || '';
  expiresAt = result.expiresAt || 0;
  notify();
  return result;
}
export function expireLiveRouting() {
  if (sessionId && !liveRoutingActive()) {
    sessionId = '';
    expiresAt = 0;
    notify();
  }
}
const pending = new Map<string, Promise<RouteGeometry>>();
export async function requestLiveRoute(
  points: Coordinate[],
  mode: 'DRIVE' | 'WALK',
  decode: (value: string) => Coordinate[],
): Promise<RouteGeometry> {
  if (!liveRoutingActive())
    throw new Error(
      'Live mode is off or expired. Enable it on the API status page.',
    );
  const id = sessionId;
  const key = JSON.stringify({ id, points, mode });
  // Only coalesce in-flight requests. No persistent Google content cache.
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    const data = await request('/route', { points, mode, sessionId: id });
    if (sessionId !== id || !liveRoutingActive())
      throw new Error('Live mode changed; please retry.');
    const coordinates = decode(data.encodedPolyline);
    if (coordinates.length < 2)
      throw new Error('Route geometry unavailable. Try another location.');
    return {
      coordinates,
      distanceKm: data.distanceKm,
      durationMinutes: data.durationMinutes,
      provider: 'google' as const,
      status: 'success' as const,
      summary: data.summary,
    };
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}
