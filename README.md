# Kamai — True Earnings for Indian Gig Workers

Mobile-first PWA for multi-app delivery/ride partners
(Zomato, Swiggy, Uber, Rapido, Ola). Shows **real ₹/hour after fuel**.

## Quick start

```bash
cd kamai
npm install
npm run dev
```

Open `http://localhost:5173` (or the Network URL on your phone).

Production / installable PWA:

```bash
npm run build
npm run preview
```

## Features

| Screen | What |
|--------|------|
| **Home** | Aaj ka real kamai/hour, day arrows, per-platform table |
| **Log Order (+)** | Platform, ₹, km, minutes (or timer), edit/delete |
| **Weekly** | Last 7 days totals + ₹/hr bar chart by platform |
| **Settings** | Mileage, petrol ₹, **Export / Import JSON**, Reset |

## Formula

```
real ₹/hr = (earnings − fuel cost) ÷ hours
fuel cost = (distance_km ÷ mileage_km_l) × petrol_price
```

Defaults: **40 km/l**, **₹105/l**. If hours = 0 → “Log your first order” (never NaN).

## Data (localStorage only)

- `kamai_orders` — order array  
- `kamai_settings` — mileage, petrol, currency  

**Export JSON** is the only backup. Use it before clearing browser data or switching phones.

## Checklist script

```bash
node scripts/checklist.mjs
```

## Install on Android Chrome

1. Open the app in Chrome (localhost or HTTPS)
2. ⋮ → **Install app** / **Add to Home screen**
3. Works offline mid-route via service worker
