import {
  calculateRoute,
  compatibilityFromRoutes,
  decodePolyline,
} from '../src/services/routing';
import { configureGateway, setLiveRouting } from '../src/services/liveRouting';
import { compareLivePickupArrangements } from '../src/services/pickupOptimization';
import { locations } from '../src/data/fixtures';
import { RouteGeometry } from '../src/types/domain';

const campus = locations.find(p => p.id === 'campus')!;
const airport = locations.find(p => p.id === 'airport')!;
const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = fetchMock;
  fetchMock.mockReset();
  configureGateway(
    'http://127.0.0.1:8787',
    'test-token-with-at-least-24-characters',
  );
});
afterAll(() => {
  globalThis.fetch = originalFetch;
});
const ok = (body: object) => ({ ok: true, json: async () => body });
async function enable() {
  fetchMock.mockResolvedValueOnce(
    ok({ sessionId: 'session-one', expiresAt: Date.now() + 60000 }),
  );
  await setLiveRouting(true);
  fetchMock.mockClear();
}
test('default mode makes no network calls; never fabricates a Google response', async () => {
  expect((await calculateRoute([campus, airport])).provider).toBe(
    'offline_bengaluru',
  );
  expect(
    (await calculateRoute([campus, airport], { useGoogleDemo: true })).status,
  ).toBe('failed');
  expect(fetchMock).not.toHaveBeenCalled();
});
test('rejects any invalid intermediate stop instead of silently dropping it', async () => {
  const result = await calculateRoute([
    campus,
    { latitude: 100, longitude: 77 },
    airport,
  ]);
  expect(result.status).toBe('failed');
  expect(fetchMock).not.toHaveBeenCalled();
});
test('a real gateway response provides distance/time and concurrent calls are coalesced', async () => {
  await enable();
  fetchMock.mockResolvedValue(
    ok({
      distanceKm: 24.3,
      durationMinutes: 31.5,
      encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
      summary: 'Google road route',
    }),
  );
  const [a, b] = await Promise.all([
    calculateRoute([campus, airport]),
    calculateRoute([campus, airport]),
  ]);
  expect(a.provider).toBe('google');
  expect(a.distanceKm).toBe(24.3);
  expect(a).toEqual(b);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
test('quota or network failure stays failed and has no paid retry or fake fallback', async () => {
  await enable();
  fetchMock.mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Demo request limit reached.' }),
  });
  const result = await calculateRoute([campus, airport]);
  expect(result.status).toBe('failed');
  expect(result.error).toContain('limit');
  expect(result.provider).not.toBe('google');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
test('malformed polylines are rejected and incompatible routes are not clamped into matches', () => {
  expect(() => decodePolyline('~')).toThrow();
  const direct: RouteGeometry = {
    coordinates: [campus.coordinate!, airport.coordinate!],
    distanceKm: 20,
    durationMinutes: 30,
    summary: '',
    status: 'success',
    provider: 'google',
  };
  const combined = {
    ...direct,
    coordinates: [
      { latitude: 12.9, longitude: 77.4 },
      { latitude: 12.91, longitude: 77.41 },
    ],
    distanceKm: 50,
    durationMinutes: 80,
  };
  const metrics = compatibilityFromRoutes(direct, combined, direct);
  expect(metrics.routeOverlap).toBe(0);
  expect(metrics.detourMinutes).toBe(53);
  expect(() =>
    compatibilityFromRoutes(
      { ...direct, status: 'fallback' },
      combined,
      direct,
    ),
  ).toThrow();
});
test('live pickup comparison uses walking distances and selects faster road order', async () => {
  await enable();
  const responses = [
    [20, 30],
    [21, 32], // direct and common
    [0.1, 2],
    [0.2, 3],
    [0.7, 10], // walks: one exceeds 500 m
    [24, 40],
    [22, 34], // two pickup orders
  ];
  for (const [distanceKm, durationMinutes] of responses)
    fetchMock.mockResolvedValueOnce(
      ok({
        distanceKm,
        durationMinutes,
        encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
        summary: 'Google road route',
      }),
    );
  const members = [
    {
      id: 'you',
      name: 'You',
      email: '',
      area: '',
      coordinate: campus.coordinate,
    },
    {
      id: 'a',
      name: 'A',
      email: '',
      area: '',
      coordinate: { latitude: 13.107, longitude: 77.598 },
    },
    {
      id: 'b',
      name: 'B',
      email: '',
      area: '',
      coordinate: { latitude: 13.104, longitude: 77.592 },
    },
  ];
  const result = await compareLivePickupArrangements(campus, airport, members);
  expect(result.common.feasible).toBe(false);
  expect(result.recommendedMode).toBe('sequential');
  expect(result.sequential.stops.map(p => p.studentId)).toEqual([
    'you',
    'b',
    'a',
  ]);
  expect(result.sequential.totalDetourKm).toBe(2);
  expect(result.sequential.totalDetourMinutes).toBe(13); // 4 road + 9 boarding
  expect(fetchMock).toHaveBeenCalledTimes(7);
});
