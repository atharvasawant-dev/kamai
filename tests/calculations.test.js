import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays,
  aggregateOrders,
  estimateFuelCost,
  formatHours,
  toDateKey,
} from '../src/lib/calculations.js'

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
  assert.equal(cost, 100) // 40 km at the 40 km/l and Rs 100/l defaults
})

test('formatHours handles minutes, whole hours and mixed', () => {
  assert.equal(formatHours(45), '45 min')
  assert.equal(formatHours(120), '2h')
  assert.equal(formatHours(135), '2h 15m')
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
