# MAHE Carpool · ManiPool

**Different routes. One journey.**

A native Android-first React Native/TypeScript CPI prototype for the MAHE Bengaluru community. Students can find compatible sample riders, agree a pickup, coordinate a shared journey, and demonstrate a complete ride lifecycle.

This repository contains the React Native prototype and a local faculty-demo routing gateway.

## Routing and faculty demonstration

Google is **OFF by default**. Normal development uses explicitly labeled local demo estimates and makes no mapping API calls. These estimates are not an offline road graph.

The separate **Routing & API status** page connects to the local demo gateway and enables real Google Routes responses for a 15-minute faculty session. The server keeps durable attempt counts and enforces 30/session, 50/day, 100 total and 10/minute caps. Failed requests count; the app cannot reset the budget. Google credentials stay on the server. This is gateway usage, not Google billing-account usage.

Live mode supports road distance/time, road-derived matching metrics, walking-route checks and comparison of pickup orders. Agreed routes open in Google Maps with ordered stops. The built-in schematic is for demo mode only. Local landmark search does not call Places. Android device location has permission handling and an explicit fallback.

**Setup and responsibility-by-responsibility handoff:** [Routing and mapping decision](docs/ROUTING_AND_MAPPING_EVALUATION.md).

The existing sign-in, riders, acceptance, booking, chat, prices and journey lifecycle remain a local simulation. There is no real identity verification, booking, payment or live rider tracking. Journey state is in memory. Live road and physical pickup access checks still require a configured Google project and Android device.

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
git clone https://github.com/shanaia-dsilva/cpi_manipool.git
cd cpi_manipool
npm ci
npm start
```

Start an emulator in Android Studio's Device Manager (or connect a debugging-enabled Android phone). In a second terminal at the repository root:

```sh
npm run android
```

Open the **android/** folder in Android Studio for Gradle sync, native debugging or APK generation. The application ID is `com.mahecarpool`; its visible name is MAHE Carpool. No credentials are required for default demo mode. Live faculty mode uses the private server configuration described in the routing guide.

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

## Implementation and integration

- `server/routing-server.cjs`: authenticated Google Routes gateway and durable quota reservation.
- `src/services/liveRouting.ts`: memory-only access token/session, expiry and concurrent request coalescing.
- `src/services/routing.ts`: explicit demo/live routing and measured compatibility adapter.
- `src/services/pickupOptimization.ts`: meeting-point and pickup-order comparison.
- `src/screens/ApiQuotaScreen.tsx`: mode switch and server status/usage.
- `src/components/InteractiveRouteMap.tsx`: demo schematic, route metrics, failure recovery and Google Maps link.
- `src/services/location.ts` and Android `DeviceLocationPackage.kt`: permission and location acquisition.

Run `npm run test:gateway` for isolated quota tests, in addition to the checks above. These tests never use a real Google key.

## Troubleshooting and known verification limits

- **Wrong Java/SDK:** point Android Studio's Gradle JDK and terminal `JAVA_HOME` at JDK 17. Install the exact SDK/NDK/CMake versions above; do not commit SDK paths.
- **Metro/device connection:** check `adb devices`, start Metro from this directory, and reverse port 8081 for USB devices. If a cache is stale, use `npm start -- --reset-cache`.
- **Long Windows native paths:** use a short clone path if CMake or Windows path-length limits interrupt compilation.
- **Local build restriction observed during implementation:** Gradle failed before project compilation with `java.io.IOException: Unable to establish loopback connection`, including an attempt with JDK 17. ADB also could not initialise its local Android preferences path in this execution environment. Native APK generation subsequently passed on GitHub Actions. Local installation, emulator walkthrough and Android screenshots remain unverified. Use the run instructions on a normal developer machine for those checks.
- **Dependency audit:** non-breaking `npm audit fix` was applied. Upstream transitive `braces`/`sprintf-js` advisories remain in the React Native/Metro/Jest dependency graph. Do not apply `npm audit fix --force`, which proposes incompatible framework changes. Inspect `npm audit` and upstream patched versions before production use. This prototype does not accept user-supplied glob patterns or precision format strings.
- **Device layout:** safe areas, scrolling, keyboard resize, accessible text labels and controls of at least 48 dp are implemented. Native small-device layout, TalkBack and OS recreation still need an emulator/device walkthrough.

No production release, real safety verification, measured savings, carbon benefit or guaranteed match is claimed.
