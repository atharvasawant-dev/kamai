import test from 'node:test'
import assert from 'node:assert/strict'
import {
  accumulatePoint,
  elapsedMinutesRounded,
  haversineKm,
  isPlausibleSegment,
  roundKm1,
} from '../src/lib/geo.js'

test('haversineKm: one degree of longitude at the equator is ~111.19 km', () => {
  assert.ok(Math.abs(haversineKm(0, 0, 0, 1) - 111.195) < 0.01)
  assert.equal(haversineKm(19.2, 72.85, 19.2, 72.85), 0)
})

test('isPlausibleSegment accepts bike speeds and rejects teleports', () => {
  const prev = { lat: 0, lng: 0, timestamp: 0 }
  // ~1.11 km in 1 minute = ~67 km/h
  assert.equal(isPlausibleSegment(prev, { lat: 0, lng: 0.01, timestamp: 60_000 }), true)
  // ~111 km in 1 minute
  assert.equal(isPlausibleSegment(prev, { lat: 0, lng: 1, timestamp: 60_000 }), false)
  // non-increasing timestamps are never plausible
  assert.equal(isPlausibleSegment(prev, { lat: 0, lng: 0.01, timestamp: 0 }), false)
  assert.equal(isPlausibleSegment(null, prev), false)
})

test('accumulatePoint: first fix is accepted, glitches are ignored', () => {
  const first = { lat: 0, lng: 0, timestamp: 0 }
  const a = accumulatePoint(null, 0, first)
  assert.deepEqual(a, { distanceKm: 0, lastPoint: first, accepted: true })

  const good = { lat: 0, lng: 0.01, timestamp: 60_000 }
  const b = accumulatePoint(first, 0, good)
  assert.equal(b.accepted, true)
  assert.ok(Math.abs(b.distanceKm - 1.112) < 0.01)

  const jump = { lat: 0, lng: 1, timestamp: 120_000 }
  const c = accumulatePoint(good, b.distanceKm, jump)
  assert.equal(c.accepted, false)
  assert.equal(c.distanceKm, b.distanceKm)
  assert.equal(c.lastPoint, good)
})

test('accumulatePoint ignores non-finite coordinates', () => {
  const last = { lat: 0, lng: 0, timestamp: 0 }
  const r = accumulatePoint(last, 5, { lat: NaN, lng: 0, timestamp: 1000 })
  assert.deepEqual(r, { distanceKm: 5, lastPoint: last, accepted: false })
})

test('elapsedMinutesRounded rounds, floors at 1 for any positive time, 0 for invalid', () => {
  assert.equal(elapsedMinutesRounded(0, 20_000), 1)
  assert.equal(elapsedMinutesRounded(0, 90_000), 2)
  assert.equal(elapsedMinutesRounded(1000, 1000), 0)
  assert.equal(elapsedMinutesRounded(5000, 1000), 0)
  assert.equal(elapsedMinutesRounded('not a date', 1000), 0)
  assert.equal(
    elapsedMinutesRounded('2026-10-21T10:00:00.000Z', '2026-10-21T10:25:00.000Z'),
    25,
  )
})

test('roundKm1 rounds to one decimal and tolerates junk', () => {
  assert.equal(roundKm1(3.456), 3.5)
  assert.equal(roundKm1('abc'), 0)
})
