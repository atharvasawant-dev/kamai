# Kamai — True Earnings for Indian Gig Workers

Mobile-first, offline-capable PWA for people who deliver or drive across several
apps (Zomato, Swiggy, Uber, Rapido, Ola). Gross earnings per order look good;
Kamai shows the number that matters — **real ₹/hour after fuel**, per day, per week
and per platform.

Everything runs on the device: no backend, no account, no network calls.

## Features

| Screen | What it does |
|--------|--------------|
| **Home** | Today's real ₹/hour, earnings, distance, estimated petrol cost, hours worked, per-platform table. Step back through previous days. |
| **Log order (+)** | Platform, earnings, distance, time. Time can be typed or captured with a **ride timer** that also tracks distance from GPS. Edit or delete any order. |
| **Weekly** | Last 7 days: totals, net after fuel, ₹/hour by platform, day-by-day bars. |
| **Settings** | Bike mileage and petrol price, **JSON export / import**, reset. |

Other behaviour worth knowing:

- **GPS ride timer** — distance is summed with the Haversine formula; any jump that
  implies more than 120 km/h is treated as a GPS glitch and ignored. Browsers may
  pause GPS when the app is in the background, so the screen shows a notice and you
  can always type the distance by hand.
- **Input validation** — earnings and time must be > 0, distance may be 0, letters
  and negatives are rejected.
- **Failure handling** — storage errors (private mode, full storage, corrupted data)
  are shown in a banner instead of failing silently.

## Getting started

Requires Node.js 22 (the version CI uses).

```bash
git clone https://github.com/atharvasawant-dev/kamai.git
cd kamai
npm ci
npm run dev        # http://localhost:5173 (also exposed on your LAN)
```

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` (also generates the service worker) |
| `npm run preview` | Serve the production build — use this to try install/offline behaviour |
| `npm run lint` | oxlint |
| `npm test` | Unit tests (Node's built-in test runner, no extra dependencies) |
| `node scripts/checklist.mjs` | Scenario self-check that runs the real calculation and validation modules |

Coverage for the logic layer:

```bash
node --test --experimental-test-coverage --test-coverage-include='src/lib/**' tests/*.test.js
```

CI (`.github/workflows/ci.yml`) runs lint, tests and build on every push and pull request.

### Install on Android

1. Open the app in Chrome over HTTPS (or `localhost`).
2. Menu → **Install app** / **Add to Home screen**.

The service worker precaches the app shell and all data is local, so the app is
designed to keep working without a connection after the first load.

## How earnings are calculated

```
fuel cost  = (distance_km ÷ mileage_km_per_l) × petrol_price_per_l
real ₹/hr  = (earnings − fuel cost) ÷ hours
```

Defaults: **40 km/l** and **₹105/l**. Edge cases, all covered by tests:

- No logged time (0 hours) → the rate is `null` and the UI shows "Log your first order"; it is never `NaN` or `Infinity`.
- Fuel can exceed earnings → the real rate is shown as a negative number rather than clamped.
- Missing, zero, negative or non-numeric mileage/price fall back to the defaults.
- Non-positive or non-numeric distance costs nothing (fuel is never negative).
- Days are local calendar days; "last 7 days" includes today and the 6 days before it.

## Architecture

```
src/
├── App.jsx              owns orders/settings state; reloads from storage after every write
├── components/          Home · LogOrder · Weekly · Settings · BottomNav · StorageBanner
└── lib/                 framework-free modules (these are what the tests cover)
    ├── calculations.js  fuel cost, per-day / per-platform aggregation, formatting
    ├── validation.js    form-field parsing and validation
    ├── storage.js       localStorage access, export / import, error reporting
    ├── geo.js           Haversine distance, GPS glitch filter, ride timing
    └── constants.js     platforms, storage keys, defaults
```

- **React 19 + Vite 8**, plain JavaScript, no router and no state library — four tabs
  held in component state.
- **`src/lib` has no React or DOM dependencies**, so the business logic is unit-tested
  with `node --test` directly.
- **Storage functions never throw.** They return `{ ok, data, error }`, and `App`
  routes errors into the banner.
- **PWA** via `vite-plugin-pwa` (Workbox `generateSW`, auto-update). The shell is
  precached and navigations fall back to the cached `index.html`.

## Data and backup

Data lives in `localStorage` under four keys: `kamai_orders`, `kamai_settings`,
`kamai_last_platform` and `kamai_timer` (an in-progress ride).

**Export JSON is the only backup.** Clearing browser data or switching phones loses
everything not exported.

```jsonc
{
  "version": 1,
  "app": "kamai",
  "exportedAt": "2026-10-21T11:00:00.000Z",
  "settings": { "mileageKmPerLitre": 40, "petrolPricePerLitre": 105, "currency": "INR" },
  "orders": [
    { "id": "…", "platform": "Zomato", "earnings": 120, "distance": 4.5,
      "timeMinutes": 35, "timestamp": "2026-10-21T10:00:00.000Z", "note": "" }
  ]
}
```

- Import accepts this format or a bare array of orders, asks for confirmation, and
  **replaces** all current orders (and the settings, if the file has them).
- Orders that the log form would reject (earnings ≤ 0 or time ≤ 0) are skipped and
  the count is reported. A file whose orders are all invalid is refused and existing
  data is kept.
- Export refuses to run if the stored orders can't be read, so it never writes a
  silently empty backup.

## Limitations

- Data is per browser and per device — there is no sync.
- Fuel cost is an estimate from a single mileage figure; it ignores maintenance,
  depreciation and traffic.
- GPS distance depends on the phone and browser keeping location updates running.
- The manifest uses `start_url: "/"`, so the app is meant to be served from the
  domain root rather than a sub-path.
- UI copy mixes English and Hinglish.
