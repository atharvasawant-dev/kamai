import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { estimateFuelCost } from '../lib/calculations'
import { validateSettingsForm } from '../lib/validation'
import {
  downloadExport,
  importFromJson,
  resetAllData,
} from '../lib/storage'

export default function Settings({
  settings,
  onSave,
  orderCount,
  onDataChanged,
  onError,
}) {
  const [form, setForm] = useState(settings)
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    setForm(settings)
  }, [settings])

  function handleSubmit(e) {
    e.preventDefault()
    const result = validateSettingsForm(form)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    const outcome = onSave({
      mileageKmPerLitre: result.values.mileageKmPerLitre,
      petrolPricePerLitre: result.values.petrolPricePerLitre,
      currency: 'INR',
    })
    if (outcome?.ok === false) {
      onError?.(outcome.error)
      setMessage(outcome.error)
      return
    }
    setSaved(true)
    setMessage('Settings saved ✓')
    setTimeout(() => {
      setSaved(false)
      setMessage('')
    }, 2000)
  }

  function handleExport() {
    const result = downloadExport()
    if (!result.ok) {
      onError?.(result.error)
      setMessage(result.error)
      return
    }
    setMessage('Backup downloaded · JSON file saved')
    setTimeout(() => setMessage(''), 2500)
  }

  function handleImportClick() {
    fileRef.current?.click()
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      if (
        !window.confirm(
          `Import "${file.name}"?\n\nThis REPLACES all current orders on this phone. Export first if unsure.`
        )
      ) {
        return
      }
      const result = importFromJson(text)
      if (!result.ok) {
        onError?.(result.error)
        setMessage(result.error)
        return
      }
      onDataChanged?.()
      setMessage(
        `Restored ${result.data.orderCount} orders${
          result.data.settingsUpdated ? ' + settings' : ''
        }${result.data.skippedCount ? ` · ${result.data.skippedCount} skipped` : ''} ✓`
      )
      setTimeout(() => setMessage(''), 3000)
    }
    reader.onerror = () => {
      setMessage('Could not read that file')
    }
    reader.readAsText(file)
  }

  function handleReset() {
    const sure = window.confirm(
      'Reset ALL data?\n\nOrders, settings, timer — sab delete ho jayega. Is phone pe wapas nahi aayega unless you have a JSON export.\n\nAre you sure?'
    )
    if (!sure) return
    const double = window.confirm('Last chance — delete everything?')
    if (!double) return

    const result = resetAllData()
    if (!result.ok) {
      onError?.(result.error)
      setMessage(result.error)
      return
    }
    onDataChanged?.()
    setForm({ ...DEFAULT_SETTINGS })
    setMessage('All data cleared')
    setTimeout(() => setMessage(''), 2500)
  }

  const sampleFuel = estimateFuelCost(10, {
    mileageKmPerLitre: Number(form.mileageKmPerLitre) || DEFAULT_SETTINGS.mileageKmPerLitre,
    petrolPricePerLitre:
      Number(form.petrolPricePerLitre) || DEFAULT_SETTINGS.petrolPricePerLitre,
  })

  return (
    <div className="screen settings-screen">
      <header className="screen-header">
        <h1 className="screen-title">Settings · Settings</h1>
        <p className="screen-sub">Fuel maths + backup</p>
      </header>

      {message && (
        <div
          className={`toast ${
            message.toLowerCase().includes('fail') ||
            message.toLowerCase().includes('could not') ||
            message.toLowerCase().includes('invalid')
              ? 'toast-error'
              : ''
          }`}
          role="status"
        >
          {message}
        </div>
      )}

      <form className="card form-card" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Bike mileage (km / litre)</span>
          <input
            className={`input ${errors.mileageKmPerLitre ? 'input-error' : ''}`}
            type="text"
            inputMode="decimal"
            value={form.mileageKmPerLitre}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, '')
              setForm((f) => ({ ...f, mileageKmPerLitre: v }))
              setErrors((er) => ({ ...er, mileageKmPerLitre: undefined }))
            }}
          />
          {errors.mileageKmPerLitre && (
            <span className="field-error">{errors.mileageKmPerLitre}</span>
          )}
          <span className="field-hint">Default 40 · typical scooter 35–45 km/l</span>
        </label>

        <label className="field">
          <span className="field-label">Petrol price (₹ / litre)</span>
          <input
            className={`input ${errors.petrolPricePerLitre ? 'input-error' : ''}`}
            type="text"
            inputMode="decimal"
            value={form.petrolPricePerLitre}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, '')
              setForm((f) => ({ ...f, petrolPricePerLitre: v }))
              setErrors((er) => ({ ...er, petrolPricePerLitre: undefined }))
            }}
          />
          {errors.petrolPricePerLitre && (
            <span className="field-error">{errors.petrolPricePerLitre}</span>
          )}
          <span className="field-hint">Default ₹105 · local rate badlo yahan</span>
        </label>

        <div className="info-box">
          <p>
            Example: 10 km ≈ <strong>₹{sampleFuel.toFixed(1)}</strong> petrol
          </p>
          <p className="muted tiny">(distance ÷ mileage) × petrol price</p>
        </div>

        <button type="submit" className="btn btn-primary btn-block">
          {saved ? 'Saved ✓' : 'Save settings'}
        </button>
      </form>

      <section className="card info-card">
        <h2 className="section-title">Backup · Data bachao</h2>
        <p className="muted">
          Sab localStorage pe hai. Browser clear / naya phone = data gayab.
          JSON export hi backup hai.
        </p>
        <p className="muted tiny">Orders on this phone: {orderCount}</p>
        <div className="btn-stack">
          <button type="button" className="btn btn-primary btn-block" onClick={handleExport}>
            Export data (JSON)
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={handleImportClick}>
            Import data
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={handleImportFile}
          />
        </div>
      </section>

      <section className="card info-card danger-zone">
        <h2 className="section-title">Danger zone</h2>
        <p className="muted">
          Reset sab delete karega. Pehle Export zaroor karo.
        </p>
        <button type="button" className="btn btn-danger btn-block" onClick={handleReset}>
          Reset all data
        </button>
      </section>

      <section className="card info-card">
        <h2 className="section-title">Install on home screen</h2>
        <ol className="install-steps">
          <li>Open Kamai in <strong>Chrome</strong> on Android</li>
          <li>Tap the <strong>⋮</strong> menu</li>
          <li>
            Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>
          </li>
          <li>Confirm — full-screen, offline-ready</li>
        </ol>
      </section>
    </div>
  )
}
