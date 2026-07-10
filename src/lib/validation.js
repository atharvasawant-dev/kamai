/** Shared number-input validation for forms */

export function isBlank(value) {
  return value === '' || value === null || value === undefined
}

/** Accepts only valid finite numbers; rejects letters and empty */
export function parsePositiveNumber(value, { allowZero = false } = {}) {
  if (isBlank(value)) {
    return { ok: false, error: 'Required' }
  }
  const raw = String(value).trim()
  // Block pure junk / letters while allowing decimals
  if (!/^-?\d*\.?\d+$/.test(raw)) {
    return { ok: false, error: 'Enter a valid number (no letters)' }
  }
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'Enter a valid number' }
  }
  if (allowZero) {
    if (n < 0) return { ok: false, error: 'Cannot be negative' }
  } else if (n <= 0) {
    return { ok: false, error: 'Must be greater than 0' }
  }
  return { ok: true, value: n }
}

export function validateOrderForm(form) {
  const errors = {}

  const earnings = parsePositiveNumber(form.earnings, { allowZero: false })
  if (!earnings.ok) {
    errors.earnings =
      earnings.error === 'Required'
        ? 'Kamai ₹ enter karo (must be > 0)'
        : earnings.error === 'Must be greater than 0'
          ? 'Earnings must be greater than 0'
          : earnings.error
  }

  const distance = parsePositiveNumber(form.distance, { allowZero: true })
  if (!distance.ok) {
    errors.distance =
      distance.error === 'Required'
        ? 'Distance enter karo (0 ok if no travel)'
        : distance.error === 'Cannot be negative'
          ? 'Distance cannot be negative'
          : distance.error
  }

  const time = parsePositiveNumber(form.timeMinutes, { allowZero: false })
  if (!time.ok) {
    errors.timeMinutes =
      time.error === 'Required'
        ? 'Minutes enter karo (must be > 0)'
        : time.error === 'Must be greater than 0'
          ? 'Time must be greater than 0 minutes'
          : time.error
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: {
      earnings: earnings.ok ? earnings.value : null,
      distance: distance.ok ? distance.value : null,
      timeMinutes: time.ok ? time.value : null,
    },
  }
}

export function validateSettingsForm(form) {
  const errors = {}
  const mileage = parsePositiveNumber(form.mileageKmPerLitre, { allowZero: false })
  if (!mileage.ok) {
    errors.mileageKmPerLitre = 'Mileage must be greater than 0'
  }
  const price = parsePositiveNumber(form.petrolPricePerLitre, { allowZero: false })
  if (!price.ok) {
    errors.petrolPricePerLitre = 'Petrol price must be greater than 0'
  }
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: {
      mileageKmPerLitre: mileage.ok ? mileage.value : null,
      petrolPricePerLitre: price.ok ? price.value : null,
    },
  }
}
