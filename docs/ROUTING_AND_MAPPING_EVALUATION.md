# Routing decision and faculty demo handoff

Reviewed 27 October 2026. Owner: Shanaia. No optional Google Maps PR was merged.

## Decision

Use local, explicitly labeled estimates for everyday development. They use geographic distance and speed assumptions, not an offline road graph. No OSRM, Google, tile or geocoding requests occur in this mode.

For the temporary faculty demo, use Google Routes Compute Routes through the included local gateway. Requests use DRIVE with TRAFFIC_UNAWARE, or WALK for meeting-point access. These are road-based estimates, not live traffic. The mobile application never receives the Google API key. Search remains a local Bengaluru landmark catalogue; Places and map SDK billing are not enabled.

The in-app diagram is a schematic for demo results only. Live results show Google Maps attribution and an explicit link that opens the pickup, ordered intermediate stops and destination in Google Maps. The external application recalculates its display and may choose a different road path. We do not claim an embedded Google map. Google route geometry is not drawn over an unrelated schematic or OSM map.

## Evaluated services

| Approach | Local coverage and hosting | Limits and cost | Attribution / decision |
| --- | --- | --- | --- |
| Local catalogue + SVG schematic | Finite Bengaluru coordinates; no hosting or network | No API charges; distances are estimates | No third-party map tiles; selected for default demo |
| Google Routes + Google Maps link | Managed road routing; campus gates and pedestrian access still need field checks | Billing-enabled project, SKU-dependent pricing; enforced demo caps below; no assumed free allowance | Google Maps attribution; selected for live faculty routes |
| MapLibre + hosted OSM tiles | Renderer only; requires a separately licensed tile source and mobile integration | Tile hosting, storage and transfer are separate costs; use a contracted provider or self-host | Renderer and data attribution; suitable future embedded-map choice |
| OSRM | Self-host a regional OSM extract; driving routes without live traffic | Server memory, updates and operation cost money; public demo service is not an unlimited production dependency | OSM attribution; future alternative behind the same adapter |
| Photon / self-hosted Nominatim | Separate search infrastructure and regional indexing | Hosting and maintenance; public Nominatim prohibits autocomplete and has an aggregate 1 request/second maximum | OSM attribution; deferred because local search is sufficient for the bounded demo |

Open-source production plan: Prathyush selects a MapLibre-compatible hosted tile plan with explicit quotas, attribution and mobile caching support. Sumukh deploys OSRM using a Karnataka extract and benchmarks memory, latency and route correctness before choosing a machine; no invented hosting-price or latency guarantee. If broader search is needed, deploy Photon or contract a search provider. Keep tiles, search and routes as separate metered services. Do not bulk-download public OSM tiles or use public Nominatim for autocomplete.

Sources: [Routes usage and billing](https://developers.google.com/maps/documentation/routes/usage-and-billing), [Routes attribution and policies](https://developers.google.com/maps/documentation/routes/policies), [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), [OSM tiles policy](https://operations.osmfoundation.org/policies/tiles/), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/). Check current account-specific Google pricing in Cloud Console; this app does not read billing data.

## Running the faculty demo

1. Use Node 24 and a folder path without a literal backslash. Install with `npm ci`.
2. Copy `.env.example` to `.env`. Set a private, random `DEMO_ADMIN_TOKEN` of at least 24 characters, and a server-side `GOOGLE_ROUTES_API_KEY` with Routes API enabled. Restrict the key to Routes API and the server's outbound IP where available. Do not put a web-service key into the Android application.
3. In Google Cloud, set a low project request quota as an additional account-wide safeguard. Budget alerts alone do not stop billing. Other keys/apps outside this gateway are not counted by its ledger.
4. Start `npm run demo:server`. The gateway binds only to loopback. It starts with live mode OFF and creates a private ledger at `server/.data/quota.json`. Keep the same ledger across demos. Do not delete it to reset the budget. An exclusive lock prevents simultaneous processes using that path. After a forced crash, verify no gateway is running before manually removing its stale `.lock` file.
5. For Android USB/emulator, run `adb reverse tcp:8787 tcp:8787`. Start the app normally. On the API status page enter `http://127.0.0.1:8787` and the demo access token, then Connect. For deployment beyond local use, provide authenticated HTTPS and shared transactional storage; this is a single-process demo gateway.
6. Confirm the displayed counts, then toggle live Google routing ON. Test the campus → airport route. Live requests send pickup/destination coordinates to Google; only demonstrate with consenting participants or sample coordinates.
7. Matching still uses sample rider identities. In live mode it calculates road compatibility before ranking. The group screen has an explicit real pickup comparison button. Compare, select the feasible arrangement, and open the agreed stops in Google Maps. Leave at least a minute between bursts if the rate cap is reached.
8. Toggle OFF after the demonstration. App restart loses its live session token; server restart also clears the live session, but retains request counts. Server and client both enforce expiry.

Caps: **30 attempts/session, 50 attempts/India-calendar day, 100 attempts/lifetime of ledger, 10 attempts/minute, 15-minute sessions**. Every upstream attempt is counted before transmission, even when Google rejects it or times out. The app cannot reset the ledger. Re-enabling starts a new session only after the old one has ended; daily/lifetime caps still apply. Route limits are enforced at the gateway, not merely displayed in a progress meter. These caps limit this gateway's requests, not the monetary cost of unrelated Google project activity.

The token is kept only in mobile memory. All gateway endpoints require it. There is no public administration page and no anonymous route endpoint. Requests and upstream bodies containing credentials are not logged.

## Routing and matching contracts

- `calculateRoute`: validates every stop. OFF returns `provider=offline_bengaluru,status=fallback` with an explicit demo label. This provider name is retained for compatibility; it does not imply a road graph. ON requires a valid gateway session and returns Google road distance, duration and decoded geometry. A failure returns `status=failed`; it never silently invents a Google route. No automatic paid retries.
- `findLiveMatches` / `calculateLiveCompatibility`: supply Nathan's existing ranker with measured approach distance, the combined-minus-direct duration plus a separately assumed three-minute boarding allowance, and approximate geometry overlap within a 100 m vertex tolerance. Overlap is a heuristic, not shared-road-segment identity. It is not clamped up to the acceptance threshold. A routing failure produces no verified match and a recovery message.
- `compareLivePickupArrangements`: for up to three riders, shortlist a meeting landmark by minimizing the maximum straight-line walk, then measure its walking routes. Reject it if any walk exceeds 500 m. Compare the two possible non-requester pickup orders using real road duration. This is a bounded candidate search, not a guarantee of the globally best meeting point. Driving detours use the same direct baseline; boarding adds three minutes per stop. Walking time shown is estimated at 75 m/min even when walking distance is routed. Confirm pavement, crossings, accessibility and stopping legality in person.
- `SET_PICKUP_ARRANGEMENT`: stores the selected arrangement and route in group state, updates the meeting location and locks changes after booking. Active/completed screens reuse the agreed route and stop order.
- Android location: runtime fine/coarse permissions, fresh location updates, 12-second timeout and accuracy check. Failure explicitly selects the campus gate as a fallback. A GPS point is not automatically marked suitable for pickup. iOS returns an unavailable fallback until a native provider is added.

## Evidence and boundaries

Automated checks use mocked Google responses and exercise the quota boundary without consuming paid calls. Live road correctness for campus→airport, campus→Yeshwanthpur and campus→Majestic must be checked with the configured key and device; synthetic geometry is not completion evidence for those journeys. Landmark coordinates and pickup descriptions inherited from the prototype have not been field-surveyed. There is no guarantee of guards, lighting, CCTV, legal stopping or safe walking.

For wider release, add publicly accessible terms/privacy pages meeting Google's requirements, device walkthroughs, real rider data/consent and production authentication. This implementation is a temporary local faculty demonstration, not a public transport service.

## Additional billing protection

Enabling live mode only arms the connection: mounting a route screen, changing screens or refreshing local usage never calls Google. Fetching a live route requires an explicit button press and confirmation of up to one request. Live sample matching confirms up to six, and pickup comparison up to seven. Cancelling sends no requests for that operation. An already transmitted request can still complete and count after switching OFF.

The status page shows remaining requests per session/day/overall and usage bars. It does not show an invented rupee balance: bank autopay authorisation, Google billing, and this gateway's request caps are separate. Google Cloud project quotas must also be configured because calls made elsewhere with the key are outside this gateway. Alerts-only budgets are notifications, not spending caps. Status polling reads the local ledger only. No Google credentials are needed to run the automated checks.
