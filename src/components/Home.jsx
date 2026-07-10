import {
  addDays,
  aggregateOrders,
  formatDisplayDate,
  formatHours,
  formatINR,
  formatINRPrecise,
  ordersForDate,
  toDateKey,
} from '../lib/calculations'
import { PLATFORM_COLORS } from '../lib/constants'

export default function Home({ orders, settings, selectedDate, onDateChange, onLog }) {
  const today = toDateKey(new Date())
  const dayOrders = ordersForDate(orders, selectedDate)
  const stats = aggregateOrders(dayOrders, settings)
  const isToday = selectedDate === today
  const canGoNext = selectedDate < today
  const isFirstOpen = orders.length === 0

  return (
    <div className="screen home-screen">
      <header className="screen-header">
        <p className="brand-tag">Kamai</p>
        <div className="date-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label="Previous day"
            onClick={() => onDateChange(addDays(selectedDate, -1))}
          >
            ‹
          </button>
          <div className="date-label">
            <span className="date-main">{formatDisplayDate(selectedDate)}</span>
            <span className="date-sub">{selectedDate}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Next day"
            disabled={!canGoNext}
            onClick={() => canGoNext && onDateChange(addDays(selectedDate, 1))}
          >
            ›
          </button>
        </div>
      </header>

      {isFirstOpen && isToday && (
        <div className="welcome-card">
          <p className="welcome-title">Namaste 👋</p>
          <p className="welcome-body">
            Track true kamai after fuel across Zomato, Swiggy, Uber, Rapido & Ola.
            Sab data is phone pe rehta hai.
          </p>
          <button type="button" className="btn btn-primary btn-block" onClick={onLog}>
            + Log your first order
          </button>
        </div>
      )}

      <section className="hero-card" aria-live="polite">
        <p className="hero-label">
          {isToday ? 'Aaj ka real kamai / hour' : 'Real kamai / hour'}
        </p>
        {stats.realPerHour == null ? (
          <div className="hero-empty">
            <p className="hero-value empty">
              {isToday ? 'Log your first order' : 'No orders this day'}
            </p>
            {isToday && !isFirstOpen && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onLog}>
                + Log order
              </button>
            )}
          </div>
        ) : (
          <p className="hero-value">{formatINRPrecise(stats.realPerHour)}/hr</p>
        )}
        <p className="hero-hint">Fuel ke baad · saari apps milake</p>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Aaj ki kamai · Earnings</span>
          <span className="stat-value">{formatINR(stats.totalEarnings)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Distance</span>
          <span className="stat-value">{stats.totalDistance.toFixed(1)} km</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Petrol cost · Anuman</span>
          <span className="stat-value danger">{formatINR(stats.fuelCost)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Hours worked</span>
          <span className="stat-value">{formatHours(stats.totalMinutes)}</span>
        </div>
      </section>

      {(stats.orderCount > 0 || stats.netEarnings !== 0) && (
        <p className="net-line">
          Net after fuel:{' '}
          <strong className={stats.netEarnings >= 0 ? 'positive' : 'danger'}>
            {formatINR(stats.netEarnings)}
          </strong>
          <span className="muted">
            {' '}
            · {stats.orderCount} order{stats.orderCount !== 1 ? 's' : ''}
          </span>
        </p>
      )}

      <section className="section">
        <h2 className="section-title">Per platform · Har app</h2>
        {stats.platformRows.length === 0 ? (
          <p className="empty-hint">
            {isToday
              ? 'Abhi koi order nahi. + Log Order dabao.'
              : 'Is din koi order nahi.'}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>App</th>
                  <th>#</th>
                  <th>Earn</th>
                  <th>₹/hr</th>
                </tr>
              </thead>
              <tbody>
                {stats.platformRows.map((row) => (
                  <tr key={row.platform}>
                    <td>
                      <span
                        className="platform-dot"
                        style={{ background: PLATFORM_COLORS[row.platform] || '#94a3b8' }}
                      />
                      {row.platform}
                    </td>
                    <td>{row.count}</td>
                    <td>{formatINR(row.earnings)}</td>
                    <td>
                      {row.realPerHour == null ? '—' : formatINRPrecise(row.realPerHour)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
