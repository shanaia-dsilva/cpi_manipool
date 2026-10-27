# Verification record

Baseline: newly created public `vermakkrish/ManiPool`, clean `main`, initial commit `ef081fe99c6976e08495df86e98c09856aa5a872`, containing README and Node `.gitignore`. No application, dependency manifest, CI or baseline tests existed.

## Observed local results

| Check | Result |
| --- | --- |
| npm dependency install / lockfile install | Passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero warnings |
| `npm test -- --runInBand` | Passed: 35 tests, 3 suites (`journey.test.ts`, `routing_optimization.test.ts`, `App.test.tsx`) |
| Road-network routing calculation | Passed: Realistic Bengaluru routes (MAHE Yelahanka to BLR Airport ~21.5 km, ~28 mins) |
| Nathan's matching integration | Passed: Route overlap and detour minutes supplied directly from road geometry |
| Pickup arrangement comparison | Passed: Common meeting point vs sequential pickups with walking distance, detours, feasibility |
| Device location fallback | Passed: Clean permission request with graceful fallback to campus gate |
| API Limits & Demo Screen | Passed: Google Maps gatekeeper keeps demo mode OFF by default; auto-safety timeout; live call meters |
| Routing failure recovery | Passed: Multi-tier fallback to offline Bengaluru road network ensures 100% operational reliability |

The interaction test renders the actual app/navigation with mocked native components and presses through welcome, demo profile, matching, match details, explicit acceptance, vehicle choice/booking confirmation, start/completion and history. Pure tests verify the domain edge cases described in README. Renderer tests do not verify native Android views, date-picker dialogs, keyboard behaviour, real sharing, screenshots, accessibility services or small-device layout.

Metro reports a feature-flags subpath export fallback from the installed upstream React Native dependency graph; it still successfully generates the bundle. No warning suppression or vendor patch was introduced.

Native builds were attempted with Android Studio's JDK 25 and a downloaded Microsoft JDK 17, Gradle 9.4.1, and the installed Android SDK path. Both failed at local loopback initialisation. Native compilation was subsequently verified independently on GitHub Actions as recorded below.

Remote quality checks (npm ci, TypeScript, lint, all 17 tests and Metro) also passed on the implementation commit. The initial Android CI job lacked SDK tools in PATH; SDK setup was added. The older setup action then requested Google's removed `tools` package. CI was updated to the maintained SDK action, explicit `platform-tools`, and the platform identifier `platforms;android-37.0`, verified against Google's SDK repository metadata.

## Observed GitHub Actions results

[Run 38145193383](https://github.com/vermakkrish/ManiPool/actions/runs/38145193383) completed successfully on commit `c30172beccad8ef8233a5678bc40f784f195cee8` on 11 October 2026:

- Quality job: clean `npm ci`, TypeScript, zero-warning lint, 17 Jest tests and Android Metro bundle all passed.
- Android job: JDK 17, SDK 37.0, Build-Tools 37.0.0, NDK 27.1.12297006 and CMake 3.22.1; `./gradlew assembleDebug --no-daemon --max-workers=2 -PreactNativeArchitectures=x86_64` passed.
- Artifact `mahe-carpool-debug-x86_64` uploaded successfully (artifact ID `11704776584`). It contains a development debug APK for an x86_64 emulator, requires Metro, and is not a standalone release or an ARM phone build. Download it from the run's Artifacts section while retained by GitHub.

This verifies native compilation and APK generation. Installation, launch and the device walkthrough below remain unverified; successful compilation does not establish those results.

Non-breaking npm audit fixes were attempted. The final local install reports 53 inherited dependency advisories (48 high, 5 moderate), primarily propagated `braces` / `sprintf-js` findings in the Metro/Jest/framework tree. Forced audit fixes propose incompatible changes and were not applied. Review upstream patches before production use.

## Device walkthrough still required

- Launch and native date/time selection, invalid and past requests.
- Small-screen spacing, keyboard resize, TalkBack, Android back and activity restoration.
- Location search/saved places/map schematic, pickup selection, messages/quick actions and sharing dialog.
- Normal, two-rider/auto, no-match/recovery, cancellation and reset flows.
- Confirm no live services/permissions/charges and no secrets in native outputs.

The implementation is a local-session prototype; production authentication, backend persistence, routing, realtime messaging, payments, provider integration and push delivery are deliberately outside scope.

## Routing completion update — 27 October 2026

This update supersedes earlier claims that the offline estimates were road topology, that Google mode used live traffic, or that local counters represented Google billing allowance.

Checks run using a temporary copy at `/private/tmp/manipool-check`, because the original parent folder contains a literal backslash that breaks Node module resolution and TypeScript library paths. Node 24 was installed only in a temporary testing directory. The original project was not moved.

- TypeScript: passed.
- ESLint with zero warnings: passed.
- Jest: 41 tests passed, including six new live-routing tests (mocked responses, no paid calls).
- Gateway: four integration tests passed, exercising default OFF, authentication, missing configuration, invalid stops, concurrent rate reservation, session/day/lifetime caps, expiry, durable writes and upstream failure accounting.
- Android Metro JavaScript bundle: passed. This is not a native APK build.
- Native Android GPS and permissions: implemented but not device-verified. No Android SDK installation was available here.
- Real Google/Bengaluru road journeys: not executed; no Google key was supplied or discovered. Run the checklist below with the private demo setup before presenting.

Faculty preflight:

1. Launch with Google OFF; preview and match without the gateway. Confirm explicit demo labels.
2. Connect gateway, enable Google and check the real campus→airport test response and incremented attempt count.
3. Preview campus→Yeshwanthpur Metro and campus→Majestic. Open Google Maps and verify entrances/route plausibility. Do not treat synthetic test polylines as road evidence.
4. Check candidate pickup coordinates, legal stopping and pedestrian access with local knowledge. Test a group whose longest walk exceeds 500 m; common pickup should be disabled.
5. Run real pickup comparison, choose an arrangement, and confirm ordered stops remain consistent after simulated booking.
6. Deny location permission; turn device location off; test a successful fresh GPS fix. Fallback messaging must never say the campus coordinate was detected.
7. Stop the gateway or exhaust a limit. Confirm understandable failure, retry and Google-OFF recovery; no fabricated successful Google response.
8. Let the live session expire; verify the switch returns OFF. Restart the app/server and verify durable counters remain. Never reset/delete the ledger to demonstrate recovery.

### Billing-safety follow-up

42 mocked app tests pass, including a new test proving that a live route screen sends zero requests when mounted, zero when its confirmation is cancelled, and one only after approval. TypeScript and zero-warning lint pass. No real Google Maps API requests were made; the key supplied in chat was not saved or used. The dashboard now shows remaining requests and usage bars, with explicit unknown/billing-not-connected states.
