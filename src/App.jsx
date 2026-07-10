import { useCallback, useEffect, useState } from 'react'
import BottomNav from './components/BottomNav'
import Home from './components/Home'
import LogOrder from './components/LogOrder'
import Weekly from './components/Weekly'
import Settings from './components/Settings'
import StorageBanner from './components/StorageBanner'
import { TABS } from './lib/constants'
import { toDateKey } from './lib/calculations'
import {
  addOrder,
  deleteOrder,
  getOrders,
  getSettings,
  saveSettings,
  updateOrder,
} from './lib/storage'

function loadState() {
  const ordersRes = getOrders()
  const settingsRes = getSettings()
  const errors = []
  if (!ordersRes.ok && ordersRes.error) errors.push(ordersRes.error)
  if (!settingsRes.ok && settingsRes.error) errors.push(settingsRes.error)
  return {
    orders: ordersRes.data || [],
    settings: settingsRes.data,
    error: errors[0] || null,
  }
}

export default function App() {
  const initial = loadState()
  const [tab, setTab] = useState(TABS.HOME)
  const [orders, setOrders] = useState(initial.orders)
  const [settings, setSettings] = useState(initial.settings)
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()))
  const [storageError, setStorageError] = useState(initial.error)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  const refresh = useCallback(() => {
    const next = loadState()
    setOrders(next.orders)
    setSettings(next.settings)
    if (next.error) setStorageError(next.error)
  }, [])

  useEffect(() => {
    const onStorage = () => refresh()
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function handleSaveOrder(data) {
    const result = addOrder(data)
    if (!result.ok) {
      setStorageError(result.error)
      return result
    }
    refresh()
    // Jump home date to today so new order is visible
    setSelectedDate(toDateKey(new Date()))
    return result
  }

  function handleUpdateOrder(id, data) {
    const result = updateOrder(id, data)
    if (!result.ok) {
      setStorageError(result.error)
      return result
    }
    refresh()
    return result
  }

  function handleDeleteOrder(id) {
    const result = deleteOrder(id)
    if (!result.ok) {
      setStorageError(result.error)
      return result
    }
    refresh()
    return result
  }

  function handleSaveSettings(next) {
    const result = saveSettings(next)
    if (!result.ok) {
      setStorageError(result.error)
      return result
    }
    setSettings(result.data)
    return result
  }

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
    setShowInstallBanner(false)
  }

  return (
    <div className="app-shell">
      <StorageBanner message={storageError} onDismiss={() => setStorageError(null)} />

      {showInstallBanner && (
        <div className="install-banner">
          <span>Install Kamai — home screen pe offline use</span>
          <div className="install-banner-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={handleInstall}>
              Install
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowInstallBanner(false)}
            >
              Later
            </button>
          </div>
        </div>
      )}

      <main className="main-content">
        {tab === TABS.HOME && (
          <Home
            orders={orders}
            settings={settings}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onLog={() => setTab(TABS.LOG)}
          />
        )}
        {tab === TABS.LOG && (
          <LogOrder
            orders={orders}
            selectedDate={selectedDate}
            onSave={handleSaveOrder}
            onUpdate={handleUpdateOrder}
            onDelete={handleDeleteOrder}
          />
        )}
        {tab === TABS.WEEKLY && (
          <Weekly orders={orders} settings={settings} onLog={() => setTab(TABS.LOG)} />
        )}
        {tab === TABS.SETTINGS && (
          <Settings
            settings={settings}
            onSave={handleSaveSettings}
            orderCount={orders.length}
            onDataChanged={refresh}
            onError={setStorageError}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
