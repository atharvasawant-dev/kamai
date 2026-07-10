import { useEffect, useState } from 'react'
import {
  clearTimerState,
  getLastPlatform,
  getTimerState,
  saveTimerState,
  setLastPlatform,
} from '../lib/storage'
import { PLATFORMS, PLATFORM_COLORS } from '../lib/constants'
import { formatINR, toDateKey } from '../lib/calculations'
import { validateOrderForm } from '../lib/validation'
import {
  accumulatePoint,
  elapsedMinutesRounded,
  formatElapsedClock,
  GEO_WATCH_OPTIONS,
  isGeolocationSupported,
  roundKm1,
} from '../lib/geo'

const emptyForm = (platform) => ({
  platform: platform || getLastPlatform(),
  earnings: '',
  distance: '',
  timeMinutes: '',
  note: '',
})

/** Strip non-numeric except one decimal point */
function sanitizeNumericInput(raw) {
  let s = String(raw).replace(/[^\d.]/g, '')
  const parts = s.split('.')
  if (parts.length > 2) s = `${parts[0]}.${parts.slice(1).join('')}`
  return s
}

function pointFromPosition(position) {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp || Date.now(),
  }
}

function rideStatePatch(patch = {}) {
  return {
    running: false,
    startedAt: null,
    distanceKm: 0,
    lastPoint: null,
    pointCount: 0,
    glitchCount: 0,
    gpsStatus: 'idle',
    gpsMessage: '',
    backgroundedAt: null,
    backgroundCount: 0,
    ...patch,
  }
}

export default function LogOrder({
  orders,
  selectedDate,
  onSave,
  onUpdate,
  onDelete,
}) {
  const [form, setForm] = useState(() => emptyForm())
  const [errors, setErrors] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [toast, setToast] = useState('')
  const [timeMode, setTimeMode] = useState('manual')
  const [timer, setTimer] = useState(() => getTimerState())
  const [tick, setTick] = useState(0)

  const dayOrders = orders.filter((o) => toDateKey(o.timestamp) === selectedDate)
  const isToday = selectedDate === toDateKey(new Date())

  useEffect(() => {
    if (!timer.running) return undefined
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [timer.running])

  useEffect(() => {
    if (!timer.running || !isGeolocationSupported()) return undefined

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextPoint = pointFromPosition(position)
        setTimer((current) => {
          if (!current.running) return current

          const next = accumulatePoint(
            current.lastPoint,
            Number(current.distanceKm) || 0,
            nextPoint,
          )
          const nextState = rideStatePatch({
            ...current,
            distanceKm: next.distanceKm,
            lastPoint: next.lastPoint,
            pointCount: (current.pointCount || 0) + (next.accepted ? 1 : 0),
            glitchCount: (current.glitchCount || 0) + (next.accepted ? 0 : 1),
            gpsStatus: 'tracking',
            gpsMessage: next.accepted
              ? `GPS locked · ±${Math.round(nextPoint.accuracy || 0)}m`
              : 'GPS jump ignored',
          })
          saveTimerState(nextState)
          return nextState
        })
      },
      (error) => {
        setTimer((current) => {
          if (!current.running) return current

          const isDenied = error.code === error.PERMISSION_DENIED
          const nextState = rideStatePatch({
            ...current,
            gpsStatus: isDenied ? 'denied' : 'error',
            gpsMessage: isDenied
              ? 'GPS permission denied · enter distance manually'
              : 'GPS unavailable · timer still running',
          })
          saveTimerState(nextState)
          return nextState
        })
      },
      GEO_WATCH_OPTIONS,
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [timer.running])

  useEffect(() => {
    if (!timer.running || typeof document === 'undefined') return undefined

    function handleVisibilityChange() {
      setTimer((current) => {
        if (!current.running) return current

        const isHidden = document.visibilityState === 'hidden'
        const nextState = rideStatePatch({
          ...current,
          backgroundedAt: isHidden ? new Date().toISOString() : null,
          backgroundCount: (current.backgroundCount || 0) + (isHidden ? 1 : 0),
          gpsMessage: isHidden
            ? 'App in background · GPS may pause on some phones'
            : current.gpsMessage,
        })
        saveTimerState(nextState)
        return nextState
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [timer.running])

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(id)
  }, [toast])

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function setNumericField(key, raw) {
    setField(key, sanitizeNumericInput(raw))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const result = validateOrderForm(form)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }

    const payload = {
      platform: form.platform,
      earnings: result.values.earnings,
      distance: result.values.distance,
      timeMinutes: result.values.timeMinutes,
      note: form.note,
    }

    setLastPlatform(form.platform)

    let outcome
    if (editingId) {
      outcome = onUpdate(editingId, payload)
      if (outcome?.ok === false) {
        setToast(outcome.error || 'Update failed')
        return
      }
      setToast('Order updated ✓')
    } else {
      outcome = onSave({
        ...payload,
        timestamp: new Date().toISOString(),
      })
      if (outcome?.ok === false) {
        setToast(outcome.error || 'Save failed')
        return
      }
      setToast('Order saved ✓ · Saved!')
    }

    setEditingId(null)
    setForm(emptyForm(form.platform))
    setErrors({})
  }

  function startEdit(order) {
    setEditingId(order.id)
    setForm({
      platform: order.platform,
      earnings: String(order.earnings),
      distance: String(order.distance),
      timeMinutes: String(order.timeMinutes),
      note: order.note || '',
    })
    setTimeMode('manual')
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm())
    setErrors({})
  }

  function startRide() {
    const hasGps = isGeolocationSupported()
    const state = rideStatePatch({
      running: true,
      startedAt: new Date().toISOString(),
      gpsStatus: hasGps ? 'starting' : 'unsupported',
      gpsMessage: hasGps
        ? 'Requesting GPS permission...'
        : 'GPS not supported · enter distance manually',
    })
    const saved = saveTimerState(state)
    if (saved.ok === false) {
      setToast(saved.error || 'Ride save failed')
      return
    }
    setTimer(state)
    setTimeMode('timer')
    setToast(hasGps ? 'Ride started · GPS tracking on' : 'Ride started · distance manual')
  }

  function stopRide() {
    if (!timer.startedAt) return
    const mins = elapsedMinutesRounded(timer.startedAt)
    const km = roundKm1(timer.distanceKm)
    setField('timeMinutes', String(mins))
    if (km > 0) setField('distance', String(km))
    clearTimerState()
    setTimer(rideStatePatch())
    setTimeMode('manual')
    setToast(km > 0 ? `Ride stopped · ${mins} min, ${km} km filled` : `Ride stopped · ${mins} min filled`)
  }

  function resetRide() {
    clearTimerState()
    setTimer(rideStatePatch())
  }

  void tick

  return (
    <div className="screen log-screen">
      <header className="screen-header">
        <h1 className="screen-title">{editingId ? 'Edit order' : 'Log order · Order daalo'}</h1>
        <p className="screen-sub">1 tap save · galti ho to Edit/Delete</p>
      </header>

      {toast && (
        <div
          className={`toast ${toast.toLowerCase().includes('fail') || toast.toLowerCase().includes('full') || toast.toLowerCase().includes('could not') ? 'toast-error' : ''}`}
          role="status"
        >
          {toast}
        </div>
      )}

      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span className="field-label">Platform · App</span>
          <select
            value={form.platform}
            onChange={(e) => setField('platform', e.target.value)}
            className="input"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Earnings · Kamai (₹)</span>
          <input
            className={`input ${errors.earnings ? 'input-error' : ''}`}
            type="text"
            inputMode="decimal"
            placeholder="e.g. 85"
            value={form.earnings}
            onChange={(e) => setNumericField('earnings', e.target.value)}
            autoComplete="off"
          />
          {errors.earnings && <span className="field-error">{errors.earnings}</span>}
        </label>

        <label className="field">
          <span className="field-label">Distance (km)</span>
          <input
            className={`input ${errors.distance ? 'input-error' : ''}`}
            type="text"
            inputMode="decimal"
            placeholder="e.g. 3.5"
            value={form.distance}
            onChange={(e) => setNumericField('distance', e.target.value)}
            autoComplete="off"
          />
          {errors.distance && <span className="field-error">{errors.distance}</span>}
        </label>

        <div className="field">
          <span className="field-label">Time taken · Kitna time</span>
          <div className="segmented">
            <button
              type="button"
              className={timeMode === 'manual' ? 'seg active' : 'seg'}
              onClick={() => setTimeMode('manual')}
            >
              Manual min
            </button>
            <button
              type="button"
              className={timeMode === 'timer' ? 'seg active' : 'seg'}
              onClick={() => setTimeMode('timer')}
            >
              Timer
            </button>
          </div>

          {timeMode === 'manual' ? (
            <>
              <input
                className={`input ${errors.timeMinutes ? 'input-error' : ''}`}
                type="text"
                inputMode="numeric"
                placeholder="Minutes (e.g. 25)"
                value={form.timeMinutes}
                onChange={(e) => setNumericField('timeMinutes', e.target.value)}
                autoComplete="off"
              />
              {errors.timeMinutes && (
                <span className="field-error">{errors.timeMinutes}</span>
              )}
            </>
          ) : (
            <div className="timer-box">
              {timer.running ? (
                <>
                  <p className="timer-display">{formatElapsedClock(timer.startedAt)}</p>
                  <p className="muted">Background mein chal raha hai…</p>
                  <div className="ride-stats">
                    <span>
                      <strong>{roundKm1(timer.distanceKm)}</strong> km
                    </span>
                    <span>
                      <strong>{timer.pointCount || 0}</strong> GPS
                    </span>
                  </div>
                  <p className="muted">{timer.gpsMessage || 'Ride tracking in progress'}</p>
                  {timer.glitchCount > 0 && (
                    <p className="field-hint">{timer.glitchCount} GPS jump ignored</p>
                  )}
                  {timer.backgroundCount > 0 && (
                    <p className="field-hint">Background detected {timer.backgroundCount}x</p>
                  )}
                  <button type="button" className="btn btn-primary" onClick={stopRide}>
                    Stop ride
                  </button>
                </>
              ) : (
                <>
                  <p className="muted">
                    Delivery se pehle Start. Khatam pe Stop — minutes auto-fill.
                  </p>
                  {form.timeMinutes && (
                    <p className="timer-result">
                      Last fill: <strong>{form.timeMinutes} min</strong>
                    </p>
                  )}
                  <div className="btn-row">
                    <button type="button" className="btn btn-primary" onClick={startRide}>
                      Start ride
                    </button>
                    {form.timeMinutes && (
                      <button type="button" className="btn btn-ghost" onClick={resetRide}>
                        Clear
                      </button>
                    )}
                  </div>
                  {errors.timeMinutes && (
                    <span className="field-error">{errors.timeMinutes}</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <label className="field">
          <span className="field-label">
            Note <span className="optional">(optional)</span>
          </span>
          <input
            className="input"
            type="text"
            placeholder="Peak hours, baarish, etc."
            maxLength={80}
            value={form.note}
            onChange={(e) => setField('note', e.target.value)}
          />
        </label>

        <div className="btn-row">
          <button type="submit" className="btn btn-primary btn-block">
            {editingId ? 'Update order' : 'Save order · Save karo'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <section className="section">
        <h2 className="section-title">
          {isToday ? "Aaj ke orders · Today's list" : `Orders · ${selectedDate}`}
        </h2>
        {dayOrders.length === 0 ? (
          <p className="empty-hint">
            {isToday
              ? 'Pehla order upar form se save karo.'
              : 'Is din koi order nahi.'}
          </p>
        ) : (
          <ul className="order-list">
            {dayOrders.map((o) => (
              <li key={o.id} className="order-item">
                <div className="order-main">
                  <span
                    className="platform-badge"
                    style={{
                      background: PLATFORM_COLORS[o.platform] || '#94a3b8',
                      color:
                        o.platform === 'Rapido' || o.platform === 'Ola' ? '#111' : '#fff',
                    }}
                  >
                    {o.platform}
                  </span>
                  <div className="order-meta">
                    <strong>{formatINR(o.earnings)}</strong>
                    <span className="muted">
                      {o.distance} km · {o.timeMinutes} min
                    </span>
                    {o.note ? <span className="order-note">{o.note}</span> : null}
                  </div>
                </div>
                <div className="order-actions">
                  <button type="button" className="link-btn" onClick={() => startEdit(o)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="link-btn danger"
                    onClick={() => {
                      if (window.confirm('Delete this order? Pakka?')) {
                        const outcome = onDelete(o.id)
                        if (outcome?.ok === false) {
                          setToast(outcome.error || 'Delete failed')
                          return
                        }
                        if (editingId === o.id) cancelEdit()
                        setToast('Order deleted')
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
