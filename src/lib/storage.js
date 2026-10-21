import { v4 as uuidv4 } from 'uuid'
import { DEFAULT_SETTINGS, EXPORT_VERSION, PLATFORMS, STORAGE_KEYS } from './constants.js'

/**
 * All localStorage ops return { ok, data?, error? } so UI never crashes silently.
 */

function storageAvailable() {
  try {
    const k = '__kamai_test__'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

function readRaw(key) {
  try {
    if (!storageAvailable()) {
      return {
        ok: false,
        error: 'Storage unavailable. Browser may be blocking localStorage (private mode?).',
      }
    }
    return { ok: true, data: localStorage.getItem(key) }
  } catch (e) {
    return {
      ok: false,
      error: e?.name === 'QuotaExceededError'
        ? 'Phone storage full. Free space or export & delete old data.'
        : `Could not read data: ${e?.message || 'unknown error'}`,
    }
  }
}

function writeRaw(key, value) {
  try {
    if (!storageAvailable()) {
      return {
        ok: false,
        error: 'Storage unavailable. Browser may be blocking localStorage (private mode?).',
      }
    }
    localStorage.setItem(key, value)
    return { ok: true }
  } catch (e) {
    const isQuota =
      e?.name === 'QuotaExceededError' ||
      e?.code === 22 ||
      e?.code === 1014
    return {
      ok: false,
      error: isQuota
        ? 'Phone storage full — could not save. Export data, free space, then try again.'
        : `Could not save: ${e?.message || 'unknown error'}`,
    }
  }
}

function removeRaw(key) {
  try {
    localStorage.removeItem(key)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: `Could not clear data: ${e?.message || 'unknown error'}` }
  }
}

function safeParse(raw, fallback) {
  try {
    if (raw == null || raw === '') return { ok: true, data: fallback }
    return { ok: true, data: JSON.parse(raw) }
  } catch {
    return {
      ok: false,
      error: 'Saved data is corrupted. Try Import from a backup, or Reset all data.',
      data: fallback,
    }
  }
}

function normalizeOrder(raw) {
  if (!raw || typeof raw !== 'object') return null
  const earnings = Number(raw.earnings)
  const distance = Number(raw.distance)
  const timeMinutes = Number(raw.timeMinutes)
  if (!Number.isFinite(earnings) || !Number.isFinite(distance) || !Number.isFinite(timeMinutes)) {
    return null
  }
  const platform = PLATFORMS.includes(raw.platform) ? raw.platform : 'Other'
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uuidv4(),
    platform,
    earnings,
    distance: Math.max(0, distance),
    timeMinutes: Math.max(0, timeMinutes),
    timestamp:
      typeof raw.timestamp === 'string' && !Number.isNaN(Date.parse(raw.timestamp))
        ? raw.timestamp
        : new Date().toISOString(),
    note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 120) : '',
  }
}

export function getOrders() {
  const read = readRaw(STORAGE_KEYS.ORDERS)
  if (!read.ok) return { ok: false, data: [], error: read.error }
  const parsed = safeParse(read.data, [])
  if (!parsed.ok) return { ok: false, data: [], error: parsed.error }
  const list = Array.isArray(parsed.data) ? parsed.data : []
  const orders = list.map(normalizeOrder).filter(Boolean)
  return { ok: true, data: orders }
}

export function saveOrders(orders) {
  const write = writeRaw(STORAGE_KEYS.ORDERS, JSON.stringify(orders))
  return write.ok ? { ok: true, data: orders } : { ok: false, error: write.error }
}

export function addOrder(orderData) {
  const current = getOrders()
  if (!current.ok && current.error) {
    // still try with empty if corrupt, but surface error if storage blocked
    if (!storageAvailable()) return { ok: false, error: current.error }
  }
  const orders = current.data || []
  const order = normalizeOrder({
    id: uuidv4(),
    platform: orderData.platform,
    earnings: orderData.earnings,
    distance: orderData.distance,
    timeMinutes: orderData.timeMinutes,
    timestamp: orderData.timestamp || new Date().toISOString(),
    note: orderData.note,
  })
  if (!order || order.earnings <= 0 || order.timeMinutes <= 0) {
    return { ok: false, error: 'Invalid order values' }
  }
  orders.unshift(order)
  const saved = saveOrders(orders)
  if (!saved.ok) return saved
  return { ok: true, data: order }
}

export function updateOrder(id, updates) {
  const current = getOrders()
  if (!current.ok && !storageAvailable()) return { ok: false, error: current.error }
  const orders = current.data || []
  const idx = orders.findIndex((o) => o.id === id)
  if (idx === -1) return { ok: false, error: 'Order not found' }
  const merged = normalizeOrder({ ...orders[idx], ...updates, id })
  if (!merged || merged.earnings <= 0 || merged.timeMinutes <= 0) {
    return { ok: false, error: 'Invalid order values' }
  }
  orders[idx] = merged
  const saved = saveOrders(orders)
  if (!saved.ok) return saved
  return { ok: true, data: merged }
}

export function deleteOrder(id) {
  const current = getOrders()
  if (!current.ok && !storageAvailable()) return { ok: false, error: current.error }
  const orders = (current.data || []).filter((o) => o.id !== id)
  return saveOrders(orders)
}

export function getSettings() {
  const read = readRaw(STORAGE_KEYS.SETTINGS)
  if (!read.ok) {
    return { ok: false, data: { ...DEFAULT_SETTINGS }, error: read.error }
  }
  const parsed = safeParse(read.data, {})
  const raw = parsed.data && typeof parsed.data === 'object' ? parsed.data : {}
  const data = {
    mileageKmPerLitre:
      Number(raw.mileageKmPerLitre) > 0
        ? Number(raw.mileageKmPerLitre)
        : DEFAULT_SETTINGS.mileageKmPerLitre,
    petrolPricePerLitre:
      Number(raw.petrolPricePerLitre) > 0
        ? Number(raw.petrolPricePerLitre)
        : DEFAULT_SETTINGS.petrolPricePerLitre,
    currency: 'INR',
  }
  return { ok: parsed.ok, data, error: parsed.ok ? undefined : parsed.error }
}

function normalizeSettings(settings) {
  return {
    mileageKmPerLitre:
      Number(settings?.mileageKmPerLitre) > 0
        ? Number(settings.mileageKmPerLitre)
        : DEFAULT_SETTINGS.mileageKmPerLitre,
    petrolPricePerLitre:
      Number(settings?.petrolPricePerLitre) > 0
        ? Number(settings.petrolPricePerLitre)
        : DEFAULT_SETTINGS.petrolPricePerLitre,
    currency: 'INR',
  }
}

export function saveSettings(settings) {
  const next = normalizeSettings(settings)
  const write = writeRaw(STORAGE_KEYS.SETTINGS, JSON.stringify(next))
  return write.ok ? { ok: true, data: next } : { ok: false, error: write.error }
}

export function getLastPlatform() {
  const read = readRaw(STORAGE_KEYS.LAST_PLATFORM)
  if (!read.ok || !read.data) return 'Zomato'
  return PLATFORMS.includes(read.data) ? read.data : 'Zomato'
}

export function setLastPlatform(platform) {
  if (!PLATFORMS.includes(platform)) return { ok: true }
  return writeRaw(STORAGE_KEYS.LAST_PLATFORM, platform)
}

export function getTimerState() {
  const read = readRaw(STORAGE_KEYS.TIMER)
  if (!read.ok) return { running: false, startedAt: null, distanceKm: 0, lastPoint: null }
  const parsed = safeParse(read.data, { running: false, startedAt: null })
  const d = parsed.data || {}
  const distanceKm = Number(d.distanceKm)
  const pointCount = Number(d.pointCount)
  const glitchCount = Number(d.glitchCount)
  const backgroundCount = Number(d.backgroundCount)
  return {
    running: Boolean(d.running && d.startedAt),
    startedAt: d.startedAt || null,
    distanceKm: Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0,
    lastPoint:
      d.lastPoint &&
      Number.isFinite(Number(d.lastPoint.lat)) &&
      Number.isFinite(Number(d.lastPoint.lng))
        ? {
            lat: Number(d.lastPoint.lat),
            lng: Number(d.lastPoint.lng),
            accuracy: Number(d.lastPoint.accuracy) || null,
            timestamp: Number(d.lastPoint.timestamp) || Date.now(),
          }
        : null,
    pointCount: Number.isFinite(pointCount) ? Math.max(0, pointCount) : 0,
    glitchCount: Number.isFinite(glitchCount) ? Math.max(0, glitchCount) : 0,
    gpsStatus: typeof d.gpsStatus === 'string' ? d.gpsStatus : 'idle',
    gpsMessage: typeof d.gpsMessage === 'string' ? d.gpsMessage : '',
    backgroundedAt: d.backgroundedAt || null,
    backgroundCount: Number.isFinite(backgroundCount) ? Math.max(0, backgroundCount) : 0,
  }
}

export function saveTimerState(state) {
  return writeRaw(STORAGE_KEYS.TIMER, JSON.stringify(state))
}

export function clearTimerState() {
  return removeRaw(STORAGE_KEYS.TIMER)
}

/** Build export payload for download */
export function buildExportPayload() {
  const orders = getOrders()
  // Never produce an "ok" backup from data we could not read — it would be
  // silently empty and a later Import of it would wipe the real orders.
  if (!orders.ok) {
    return { ok: false, error: `Export failed: ${orders.error || 'could not read saved orders'}` }
  }
  // Same rule for settings: getSettings() falls back to defaults when storage
  // is unreadable or the saved JSON is corrupt, so check `ok` before trusting it.
  const settings = getSettings()
  if (!settings.ok) {
    return { ok: false, error: `Export failed: ${settings.error || 'could not read saved settings'}` }
  }
  return {
    ok: true,
    data: {
      version: EXPORT_VERSION,
      app: 'kamai',
      exportedAt: new Date().toISOString(),
      settings: settings.data,
      orders: orders.data,
    },
  }
}

export function downloadExport() {
  try {
    const payload = buildExportPayload()
    if (!payload.ok) return payload
    const blob = new Blob([JSON.stringify(payload.data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const day = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `kamai-backup-${day}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: `Export failed: ${e?.message || 'unknown error'}` }
  }
}

/** Put raw values back (null = remove the key). Returns a list of errors. */
function restoreSnapshot(snapshot, keys) {
  const errors = []
  for (const key of keys) {
    const value = snapshot[key]
    const r = value == null ? removeRaw(key) : writeRaw(key, value)
    if (!r.ok) errors.push(`${key}: ${r.error}`)
  }
  return errors
}

/**
 * Import from parsed JSON. Replaces orders + settings.
 * Accepts either full export shape or raw array of orders.
 */
export function importFromJson(jsonText) {
  try {
    const parsed = JSON.parse(jsonText)
    let orders = []
    let settings = null

    if (Array.isArray(parsed)) {
      orders = parsed
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.orders)) orders = parsed.orders
      else {
        return { ok: false, error: 'Invalid backup file — missing orders array.' }
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        settings = parsed.settings
      }
    } else {
      return { ok: false, error: 'Invalid backup file format.' }
    }

    // Same invariant the log/edit forms enforce: earnings > 0 and time > 0.
    const normalized = orders
      .map(normalizeOrder)
      .filter((o) => o && o.earnings > 0 && o.timeMinutes > 0)
    const skippedCount = orders.length - normalized.length
    if (orders.length > 0 && normalized.length === 0) {
      return {
        ok: false,
        error: 'Import failed: no valid orders found in that file. Existing data was kept.',
      }
    }
    // localStorage has no transactions, so snapshot the raw values of both keys,
    // write, and restore the snapshot if any write fails.
    const snapshot = {}
    for (const key of [STORAGE_KEYS.ORDERS, STORAGE_KEYS.SETTINGS]) {
      const read = readRaw(key)
      if (!read.ok) {
        return {
          ok: false,
          error: `Import failed: could not back up current data first (${read.error}). Existing data was kept.`,
        }
      }
      snapshot[key] = read.data // null means "key was absent"
    }

    // A failed setItem leaves its key untouched, so only keys that were
    // actually written need restoring.
    const written = []
    let writeError = null
    const ordersWrite = writeRaw(STORAGE_KEYS.ORDERS, JSON.stringify(normalized))
    if (ordersWrite.ok) written.push(STORAGE_KEYS.ORDERS)
    else writeError = ordersWrite.error
    if (!writeError && settings) {
      const settingsWrite = writeRaw(
        STORAGE_KEYS.SETTINGS,
        JSON.stringify(normalizeSettings(settings))
      )
      if (settingsWrite.ok) written.push(STORAGE_KEYS.SETTINGS)
      else writeError = settingsWrite.error
    }

    if (writeError) {
      const rollbackErrors = restoreSnapshot(snapshot, written)
      if (rollbackErrors.length > 0) {
        return {
          ok: false,
          rollbackFailed: true,
          error:
            `Import failed (${writeError}) and the previous data could not be fully restored ` +
            `(${rollbackErrors.join('; ')}). Your saved data may be incomplete — ` +
            'export or re-import a backup as soon as possible.',
        }
      }
      return {
        ok: false,
        error: `Import failed: ${writeError} Your existing data was restored unchanged.`,
      }
    }

    return {
      ok: true,
      data: {
        orderCount: normalized.length,
        skippedCount,
        settingsUpdated: Boolean(settings),
      },
    }
  } catch (e) {
    return {
      ok: false,
      error: `Could not import: ${e?.message || 'invalid JSON'}`,
    }
  }
}

export function resetAllData() {
  const keys = Object.values(STORAGE_KEYS)
  for (const key of keys) {
    const r = removeRaw(key)
    if (!r.ok) return r
  }
  return { ok: true }
}
