import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays,
  aggregateOrders,
  dailyBreakdown,
  estimateFuelCost,
  formatHours,
  ordersInLastNDays,
  toDateKey,
} from '../src/lib/calculations.js'
import { DEFAULT_SETTINGS } from '../src/lib/constants.js'

const settings = { mileageKmPerLitre: 40, petrolPricePerLitre: 100 }

test('toDateKey formats a local date as YYYY-MM-DD', () => {
  assert.equal(toDateKey(new Date(2026, 0, 5)), '2026-01-05')
})

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
})

test('estimateFuelCost = distance / mileage * price', () => {
  assert.equal(estimateFuelCost(80, settings), 200)
})

test('estimateFuelCost falls back to defaults for bad settings', () => {
  const cost = estimateFuelCost(40, { mileageKmPerLitre: 'x', petrolPricePerLitre: 'y' })
  assert.equal(cost, 105) // 40 km at the 40 km/l and Rs 105/l defaults
})

test('estimateFuelCost fallback matches DEFAULT_SETTINGS', () => {
  const expected =
    (40 / DEFAULT_SETTINGS.mileageKmPerLitre) * DEFAULT_SETTINGS.petrolPricePerLitre
  assert.equal(estimateFuelCost(40, {}), expected)
  assert.equal(estimateFuelCost(40), expected)
})

test('estimateFuelCost ignores zero, negative and non-finite settings', () => {
  const dflt = estimateFuelCost(40, {})
  for (const bad of [0, -5, NaN, Infinity, null, undefined, '']) {
    assert.equal(
      estimateFuelCost(40, { mileageKmPerLitre: bad, petrolPricePerLitre: bad }),
      dflt,
      `bad setting ${String(bad)}`,
    )
  }
})

test('estimateFuelCost is never negative or NaN for bad distances', () => {
  for (const bad of [0, -10, NaN, Infinity, null, undefined, 'abc']) {
    assert.equal(estimateFuelCost(bad, settings), 0, `distance ${String(bad)}`)
  }
  assert.equal(estimateFuelCost('80', settings), 200) // numeric strings still work
})

test('formatHours handles minutes, whole hours and mixed', () => {
  assert.equal(formatHours(45), '45 min')
  assert.equal(formatHours(120), '2h')
  assert.equal(formatHours(135), '2h 15m')
})

test('formatHours never renders 60 minutes for fractional input', () => {
  assert.equal(formatHours(59.7), '1h')
  assert.equal(formatHours(119.6), '2h')
  assert.equal(formatHours(0), '0 min')
  assert.equal(formatHours(undefined), '0 min')
})

test('aggregateOrders computes real earnings per hour after fuel', () => {
  const orders = [
    { platform: 'Zomato', earnings: 300, distance: 20, timeMinutes: 60 },
    { platform: 'Swiggy', earnings: 200, distance: 20, timeMinutes: 60 },
  ]
  const r = aggregateOrders(orders, settings)
  assert.equal(r.totalEarnings, 500)
  assert.equal(r.fuelCost, 100) // 40 km / 40 * 100
  assert.equal(r.netEarnings, 400)
  assert.equal(r.realPerHour, 200) // 400 / 2h
  assert.equal(r.grossPerHour, 250)
})

test('aggregateOrders never returns NaN when no time is logged', () => {
  const r = aggregateOrders([], settings)
  assert.equal(r.realPerHour, null)
  assert.equal(r.grossPerHour, null)
})

test('aggregateOrders: fuel above earnings gives a negative real rate', () => {
  const r = aggregateOrders(
    [{ platform: 'Uber', earnings: 10, distance: 40, timeMinutes: 60 }],
    settings,
  )
  assert.equal(r.fuelCost, 100)
  assert.equal(r.netEarnings, -90)
  assert.equal(r.realPerHour, -90)
})

test('aggregateOrders: zero-minute orders count toward earnings but give no rate', () => {
  const r = aggregateOrders(
    [{ platform: 'Uber', earnings: 50, distance: 1, timeMinutes: 0 }],
    settings,
  )
  assert.equal(r.totalEarnings, 50)
  assert.equal(r.realPerHour, null)
  assert.equal(r.platformRows[0].realPerHour, null)
})

test('aggregateOrders: unknown platform is grouped as Other', () => {
  const r = aggregateOrders([{ earnings: 50, distance: 1, timeMinutes: 10 }], settings)
  assert.equal(r.platformRows[0].platform, 'Other')
})

test('aggregateOrders groups by platform and sorts by earnings', () => {
  const orders = [
    { platform: 'Swiggy', earnings: 100, distance: 5, timeMinutes: 30 },
    { platform: 'Zomato', earnings: 400, distance: 5, timeMinutes: 30 },
    { platform: 'Zomato', earnings: 100, distance: 5, timeMinutes: 30 },
  ]
  const rows = aggregateOrders(orders, settings).platformRows
  assert.deepEqual(rows.map((r) => r.platform), ['Zomato', 'Swiggy'])
  assert.equal(rows[0].count, 2)
})

// Local-noon timestamps keep these independent of the machine's timezone.
const at = (y, m, d) => new Date(y, m - 1, d, 12).toISOString()
const endDay = new Date(2026, 9, 21, 12) // 2026-10-21

test('ordersInLastNDays includes both window edges and excludes older orders', () => {
  const orders = [
    { id: 'old', timestamp: at(2026, 10, 14) },
    { id: 'start', timestamp: at(2026, 10, 15) },
    { id: 'end', timestamp: at(2026, 10, 21) },
    { id: 'future', timestamp: at(2026, 10, 22) },
  ]
  const ids = ordersInLastNDays(orders, 7, endDay).map((o) => o.id)
  assert.deepEqual(ids, ['start', 'end'])
})

test('dailyBreakdown returns 7 oldest-first days and zero-fills empty ones', () => {
  const orders = [
    { platform: 'Zomato', earnings: 200, distance: 20, timeMinutes: 60, timestamp: at(2026, 10, 21) },
  ]
  const days = dailyBreakdown(orders, settings, 7, endDay)
  assert.equal(days.length, 7)
  assert.equal(days[0].dateKey, '2026-10-15')
  assert.equal(days[6].dateKey, '2026-10-21')
  assert.equal(days[6].orderCount, 1)
  assert.equal(days[6].realPerHour, 150) // (200 - 20/40*100) / 1h
  assert.equal(days[0].orderCount, 0)
  assert.equal(days[0].realPerHour, null)
})
