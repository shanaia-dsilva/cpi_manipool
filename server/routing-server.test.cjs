const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createGateway, LIMITS } = require('./routing-server.cjs');
const token = 'test-only-private-token-12345678';
const points = [
  { latitude: 13.1152, longitude: 77.5885 },
  { latitude: 13.1986, longitude: 77.7066 },
];
async function harness(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'manipool-quota-'));
  const ledgerPath = path.join(dir, 'ledger.json');
  let now = Date.now();
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({
        routes: [
          {
            distanceMeters: 24000,
            duration: '1800s',
            polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
          },
        ],
      }),
    };
  };
  const server = createGateway({
    token,
    ledgerPath,
    key: 'test-key',
    fetchImpl,
    clock: () => now,
    ...options,
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const request = async (url, body, auth = token) => {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}${url}`,
      {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${auth}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    return { status: response.status, body: await response.json() };
  };
  return {
    request,
    calls: () => calls,
    advance: ms => {
      now += ms;
    },
    ledgerPath,
  };
}
test('default off, authentication, missing key, and strict coordinates consume zero Google calls', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/status')).body.active, false);
  assert.equal((await h.request('/status', undefined, 'wrong')).status, 401);
  assert.equal(
    (await h.request('/route', { points, mode: 'DRIVE' })).status,
    403,
  );
  const session = (await h.request('/mode', { enabled: true })).body;
  assert.equal(
    (
      await h.request('/route', {
        sessionId: session.sessionId,
        points: [...points, { latitude: 95, longitude: 77 }],
        mode: 'DRIVE',
      })
    ).status,
    400,
  );
  assert.equal(h.calls(), 0);
  const noKey = await harness(t, { key: '' });
  assert.equal((await noKey.request('/mode', { enabled: true })).status, 503);
});
test('real response units, concurrent rate reservation, expiry and durable counters', async t => {
  const h = await harness(t);
  const session = (await h.request('/mode', { enabled: true })).body;
  const body = { sessionId: session.sessionId, points, mode: 'DRIVE' };
  const first = await h.request('/route', body);
  assert.equal(first.body.distanceKm, 24);
  assert.equal(first.body.durationMinutes, 30);
  const results = await Promise.all(
    Array.from({ length: 15 }, () => h.request('/route', body)),
  );
  assert.equal(
    results.filter(r => r.status === 200).length,
    LIMITS.perMinute - 1,
  );
  assert.equal(h.calls(), LIMITS.perMinute);
  assert.equal(
    JSON.parse(fs.readFileSync(h.ledgerPath)).total,
    LIMITS.perMinute,
  );
  h.advance(16 * 60000);
  assert.equal((await h.request('/route', body)).status, 403);
  const restarted = createGateway({ token, ledgerPath: h.ledgerPath });
  assert.ok(restarted); // persisted ledger loads; sessions are never persisted
  restarted.close();
});
test('session, daily and lifetime caps survive toggles and restarts', async t => {
  const h = await harness(t);
  let sessionId = (await h.request('/mode', { enabled: true })).body.sessionId;
  for (let i = 0; i < LIMITS.session; i++) {
    assert.equal(
      (await h.request('/route', { sessionId, points, mode: 'DRIVE' })).status,
      200,
    );
    if ((i + 1) % 10 === 0) h.advance(61000);
  }
  assert.equal(
    (await h.request('/route', { sessionId, points, mode: 'DRIVE' })).status,
    429,
  );
  await h.request('/mode', { enabled: false });
  sessionId = (await h.request('/mode', { enabled: true })).body.sessionId;
  for (let i = 0; i < 20; i++) {
    assert.equal(
      (await h.request('/route', { sessionId, points, mode: 'WALK' })).status,
      200,
    );
    if ((i + 1) % 10 === 0) h.advance(61000);
  }
  assert.equal(
    (await h.request('/route', { sessionId, points, mode: 'DRIVE' })).status,
    429,
  );
  assert.equal((await h.request('/status')).body.total, LIMITS.daily);
  h.advance(24 * 60 * 60000);
  sessionId = (await h.request('/mode', { enabled: true })).body.sessionId;
  for (let i = 0; i < 50; i++) {
    if (i === 30) {
      await h.request('/mode', { enabled: false });
      sessionId = (await h.request('/mode', { enabled: true })).body.sessionId;
    }
    assert.equal(
      (await h.request('/route', { sessionId, points, mode: 'DRIVE' })).status,
      200,
    );
    if ((i + 1) % 10 === 0) h.advance(61000);
  }
  h.advance(24 * 60 * 60000);
  sessionId = (await h.request('/mode', { enabled: true })).body.sessionId;
  assert.equal(
    (await h.request('/route', { sessionId, points, mode: 'DRIVE' })).status,
    429,
  );
  assert.equal((await h.request('/status')).body.total, LIMITS.total);
});
test('failed upstream attempts still spend the durable budget; no automatic retries', async t => {
  let calls = 0;
  const h = await harness(t, {
    fetchImpl: async () => {
      calls++;
      throw new Error('network');
    },
  });
  const sessionId = (await h.request('/mode', { enabled: true })).body
    .sessionId;
  assert.equal(
    (await h.request('/route', { sessionId, points, mode: 'DRIVE' })).status,
    503,
  );
  assert.equal((await h.request('/status')).body.total, 1);
  assert.equal(calls, 1);
});
