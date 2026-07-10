import { TABS } from '../lib/constants'

const items = [
  { id: TABS.HOME, label: 'Home', icon: '🏠' },
  { id: TABS.LOG, label: 'Log Order', icon: '+' },
  { id: TABS.WEEKLY, label: 'Weekly', icon: '📊' },
  { id: TABS.SETTINGS, label: 'Settings', icon: '⚙️' },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main">
      {items.map((item) => {
        const isLog = item.id === TABS.LOG
        return (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${active === item.id ? 'active' : ''} ${isLog ? 'nav-log' : ''}`}
            onClick={() => onChange(item.id)}
            aria-current={active === item.id ? 'page' : undefined}
            aria-label={item.label}
          >
            <span className="nav-icon" aria-hidden="true">
              {isLog ? <span className="fab-plus">+</span> : item.icon}
            </span>
            <span className="nav-label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
