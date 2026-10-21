/**
 * Kamai self-check — runs checklist scenarios without a browser.
 * Imports the real calculation + validation modules (no copied formulas).
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { aggregateOrders, estimateFuelCost } from '../src/lib/calculations.js'
import { parsePositiveNumber } from '../src/lib/validation.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const settings = { mileageKmPerLitre: 40, petrolPricePerLitre: 105 }
let passed = 0
let failed = 0

function assert(name, cond, detail = '') {
  if (cond) {
    console.log(`  PASS  ${name}`)
    passed++
  } else {
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

console.log('\n=== Kamai checklist ===\n')

// 1. Log order → home aggregate updates
console.log('1. Log order shows on home')
let orders = []
const o1 = { id: '1', platform: 'Swiggy', earnings: 120, distance: 5, timeMinutes: 30, timestamp: new Date().toISOString() }
orders = [o1, ...orders]
let stats = aggregateOrders(orders, settings)
assert('1 order on dashboard', stats.orderCount === 1)
assert('earnings 120', stats.totalEarnings === 120)
assert('realPerHour is finite number', Number.isFinite(stats.realPerHour))

// 2. 3 orders, 2 platforms
console.log('\n2. Multi-platform breakdown')
orders = [
  { id: '1', platform: 'Swiggy', earnings: 100, distance: 4, timeMinutes: 30, timestamp: new Date().toISOString() },
  { id: '2', platform: 'Swiggy', earnings: 80, distance: 3, timeMinutes: 20, timestamp: new Date().toISOString() },
  { id: '3', platform: 'Zomato', earnings: 90, distance: 5, timeMinutes: 25, timestamp: new Date().toISOString() },
]
stats = aggregateOrders(orders, settings)
const swiggy = stats.platformRows.find((r) => r.platform === 'Swiggy')
const zomato = stats.platformRows.find((r) => r.platform === 'Zomato')
assert('2 platforms', stats.platformRows.length === 2)
assert('Swiggy 2 orders', swiggy?.count === 2)
assert('Swiggy earnings 180', swiggy?.earnings === 180)
assert('Zomato 1 order', zomato?.count === 1)
assert('Zomato earnings 90', zomato?.earnings === 90)
assert('total earnings 270', stats.totalEarnings === 270)

// 3. Delete order → totals update
console.log('\n3. Delete updates totals')
orders = orders.filter((o) => o.id !== '3')
stats = aggregateOrders(orders, settings)
assert('2 orders left', stats.orderCount === 2)
assert('total 180 after delete', stats.totalEarnings === 180)
assert('1 platform left', stats.platformRows.length === 1)

// 4. Zero hours → no NaN
console.log('\n4. Zero hours guard')
stats = aggregateOrders([], settings)
assert('empty realPerHour null', stats.realPerHour === null)
assert('not NaN', !Number.isNaN(stats.realPerHour))
const zeroTime = aggregateOrders(
  [{ earnings: 50, distance: 1, timeMinutes: 0, platform: 'Uber' }],
  settings
)
assert('0 minutes → null rate', zeroTime.realPerHour === null)
assert('display safe (no NaN/Infinity shown)', zeroTime.realPerHour === null)

// 5. localStorage shape persistence (simulated export/import)
console.log('\n5. Persistence shape (export/import)')
const exportPayload = {
  version: 1,
  app: 'kamai',
  settings,
  orders,
}
const roundTrip = JSON.parse(JSON.stringify(exportPayload))
assert('export has orders', Array.isArray(roundTrip.orders) && roundTrip.orders.length === 2)
assert('export has settings petrol 105', roundTrip.settings.petrolPricePerLitre === 105)
const restored = aggregateOrders(roundTrip.orders, roundTrip.settings)
assert('import restores totals', restored.totalEarnings === 180)

// 6. Export then import validation
console.log('\n6. Export/import restore')
const backup = { version: 1, app: 'kamai', settings: { mileageKmPerLitre: 35, petrolPricePerLitre: 110, currency: 'INR' }, orders: [
  { id: 'a', platform: 'Uber', earnings: 200, distance: 10, timeMinutes: 60, timestamp: '2026-07-01T10:00:00.000Z', note: '' },
]}
const imported = aggregateOrders(backup.orders, backup.settings)
assert('imported 1 order', imported.orderCount === 1)
assert('imported earnings 200', imported.totalEarnings === 200)
const fuel = estimateFuelCost(10, backup.settings)
assert('fuel uses imported mileage', Math.abs(fuel - (10 / 35) * 110) < 0.01)

// 7. Validation rejects bad inputs
console.log('\n7. Input validation')
assert('reject letters in earnings', !parsePositiveNumber('abc').ok)
assert('reject negative earnings', !parsePositiveNumber('-5').ok)
assert('reject empty', !parsePositiveNumber('').ok)
assert('accept 85', parsePositiveNumber('85').ok)
assert('accept distance 0', parsePositiveNumber('0', { allowZero: true }).ok)
assert('reject distance -1', !parsePositiveNumber('-1', { allowZero: true }).ok)

// 8. 0 / 1 / 50+ orders
console.log('\n8. Scale: 0, 1, 50+ orders')
assert('0 orders safe', aggregateOrders([], settings).realPerHour === null)
assert('1 order safe', Number.isFinite(aggregateOrders([o1], settings).realPerHour))
const many = Array.from({ length: 55 }, (_, i) => ({
  id: String(i),
  platform: i % 2 ? 'Swiggy' : 'Zomato',
  earnings: 50 + (i % 10),
  distance: 2 + (i % 5),
  timeMinutes: 15 + (i % 20),
  timestamp: new Date().toISOString(),
}))
const big = aggregateOrders(many, settings)
assert('55 orders count', big.orderCount === 55)
assert('55 orders finite rate', Number.isFinite(big.realPerHour))
assert('55 orders 2 platforms', big.platformRows.length === 2)

// Default petrol 105 in constants file
console.log('\n9. Defaults')
const constantsSrc = readFileSync(join(root, 'src/lib/constants.js'), 'utf8')
assert('default petrol 105', constantsSrc.includes('petrolPricePerLitre: 105'))
assert('default mileage 40', constantsSrc.includes('mileageKmPerLitre: 40'))

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
