/* Local faculty-demo gateway. Run exactly one process against a durable ledger. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, timingSafeEqual } = require('node:crypto');

const LIMITS = Object.freeze({
  total: 100,
  daily: 50,
  session: 30,
  perMinute: 10,
  minutes: 15,
});
const validPoint = p =>
  p &&
  Number.isFinite(p.latitude) &&
  Number.isFinite(p.longitude) &&
  p.latitude >= 12.7 &&
  p.latitude <= 13.5 &&
  p.longitude >= 77.2 &&
  p.longitude <= 78;

function createGateway({
  key = '',
  token,
  ledgerPath,
  fetchImpl = fetch,
  clock = Date.now,
}) {
  if (!token || token.length < 24)
    throw new Error('DEMO_ADMIN_TOKEN must have at least 24 characters.');
  let ledger = { total: 0, days: {}, lastAttempt: null };
  if (fs.existsSync(ledgerPath))
    ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  if (
    !Number.isInteger(ledger.total) ||
    ledger.total < 0 ||
    !ledger.days ||
    Object.values(ledger.days).some(n => !Number.isInteger(n) || n < 0)
  )
    throw new Error('Invalid quota ledger; refusing to start.');
  const save = () => {
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    const tmp = `${ledgerPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(ledger), { mode: 0o600 });
    fs.renameSync(tmp, ledgerPath);
  };
  save();
  let session = null;
  let minuteCalls = [];
  const day = () => new Date(clock() + 330 * 60000).toISOString().slice(0, 10); // IST
  const active = () => session && session.expiresAt > clock();
  const status = () => ({
    configured: !!key,
    active: !!active(),
    expiresAt: active() ? session.expiresAt : null,
    total: ledger.total,
    daily: ledger.days[day()] || 0,
    session: session?.used || 0,
    lastAttempt: ledger.lastAttempt,
    limits: LIMITS,
    day: day(),
  });
  const fail = (message, code = 400) =>
    Object.assign(new Error(message), { code });
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const supplied = Buffer.from(
        (req.headers.authorization || '').replace(/^Bearer /, ''),
      );
      const expected = Buffer.from(token);
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        throw fail('Demo access denied.', 401);
      if (req.method === 'GET' && req.url === '/status') {
        res.end(JSON.stringify(status()));
        return;
      }
      if (req.method !== 'POST' || !['/mode', '/route'].includes(req.url))
        throw fail('Not found.', 404);
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 12000) throw fail('Request too large.', 413);
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        throw fail('Invalid JSON.');
      }
      if (req.url === '/mode') {
        if (typeof body.enabled !== 'boolean') throw fail('Specify enabled.');
        if (body.enabled) {
          if (!key)
            throw fail(
              'Configure GOOGLE_ROUTES_API_KEY on the demo server first.',
              503,
            );
          if (!active())
            session = {
              id: randomUUID(),
              used: 0,
              expiresAt: clock() + LIMITS.minutes * 60000,
            };
        } else {
          session = null;
        }
        res.end(
          JSON.stringify({
            ...status(),
            sessionId: active() ? session.id : null,
          }),
        );
        return;
      }
      if (!active() || body.sessionId !== session.id)
        throw fail(
          'Live demo is off or expired. Enable it on the API status page.',
          403,
        );
      if (
        !Array.isArray(body.points) ||
        body.points.length < 2 ||
        body.points.length > 5 ||
        !body.points.every(validPoint)
      )
        throw fail('Choose 2–5 valid Bengaluru locations.');
      if (!['DRIVE', 'WALK'].includes(body.mode))
        throw fail('Unsupported travel mode.');
      minuteCalls = minuteCalls.filter(t => t > clock() - 60000);
      if (
        ledger.total >= LIMITS.total ||
        (ledger.days[day()] || 0) >= LIMITS.daily ||
        session.used >= LIMITS.session ||
        minuteCalls.length >= LIMITS.perMinute
      )
        throw fail(
          'Demo request limit reached. Use demo results; check API status before retrying.',
          429,
        );
      // Reserve synchronously and durably BEFORE sending, including failed/aborted requests.
      ledger.total += 1;
      ledger.days[day()] = (ledger.days[day()] || 0) + 1;
      ledger.lastAttempt = new Date(clock()).toISOString();
      session.used += 1;
      minuteCalls.push(clock());
      save();
      const waypoint = p => ({ location: { latLng: p } });
      const points = body.points;
      const upstream = await fetchImpl(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          signal: AbortSignal.timeout(8000),
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask':
              'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
          },
          body: JSON.stringify({
            origin: waypoint(points[0]),
            destination: waypoint(points.at(-1)),
            intermediates: points.slice(1, -1).map(waypoint),
            travelMode: body.mode,
            ...(body.mode === 'DRIVE'
              ? { routingPreference: 'TRAFFIC_UNAWARE' }
              : {}),
            computeAlternativeRoutes: false,
            languageCode: 'en',
            units: 'METRIC',
          }),
        },
      );
      if (!upstream.ok)
        throw fail(
          `Google routing unavailable (${upstream.status}). Check server credentials/quota, or use demo mode.`,
          502,
        );
      const data = await upstream.json();
      const route = data.routes?.[0];
      const seconds = Number(route?.duration?.replace(/s$/, ''));
      if (
        !route ||
        !Number.isFinite(route.distanceMeters) ||
        route.distanceMeters < 0 ||
        !Number.isFinite(seconds) ||
        seconds < 0 ||
        typeof route.polyline?.encodedPolyline !== 'string'
      )
        throw fail(
          'No usable road route returned. Choose another pickup or destination.',
          422,
        );
      res.end(
        JSON.stringify({
          distanceKm: route.distanceMeters / 1000,
          durationMinutes: seconds / 60,
          encodedPolyline: route.polyline.encodedPolyline,
          provider: 'google',
          status: 'success',
          summary:
            body.mode === 'WALK'
              ? 'Google walking route · verify pedestrian access'
              : 'Google road route · traffic-unaware estimate',
        }),
      );
    } catch (error) {
      res.statusCode =
        error.code >= 400 && error.code <= 599 ? error.code : 503;
      res.end(
        JSON.stringify({
          error: error.code
            ? error.message
            : 'Routing service unavailable. Retry or switch to demo mode.',
        }),
      );
    }
  });
  return server;
}
if (require.main === module) {
  const ledgerPath =
    process.env.DEMO_LEDGER_PATH || path.join(__dirname, '.data', 'quota.json');
  // Exclusive lock prevents accidentally running two independent quota writers.
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const lock = `${ledgerPath}.lock`;
  fs.closeSync(fs.openSync(lock, 'wx', 0o600));
  process.on('exit', () => fs.unlinkSync(lock));
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => process.exit(0));
  const server = createGateway({
    key: process.env.GOOGLE_ROUTES_API_KEY,
    token: process.env.DEMO_ADMIN_TOKEN,
    ledgerPath,
  });
  server.listen(Number(process.env.PORT || 8787), '127.0.0.1', () =>
    console.log('Demo routing gateway: http://127.0.0.1:8787 (live OFF)'),
  );
}
module.exports = { createGateway, LIMITS, validPoint };
