/** Local calendar date key YYYY-MM-DD */
export function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(dateKey, delta) {
  const d = parseDateKey(dateKey)
  d.setDate(d.getDate() + delta)
  return toDateKey(d)
}

export function formatDisplayDate(dateKey) {
  const today = toDateKey(new Date())
  const yesterday = addDays(today, -1)
  if (dateKey === today) return 'Aaj · Today'
  if (dateKey === yesterday) return 'Kal · Yesterday'
  const d = parseDateKey(dateKey)
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatINR(amount) {
  const n = Number(amount) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatINRPrecise(amount) {
  const n = Number(amount) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 1,
  }).format(n)
}

export function formatHours(minutes) {
  const mins = Number(minutes) || 0
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function estimateFuelCost(distanceKm, settings) {
  const mileage = Number(settings.mileageKmPerLitre) || 40
  const price = Number(settings.petrolPricePerLitre) || 100
  if (mileage <= 0) return 0
  return (Number(distanceKm) / mileage) * price
}

/**
 * Aggregate stats for a list of orders.
 * Real kamai/hour = (earnings − fuel) ÷ hours
 * If hours === 0, realPerHour is null (show "Log your first order")
 */
export function aggregateOrders(orders, settings) {
  const totalEarnings = orders.reduce((s, o) => s + (Number(o.earnings) || 0), 0)
  const totalDistance = orders.reduce((s, o) => s + (Number(o.distance) || 0), 0)
  const totalMinutes = orders.reduce((s, o) => s + (Number(o.timeMinutes) || 0), 0)
  const totalHours = totalMinutes / 60
  const fuelCost = estimateFuelCost(totalDistance, settings)
  const netEarnings = totalEarnings - fuelCost
  const realPerHour = totalHours > 0 ? netEarnings / totalHours : null
  const grossPerHour = totalHours > 0 ? totalEarnings / totalHours : null

  const byPlatform = {}
  for (const o of orders) {
    const p = o.platform || 'Other'
    if (!byPlatform[p]) {
      byPlatform[p] = {
        platform: p,
        count: 0,
        earnings: 0,
        distance: 0,
        minutes: 0,
      }
    }
    byPlatform[p].count += 1
    byPlatform[p].earnings += Number(o.earnings) || 0
    byPlatform[p].distance += Number(o.distance) || 0
    byPlatform[p].minutes += Number(o.timeMinutes) || 0
  }

  const platformRows = Object.values(byPlatform).map((row) => {
    const hours = row.minutes / 60
    const fuel = estimateFuelCost(row.distance, settings)
    const net = row.earnings - fuel
    return {
      ...row,
      fuelCost: fuel,
      netEarnings: net,
      hours,
      realPerHour: hours > 0 ? net / hours : null,
    }
  })

  platformRows.sort((a, b) => b.earnings - a.earnings)

  return {
    orderCount: orders.length,
    totalEarnings,
    totalDistance,
    totalMinutes,
    totalHours,
    fuelCost,
    netEarnings,
    realPerHour,
    grossPerHour,
    platformRows,
  }
}

export function ordersForDate(orders, dateKey) {
  return orders.filter((o) => toDateKey(o.timestamp) === dateKey)
}

export function ordersInLastNDays(orders, n, endDate = new Date()) {
  const end = toDateKey(endDate)
  const start = addDays(end, -(n - 1))
  return orders.filter((o) => {
    const k = toDateKey(o.timestamp)
    return k >= start && k <= end
  })
}

export function dailyBreakdown(orders, settings, days = 7, endDate = new Date()) {
  const end = toDateKey(endDate)
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const key = addDays(end, -i)
    const dayOrders = ordersForDate(orders, key)
    const stats = aggregateOrders(dayOrders, settings)
    result.push({ dateKey: key, ...stats })
  }
  return result
}
