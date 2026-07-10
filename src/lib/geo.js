/** Pure GPS helpers — no network, no API keys */

const EARTH_RADIUS_KM = 6371
/** Delivery bikes rarely exceed this; jumps above = GPS glitch */
export const MAX_SPEED_KMH = 120

function toRad(deg) {
  return (deg * Math.PI) / 180
}

/**
 * Great-circle distance between two lat/lng points (Haversine), in km.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * Whether the segment from prev → next is physically plausible.
 * Rejects jumps that imply speed > maxSpeedKmh (default 120).
 */
export function isPlausibleSegment(prev, next, maxSpeedKmh = MAX_SPEED_KMH) {
  if (!prev || !next) return false
  const dtMs = next.timestamp - prev.timestamp
  if (dtMs <= 0) return false
  const dKm = haversineKm(prev.lat, prev.lng, next.lat, next.lng)
  const hours = dtMs / 3_600_000
  if (hours <= 0) return false
  const speed = dKm / hours
  return speed <= maxSpeedKmh
}

/**
 * Add a GPS point to a running total.
 * Returns { distanceKm, lastPoint, accepted }.
 * Glitchy jumps are ignored (lastPoint unchanged).
 */
export function accumulatePoint(lastPoint, distanceKm, nextPoint, maxSpeedKmh = MAX_SPEED_KMH) {
  if (!nextPoint || !Number.isFinite(nextPoint.lat) || !Number.isFinite(nextPoint.lng)) {
    return { distanceKm, lastPoint, accepted: false }
  }

  if (!lastPoint) {
    return { distanceKm: distanceKm || 0, lastPoint: nextPoint, accepted: true }
  }

  if (!isPlausibleSegment(lastPoint, nextPoint, maxSpeedKmh)) {
    return { distanceKm, lastPoint, accepted: false }
  }

  const dKm = haversineKm(lastPoint.lat, lastPoint.lng, nextPoint.lat, nextPoint.lng)
  return {
    distanceKm: (distanceKm || 0) + dKm,
    lastPoint: nextPoint,
    accepted: true,
  }
}

/** Round to 1 decimal place for display / form fill */
export function roundKm1(km) {
  const n = Number(km) || 0
  return Math.round(n * 10) / 10
}

/**
 * Elapsed whole minutes between two timestamps (ms or ISO).
 * Rounds to nearest minute; minimum 1 if any positive elapsed time
 * so the order form still validates.
 */
export function elapsedMinutesRounded(startedAt, endedAt = Date.now()) {
  const start = typeof startedAt === 'string' ? Date.parse(startedAt) : Number(startedAt)
  const end = typeof endedAt === 'string' ? Date.parse(endedAt) : Number(endedAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  const mins = Math.round((end - start) / 60_000)
  if (mins <= 0 && end > start) return 1
  return Math.max(0, mins)
}

export function formatElapsedClock(startedAt, now = Date.now()) {
  const start = typeof startedAt === 'string' ? Date.parse(startedAt) : Number(startedAt)
  if (!Number.isFinite(start)) return '0:00'
  const sec = Math.max(0, Math.floor((now - start) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export const GEO_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 2000,
  timeout: 15000,
}
