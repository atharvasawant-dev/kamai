import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// Minimal in-memory localStorage; storage.js only touches it inside functions.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    store.set(k, String(v))
  },
  removeItem: (k) => {
    store.delete(k)
  },
}

const {
  addOrder,
  buildExportPayload,
  deleteOrder,
  getOrders,
  getSettings,
  importFromJson,
  resetAllData,
  saveSettings,
  updateOrder,
} = await import('../src/lib/storage.js')

const goodOrder = (over = {}) => ({
  id: 'o1',
  platform: 'Zomato',
  earnings: 100,
  distance: 2,
  timeMinutes: 30,
  timestamp: '2026-10-01T10:00:00.000Z',
  ...over,
})

beforeEach(() => store.clear())

test('addOrder persists and getOrders returns newest first', () => {
  addOrder({ platform: 'Swiggy', earnings: 80, distance: 3, timeMinutes: 20 })
  addOrder({ platform: 'Uber', earnings: 120, distance: 5, timeMinutes: 40 })
  const { ok, data } = getOrders()
  assert.equal(ok, true)
  assert.deepEqual(data.map((o) => o.platform), ['Uber', 'Swiggy'])
})

test('addOrder rejects zero earnings or zero time', () => {
  assert.equal(addOrder({ platform: 'Uber', earnings: 0, distance: 1, timeMinutes: 10 }).ok, false)
  assert.equal(addOrder({ platform: 'Uber', earnings: 10, distance: 1, timeMinutes: 0 }).ok, false)
  assert.equal(getOrders().data.length, 0)
})

test('addOrder falls back to Other for unknown platforms and trims notes', () => {
  const { data } = addOrder({
    platform: 'Dunzo',
    earnings: 50,
    distance: 1,
    timeMinutes: 10,
    note: '  rain  ',
  })
  assert.equal(data.platform, 'Other')
  assert.equal(data.note, 'rain')
})

test('updateOrder and deleteOrder change only the targeted order', () => {
  const a = addOrder({ platform: 'Swiggy', earnings: 80, distance: 3, timeMinutes: 20 }).data
  const b = addOrder({ platform: 'Uber', earnings: 120, distance: 5, timeMinutes: 40 }).data
  assert.equal(updateOrder(a.id, { earnings: 90 }).ok, true)
  assert.equal(updateOrder('missing', { earnings: 90 }).ok, false)
  assert.equal(updateOrder(a.id, { earnings: 0 }).ok, false)
  deleteOrder(b.id)
  const { data } = getOrders()
  assert.equal(data.length, 1)
  assert.equal(data[0].earnings, 90)
})

test('getOrders reports corrupted JSON instead of throwing', () => {
  store.set('kamai_orders', '{not json')
  const r = getOrders()
  assert.equal(r.ok, false)
  assert.deepEqual(r.data, [])
  assert.match(r.error, /corrupted/i)
})

test('getSettings returns defaults when nothing or junk is stored', () => {
  assert.equal(getSettings().data.petrolPricePerLitre, 105)
  store.set('kamai_settings', JSON.stringify({ mileageKmPerLitre: -3, petrolPricePerLitre: 'x' }))
  assert.deepEqual(getSettings().data, {
    mileageKmPerLitre: 40,
    petrolPricePerLitre: 105,
    currency: 'INR',
  })
})

test('storage write failures (quota) surface as errors, not exceptions', () => {
  const realSet = globalThis.localStorage.setItem
  let calls = 0
  globalThis.localStorage.setItem = (k, v) => {
    calls += 1
    if (k !== '__kamai_test__') {
      const err = new Error('full')
      err.name = 'QuotaExceededError'
      throw err
    }
    realSet(k, v)
  }
  try {
    const r = addOrder({ platform: 'Uber', earnings: 10, distance: 1, timeMinutes: 10 })
    assert.equal(r.ok, false)
    assert.match(r.error, /storage full/i)
    assert.ok(calls > 0)
  } finally {
    globalThis.localStorage.setItem = realSet
  }
})

test('export -> import round trip preserves orders and settings', () => {
  addOrder({ platform: 'Swiggy', earnings: 120, distance: 4.5, timeMinutes: 35 })
  saveSettings({ mileageKmPerLitre: 35, petrolPricePerLitre: 110 })
  const exported = JSON.stringify(buildExportPayload().data)

  store.clear()
  const r = importFromJson(exported)
  assert.deepEqual(r, { ok: true, data: { orderCount: 1, skippedCount: 0, settingsUpdated: true } })
  assert.equal(getOrders().data[0].earnings, 120)
  assert.deepEqual(getSettings().data, {
    mileageKmPerLitre: 35,
    petrolPricePerLitre: 110,
    currency: 'INR',
  })
})

test('export payload is versioned and tagged', () => {
  const { ok, data } = buildExportPayload()
  assert.equal(ok, true)
  assert.equal(data.app, 'kamai')
  assert.equal(data.version, 1)
  assert.deepEqual(data.orders, [])
})

test('export refuses to produce an empty backup from corrupted data', () => {
  store.set('kamai_orders', '{not json')
  const r = buildExportPayload()
  assert.equal(r.ok, false)
  assert.match(r.error, /Export failed/)
})

test('import accepts a bare array of orders and leaves settings alone', () => {
  saveSettings({ mileageKmPerLitre: 30, petrolPricePerLitre: 120 })
  const r = importFromJson(JSON.stringify([goodOrder()]))
  assert.equal(r.ok, true)
  assert.equal(r.data.settingsUpdated, false)
  assert.equal(getSettings().data.mileageKmPerLitre, 30)
})

test('import rejects malformed JSON and wrong shapes without touching data', () => {
  addOrder({ platform: 'Uber', earnings: 10, distance: 1, timeMinutes: 10 })
  assert.equal(importFromJson('not json').ok, false)
  assert.equal(importFromJson('42').ok, false)
  assert.equal(importFromJson(JSON.stringify({ settings: {} })).ok, false)
  assert.equal(getOrders().data.length, 1)
})

test('import with only invalid orders keeps existing data', () => {
  store.set('kamai_orders', JSON.stringify([goodOrder({ id: 'keep' })]))
  const r = importFromJson(JSON.stringify({ orders: [{ junk: true }, { earnings: 'abc' }] }))
  assert.equal(r.ok, false)
  assert.match(r.error, /Existing data was kept/)
  assert.deepEqual(getOrders().data.map((o) => o.id), ['keep'])
})

test('import skips orders the log form would reject and reports the count', () => {
  const r = importFromJson(
    JSON.stringify({
      orders: [
        goodOrder({ id: 'ok' }),
        goodOrder({ id: 'neg', earnings: -50 }),
        goodOrder({ id: 'zero-time', timeMinutes: 0 }),
        goodOrder({ id: 'nulls', earnings: null, distance: null, timeMinutes: null }),
      ],
    }),
  )
  assert.equal(r.ok, true)
  assert.equal(r.data.orderCount, 1)
  assert.equal(r.data.skippedCount, 3)
  assert.deepEqual(getOrders().data.map((o) => o.id), ['ok'])
})

test('import of an explicitly empty backup is allowed and clears orders', () => {
  addOrder({ platform: 'Uber', earnings: 10, distance: 1, timeMinutes: 10 })
  const r = importFromJson(JSON.stringify({ orders: [] }))
  assert.equal(r.ok, true)
  assert.equal(getOrders().data.length, 0)
})

test('import clamps negative distance and replaces unknown platform with Other', () => {
  importFromJson(JSON.stringify([goodOrder({ distance: -4, platform: 'Dunzo' })]))
  const [o] = getOrders().data
  assert.equal(o.distance, 0)
  assert.equal(o.platform, 'Other')
})

test('resetAllData removes orders, settings and timer state', () => {
  addOrder({ platform: 'Uber', earnings: 10, distance: 1, timeMinutes: 10 })
  saveSettings({ mileageKmPerLitre: 35, petrolPricePerLitre: 110 })
  store.set('kamai_timer', '{}')
  assert.equal(resetAllData().ok, true)
  assert.equal(getOrders().data.length, 0)
  assert.equal(getSettings().data.mileageKmPerLitre, 40)
  assert.equal(store.has('kamai_timer'), false)
})
