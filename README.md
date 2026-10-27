# MAHE Carpool · ManiPool

**Different routes. One journey.**

A native Android-first React Native/TypeScript CPI prototype for the MAHE Bengaluru community. Students can find compatible sample riders, agree a pickup, coordinate a shared journey, and demonstrate a complete ride lifecycle.

This public repository is a fresh implementation based on the supplied project requirements. It does not include or modify the team's inaccessible private repository.

## What works

- Brief splash, welcome, demo email entry and profile setup.
- Exactly three main tabs: Home, Rides, Profile.
- Shared ride form with searchable verified Bengaluru landmarks, real coordinates, native Android date/time pickers, validation, and Exact/±15/±30/±45 minute flexibility.
- Device location with Android runtime permission handling and safe fallback to campus gate if permission is denied.
- Road-based routing and distance engine: calculates actual road km, travel time, and polyline curves using OSRM + curated Bengaluru road network.
- Pickup arrangement comparison: evaluates Common Meeting Point (e.g. Campus Main Gate Security Bay) vs Sequential Pickups with walking distances, detours, safety ratings, and trade-off recommendations.
- Route compatibility integration for matching: supplies route overlap (0.65–0.98) and detour minutes computed from road routing to Nathan's multi-criteria scoring algorithm.
- Interactive road map display (`InteractiveRouteMap`) across route preview, matched groups, formed rides, active journey, and completion screens.
- Multi-tier routing failure resilience: seamless automatic fallback from online OSRM to offline Bengaluru topology, with user recovery options and retry controls.
- **Dedicated Routing & API Quota Control Screen (`ApiQuotaScreen`):** strictly keeps Google Maps OFF by default to protect against exceeding limits during team development; enables Google Maps exclusively for faculty demonstrations with auto-safety expiration timer and live quota meters.
- Deterministic matching, no-match/retry/recovery controls, review and explicit mutual acceptance simulation.
- Group formation, common/sequential pickup selection, local chat, quick messages and departure coordination.
- Cab/auto capacity checks, exact fare splits, simulated booking confirmation, active ride and completion.
- Ride history, saved places, local notification preference, local issue reports, confirmed departure/cancellation and reset.
- Central state guards against invalid transitions, duplicate active requests, duplicate groups/messages and destructive group cancellation.

**Demo boundary:** no real identity verification, GPS, geocoding, live riders, realtime messaging, driver tracking, provider booking, payment or push delivery. Sample prices/distances/detours are illustrative estimates. Reports are not sent to staff. State survives screen navigation but is in memory; a process restart clears it. Internet access is needed to install/build and for the development server, not for demo business services.

## Prerequisites

The project pins React Native **0.87.1**, React **19.2.3**, and uses npm with a committed lockfile. Node **24.x** is the tested line. Use **JDK 17** for the Android build.

Install Android Studio and these SDK Manager components:

- Android SDK Platform **37.0** (`platforms;android-37.0`).
- Android SDK Build-Tools **37.0.0**.
- Android SDK Platform-Tools and Android Emulator.
- NDK **27.1.12297006**, CMake **3.22.1**.
- A supported emulator system image; minimum Android API is **24**, target API is **36**.

Gradle **9.4.1** is supplied through the wrapper. Set `JAVA_HOME` to JDK 17 and `ANDROID_HOME` to the SDK. On Windows, add `%ANDROID_HOME%\platform-tools` to PATH. Android Studio may alternatively write the untracked `android/local.properties` with your `sdk.dir`.

See the [official React Native environment guide](https://reactnative.dev/docs/set-up-your-environment) for Android toolchain setup. Use the versions above for this repository.

## Install and run on Android

```sh
git clone https://github.com/vermakkrish/ManiPool.git
cd ManiPool
npm ci
npm start
```

Start an emulator in Android Studio's Device Manager (or connect a debugging-enabled Android phone). In a second terminal at the repository root:

```sh
npm run android
```

Open the **android/** folder in Android Studio for Gradle sync, native debugging or APK generation. The application ID is `com.mahecarpool`; its visible name is MAHE Carpool. No `.env` file or API credentials are required.

Build a debug APK without launching a device:

```sh
# Windows, from the repository root
cd android
.\gradlew.bat assembleDebug

# macOS/Linux, from the repository root
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. Development debug APKs load JavaScript from Metro. For device testing, keep Metro running and use `adb reverse tcp:8081 tcp:8081` when required. The default Android debug signing key is generated locally by the Android Gradle plugin; signing keys are ignored. Release signing is deliberately unconfigured: configure private credentials outside Git before producing a production release. The retained iOS template is not tested; the date/time UI currently uses the Android imperative picker API.

## Demo walkthrough

1. Select **Continue as Demo**, review the prefilled profile and select **Start sharing journeys**. Get Started provides demo email entry instead; no OTP is sent.
2. Home defaults to campus → airport, tomorrow at 18:45, ±30 minutes. Change landmarks/date/time or use a favourite destination.
3. Select **Find a Carpool**. The 1.5-second local matching animation returns a sample group.
4. Select **View Match**, **Join Carpool**, then **Simulate other riders accepting**. Chat is unavailable before acceptance.
5. Review the group, compare common/sequential pickup estimates and open chat. Sending a message and each quick action performs an operation. Before booking, the 10-minute departure action simulates agreement and updates the shared departure; after booking it sends a coordination request only. “Ride booked” opens booking until a simulated booking exists. “I'm cancelling” asks for confirmation.
6. Choose a cab; the auto is clearly disabled for three riders. Confirm the simulated booking, start the demo ride and complete it.
7. Select Done to see the completed journey in Rides. Details, local reporting and read-only completed chat remain accessible.

At any step, Android back returns through the flow; Rides resumes the current step from shared state. Only one active request is allowed. New requests can be created after completion/cancellation. Leaving removes only the current user, retains the other demo members and booking, and recalculates their fare split in the cancelled record. Remaining groups are retained for illustration; this single-user demo does not operate another member's app session or recruit replacements.

**Alternative fixtures:** Profile → Settings & demo controls → No-match scenario or Two-rider journey. No-match retry reruns the local fixture; it does not monitor in the background. “Try wider window · sample match” explicitly switches to the normal fixture and sets ±45 minutes on the same request. Edit request cancels the old request before editing the shared form. The two-rider fixture allows either cab or auto. Reset local demo clears journeys/reports/messages but keeps the signed-in demo profile.

## Checks

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
npm run bundle:android
```

The bundle command emits ignored artifacts under `build/bundle/`; it verifies Metro resolution and Android JavaScript compilation, not APK installation.

Tests cover invalid calendar/time/location inputs, past requests, windows across midnight, matching filters/capacity/determinism, illustrative weights, exact fare remainders, valid/invalid transitions, acceptance, booking, completion, no-match recovery, expiry, chat/pickup/departure consistency, local reports, and retained groups after cancellation. React render/interaction tests exercise the app with mocked native components. These are not emulator tests.

GitHub Actions runs TypeScript, zero-warning lint, Jest and Metro checks. A separate job builds an Android x86_64 debug APK and uploads it for emulator use. [Run 38145193383](https://github.com/vermakkrish/ManiPool/actions/runs/38145193383) passed both jobs, including native `assembleDebug`. Its `mahe-carpool-debug-x86_64` artifact requires an x86_64 emulator and Metro; it is not a standalone release or an ARM phone build. See [the verification record](docs/VERIFICATION.md) for observed results and remaining device checks.

## Implementation and future integration

```text
App.tsx                             Auth/native stack, Home/Rides/Profile tabs & API Quota route
src/navigation/types.ts             Strong route parameters
src/theme/                          Central palette, typography, spacing, radii
src/components/                     InteractiveRouteMap, accessible controls, cards, avatars
src/data/fixtures.ts                Coordinates, Bengaluru landmarks, pickup points, fares
src/services/routing.ts             Road distances, OSRM/Google/Offline router, compatibility
src/services/pickupOptimization.ts  Meeting point selection, sequential ordering, comparison
src/services/location.ts            Android location permissions, GPS fallback to campus gate
src/services/apiQuota.ts            Google Maps demo gate, call tracking, quota limits, costs
src/services/matching.ts            Road-grounded matching adapter & rankCandidates
src/services/journey.ts             Validation, windows/lifecycle helpers, exact fare split
src/state/reducer.ts                Single source of truth for all domain operations
src/state/AppContext.tsx            React context/reducer shared across navigation
src/screens/ApiQuotaScreen.tsx      Shanaia's API quota dashboard & demo mode gatekeeper
src/screens/                        Auth, home/location, journey and account screens
__tests__/                          Domain, routing optimization & mocked-native interaction tests
docs/ROUTING_AND_MAPPING_EVALUATION.md Detailed mapping & routing evaluation report
android/                            Actual native Android project and Gradle wrapper
```

Lifecycle: `DRAFT → SEARCHING → MATCH_FOUND → WAITING_FOR_ACCEPTANCE → GROUP_FORMED → RIDE_BOOKED → IN_PROGRESS → COMPLETED`, with guarded cancellation, expiry, no-match and rematching paths. Only submitted requests are stored in history; the editable draft lives separately.

Matching filters by time-window overlap, illustrative pickup distance, destination/corridor, route overlap and detour, then ranks and caps the result. The fixture is generated relative to the selected request so presentations are repeatable. It is not a road router or a geospatial proof of compatibility. The weights (route 35%, detour 25%, time 20%, destination 15%, private demo reliability 5%) are configurable, unvalidated starting values. No public reliability score is displayed.

Replace `demoMatchingService` with a FastAPI/geospatial adapter implementing `MatchingService`. For real MAHE auth, persisted PostgreSQL/Supabase data, realtime chat, OSRM routing, push notifications and provider coordination, introduce authenticated API adapters behind the domain operations and hydrate confirmed server results into state. Those services are future integration points, not implemented integrations. Production requires consent/privacy controls, backend validation, actual routing/capacity data and error/retry handling appropriate to those services.

## Troubleshooting and known verification limits

- **Wrong Java/SDK:** point Android Studio's Gradle JDK and terminal `JAVA_HOME` at JDK 17. Install the exact SDK/NDK/CMake versions above; do not commit SDK paths.
- **Metro/device connection:** check `adb devices`, start Metro from this directory, and reverse port 8081 for USB devices. If a cache is stale, use `npm start -- --reset-cache`.
- **Long Windows native paths:** use a short clone path if CMake or Windows path-length limits interrupt compilation.
- **Local build restriction observed during implementation:** Gradle failed before project compilation with `java.io.IOException: Unable to establish loopback connection`, including an attempt with JDK 17. ADB also could not initialise its local Android preferences path in this execution environment. Native APK generation subsequently passed on GitHub Actions. Local installation, emulator walkthrough and Android screenshots remain unverified. Use the run instructions on a normal developer machine for those checks.
- **Dependency audit:** non-breaking `npm audit fix` was applied. Upstream transitive `braces`/`sprintf-js` advisories remain in the React Native/Metro/Jest dependency graph. Do not apply `npm audit fix --force`, which proposes incompatible framework changes. Inspect `npm audit` and upstream patched versions before production use. This prototype does not accept user-supplied glob patterns or precision format strings.
- **Device layout:** safe areas, scrolling, keyboard resize, accessible text labels and controls of at least 48 dp are implemented. Native small-device layout, TalkBack and OS recreation still need an emulator/device walkthrough.

No production release, real safety verification, measured savings, carbon benefit or guaranteed match is claimed.
