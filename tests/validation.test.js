import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parsePositiveNumber,
  validateOrderForm,
  validateSettingsForm,
} from '../src/lib/validation.js'

test('parsePositiveNumber rejects blank, letters and negatives', () => {
  assert.equal(parsePositiveNumber('').ok, false)
  assert.equal(parsePositiveNumber('12abc').ok, false)
  assert.equal(parsePositiveNumber('-5').ok, false)
})

test('parsePositiveNumber handles zero depending on allowZero', () => {
  assert.equal(parsePositiveNumber('0').ok, false)
  assert.equal(parsePositiveNumber('0', { allowZero: true }).ok, true)
})

test('parsePositiveNumber accepts decimals', () => {
  assert.deepEqual(parsePositiveNumber('12.5'), { ok: true, value: 12.5 })
})

test('validateOrderForm accepts a good order and allows zero distance', () => {
  const r = validateOrderForm({ earnings: '250', distance: '0', timeMinutes: '30' })
  assert.equal(r.ok, true)
  assert.deepEqual(r.values, { earnings: 250, distance: 0, timeMinutes: 30 })
})

test('validateOrderForm reports an error per bad field', () => {
  const r = validateOrderForm({ earnings: '', distance: '-1', timeMinutes: '0' })
  assert.equal(r.ok, false)
  assert.deepEqual(Object.keys(r.errors).sort(), ['distance', 'earnings', 'timeMinutes'])
})

test('validateSettingsForm requires positive mileage and price', () => {
  assert.equal(validateSettingsForm({ mileageKmPerLitre: '40', petrolPricePerLitre: '105' }).ok, true)
  assert.equal(validateSettingsForm({ mileageKmPerLitre: '0', petrolPricePerLitre: '' }).ok, false)
})
