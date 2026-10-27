# Mapping & Routing Approach Evaluation

**Author:** Shanaia (Primary Role: Routing, Optimization, and React Native)  
**Collaborators:** Nathan (Route Compatibility), Prathyush (Map Interface), Sumukh (Backend Routing Integration)  
**Project:** MAHE Carpool (`ManiPool`) · Native Android CPI Prototype

---

## 1. Executive Summary & Chosen Architecture

The MAHE Carpool prototype requires a robust, cost-effective, and resilient mapping and routing solution for the Bengaluru metropolitan region (specifically the Yelahanka campus, Kempegowda International Airport, and city corridors). 

### Architectural Decision: Dual-Tier "Safe Open-Source Default + Gated Demonstration"

Rather than depending solely on a proprietary, quota-limited Google Maps API (which risks service interruption, API limit exhaustion, or surprise billing when accessed by multiple team members or CI), the application implements a **Dual-Tier Pluggable Mapping Architecture**:

1. **Default Tier: OpenStreetMap + OSRM + Curated Offline Bengaluru Topology**
   - **Active by default** for all development, team testing, and automated checks.
   - **Zero Google API quota consumed**.
   - Uses Open Source Routing Machine (OSRM) for real road driving geometry, distances, and ETAs.
   - Includes a deterministic **Offline Bengaluru Road Topology Fallback** that guarantees realistic routes even during poor connectivity or network failure.
2. **Gated Tier: Google Maps Demonstration Mode**
   - **Strictly toggled OFF by default**.
   - Accessible exclusively through Shanaia's dedicated **API Limits & Demonstration Controls Screen** (`ApiQuotaScreen`).
   - Intended **solely for live faculty demonstrations**.
   - Protected by an **Auto-Safety Expiration Timer** (15–30 minutes) and real-time quota gauges to ensure team members never accidentally deplete the monthly free allowance ($200 monthly credit).

---

## 2. Comparative Evaluation Matrix

| Dimension | **OpenStreetMap + OSRM (Active Default)** | **Google Maps Platform (Demo Gate)** | **MapLibre GL + Protomaps** | **TomTom Developer Cloud** | **GraphHopper** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Map Display** | SVG Vector Projection / Leaflet via WebView. Highly responsive, zero native crashes. | Native Android Maps SDK (`react-native-maps`). Rich 3D buildings and satellite view. | Vector GL tiles via MapLibre React Native bridge. Highly customizable. | Raster/Vector tiles via TomTom Android SDK or WebView. | Raster / Vector web tiles. |
| **Place Search & Geocoding** | Nominatim / Photon + Curated Bengaluru Landmark Database (with verified coordinates). | Google Places API (New) Autocomplete & Place Details. | Pelias or Photon open-source geocoder. | TomTom Search & Fuzzy Geocoding API. | GraphHopper Geocoding (based on OSM). |
| **Routing & Directions** | OSRM Driving Profile (`router.project-osrm.org`) with actual road polylines. | Google Routes / Directions API with live traffic simulation. | Self-hosted OSRM or Valhalla routing engine. | TomTom Routing API with traffic density. | GraphHopper Directions API. |
| **Bengaluru Local Coverage** | **High:** NH 44, Bellary Rd, Outer Ring Rd, and Yelahanka roads are meticulously tagged. | **Exceptional:** Industry benchmark for local alleys, flyovers, and peak traffic congestion. | **High:** Same underlying OpenStreetMap data as OSRM. | **Good:** Solid coverage across major Indian Tier-1 metros. | **High:** OSM-based road topology. |
| **Hosting & Infra** | Public fair-use endpoint + embedded offline topology. Self-hostable via Docker (~1.2 GB RAM for Karnataka extract). | Fully managed cloud SaaS (Google Cloud Platform). Requires restricted API keys. | Requires self-hosted PMTiles in Cloudflare R2 / AWS S3 or MapTiler cloud account. | Fully managed TomTom cloud APIs. | Self-hosted Java server or commercial GraphHopper cloud. |
| **Free Limits & Quota** | **Unlimited** for reasonable academic/demo use; zero per-request fee. | **$200/mo credit**: ~28,500 dynamic map loads, 10,000 directions requests, 10,000 autocomplete requests. | MapTiler free tier: 100,000 tile requests/mo. Self-hosted: static storage cost only. | **2,500 free requests/day** (~75,000 requests/mo). | 500 requests/day on free community tier. |
| **Cost After Limits** | **₹0.00** | $7.00 per 1,000 map loads; $5.00 per 1,000 routes; $2.83 per 1,000 autocompletes. | ~$20/mo managed, or ~$1/mo S3 bandwidth. | $0.50 per 1,000 requests beyond daily cap. | €49/mo minimum commercial plan. |
| **Attribution Requirement** | `© OpenStreetMap contributors` (ODbL) + OSRM attribution. | Google logo & Google copyright on all map views. | MapLibre + OpenStreetMap contributors. | TomTom logo & copyright. | GraphHopper + OSM contributors. |

---

## 3. Practical Plan for Open-Source Software in Production

For long-term deployment beyond the local prototype, the open-source stack should be provisioned as follows:

### 3.1 Hosted Vector Tiles
- **Option A (Low Cost / Serverless):** Host a `karnataka.pmtiles` archive (~180 MB) on Cloudflare R2 or an AWS S3 bucket with CloudFront. MapLibre GL Native reads PMTiles directly with HTTP Range requests, eliminating the need for a running tile server. Estimated cost: < ₹150/month.
- **Option B (Managed Open-Source):** Use MapTiler's free academic tier (100,000 requests/month) with standard OpenMapTiles schema.

### 3.2 Place Search & Geocoding
- **Curated MAHE Database:** Campus gates, student residential hubs (Yelahanka New Town, Kogilu Cross, Bagalur), and major transit nodes (BLR Airport, Yeshwanthpur, Majestic) are verified and stored locally.
- **Dynamic Search:** Proxy Nominatim/Photon requests through a backend caching layer (Redis) with a 24-hour TTL to respect OSM's 1 req/sec rate limit.

### 3.3 Road Routing Engine
- **Self-Hosted OSRM Container:** Run an OSRM backend container (`osrm-routed`) using the Karnataka OSM PBF extract on a ₹400/month DigitalOcean/AWS Lightsail instance (1 vCPU, 2 GB RAM). Response latencies for carpool route queries are typically under 15 ms.
- **Fallback Guarantee:** The app retains the embedded offline Bengaluru topology router, ensuring 100% operational uptime during connectivity drops.

---

## 4. Shanaia's Demonstration Mode & API Quota Guard

To solve the specific operational problem:
> *"make sure no google maps api limits are reached so keep one page for me to view the api limits and turn on gmaps only for demonstration times to prevent other team members from accidentally using and exceeding limits, so i can properly demo the app to the faculty during presentation alone"*

We designed and implemented the **API Limits & Demonstration Controls Screen** (`ApiQuotaScreen`):

### 4.1 Features & Protections
1. **Strict Gatekeeper:** Google Maps Platform SDK and Directions calls are blocked unless the demo switch is explicitly enabled. All regular app usage defaults to OSRM / OpenStreetMap.
2. **Auto-Safety Expiration Timer:** When Shanaia enables Google Maps Demo Mode, an automatic expiration countdown begins (default: 15–20 minutes). If Shanaia forgets to toggle it off after the presentation, the app automatically disengages Google Maps, returning to Safe Mode and preventing subsequent team usage from consuming quota.
3. **Real-Time Visual Quota Gauges:**
   - **Google Maps SDK Loads:** Live progress gauge out of 28,500 monthly limit.
   - **Google Places Autocomplete:** Live progress gauge out of 10,000 monthly limit.
   - **Google Directions / Routes API:** Live progress gauge out of 10,000 monthly limit.
   - **Color-Coded Status:** Green (<50%), Amber Warning (50%–80%), Red Critical (>80%).
4. **Estimated Cost Calculator:** Displays current estimated spend in ₹ INR alongside remaining free Google Cloud credits.
5. **Connectivity Simulation:** A "Simulate Test Route Call" button verifies network routing without navigating through full ride booking screens.
6. **Usage Reset:** Allows resetting session counters for fresh demo runs.

---

## 5. Verification & Completion Evidence

1. **Realistic Bengaluru Journeys:** Verified routes between MAHE Campus (Yelahanka), Kempegowda Airport, Yeshwanthpur Metro, Majestic, and Church Street produce usable road distances, accurate travel times, and smooth polyline geometries.
2. **Nathan's Matching Integration:** Route overlap percentages (0.65–0.98) and detour minutes are calculated from actual road geometry and supplied directly to Nathan's multi-criteria scoring algorithm.
3. **Pickup Arrangement Comparison:** Groups can evaluate Common Meeting Points (e.g. Campus Main Gate Security Bay) against Sequential Pickups (ordered curbside stops) with explicit metrics for walking distance, vehicle detour, safety ratings, and trade-off rationale.
4. **Routing Failure Recovery:** Gracefully recovers from network or service failures by falling back to offline curated Bengaluru topology with a user-friendly retry mechanism.
