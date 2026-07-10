import {
  aggregateOrders,
  dailyBreakdown,
  formatDisplayDate,
  formatHours,
  formatINR,
  formatINRPrecise,
  ordersInLastNDays,
  toDateKey,
} from '../lib/calculations'
import { PLATFORM_COLORS } from '../lib/constants'

export default function Weekly({ orders, settings, onLog }) {
  const last7 = ordersInLastNDays(orders, 7)
  const weekStats = aggregateOrders(last7, settings)
  const days = dailyBreakdown(orders, settings, 7)
  const daysWithData = days.filter((d) => d.orderCount > 0)
  const maxEarn = Math.max(...daysWithData.map((d) => d.totalEarnings), 0)

  // Platform ₹/hr chart — only platforms that have hours this week
  const platformBars = weekStats.platformRows
    .filter((r) => r.realPerHour != null && r.hours > 0)
    .sort((a, b) => (b.realPerHour || 0) - (a.realPerHour || 0))

  const maxPlatformRate = Math.max(...platformBars.map((r) => r.realPerHour || 0), 0)

  const firstOrderDate =
    orders.length > 0
      ? orders.reduce((min, o) => {
          const k = toDateKey(o.timestamp)
          return k < min ? k : min
        }, toDateKey(orders[0].timestamp))
      : null

  return (
    <div className="screen weekly-screen">
      <header className="screen-header">
        <h1 className="screen-title">Hafta · Last 7 days</h1>
        <p className="screen-sub">
          {weekStats.orderCount === 0
            ? 'Abhi data nahi — pehle order log karo'
            : `${weekStats.orderCount} orders · fuel ke baad`}
        </p>
      </header>

      {weekStats.orderCount === 0 ? (
        <div className="welcome-card">
          <p className="welcome-title">No week data yet</p>
          <p className="welcome-body">
            Last 7 din ke totals aur chart yahan dikhenge. Pehla order log karo.
          </p>
          {onLog && (
            <button type="button" className="btn btn-primary btn-block" onClick={onLog}>
              + Log your first order
            </button>
          )}
        </div>
      ) : (
        <>
          <section className="hero-card compact">
            <p className="hero-label">Week real kamai / hour</p>
            {weekStats.realPerHour == null ? (
              <p className="hero-value empty">Need hours on orders</p>
            ) : (
              <p className="hero-value">{formatINRPrecise(weekStats.realPerHour)}/hr</p>
            )}
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">Earnings · Kamai</span>
              <span className="stat-value">{formatINR(weekStats.totalEarnings)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Net (after fuel)</span>
              <span
                className={`stat-value ${weekStats.netEarnings >= 0 ? 'positive' : 'danger'}`}
              >
                {formatINR(weekStats.netEarnings)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Fuel spent</span>
              <span className="stat-value danger">{formatINR(weekStats.fuelCost)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Hours · Orders</span>
              <span className="stat-value">
                {formatHours(weekStats.totalMinutes)} · {weekStats.orderCount}
              </span>
            </div>
          </section>

          {/* Platform ₹/hr bar chart — prioritize which app pays better */}
          <section className="section">
            <h2 className="section-title">₹/hour by platform</h2>
            <p className="section-hint">Kaunsa app worth it? Higher bar = better real rate</p>
            {platformBars.length === 0 ? (
              <p className="empty-hint">
                Orders need time minutes to compare ₹/hr. Log time on next orders.
              </p>
            ) : (
              <div className="vbar-chart card">
                {platformBars.map((row) => {
                  const pct =
                    maxPlatformRate > 0
                      ? Math.max(8, (row.realPerHour / maxPlatformRate) * 100)
                      : 0
                  return (
                    <div key={row.platform} className="vbar-row">
                      <div className="vbar-meta">
                        <span
                          className="platform-dot"
                          style={{ background: PLATFORM_COLORS[row.platform] || '#94a3b8' }}
                        />
                        <span className="vbar-name">{row.platform}</span>
                        <span className="vbar-rate">
                          {formatINRPrecise(row.realPerHour)}/hr
                        </span>
                      </div>
                      <div className="vbar-track">
                        <div
                          className="vbar-fill"
                          style={{
                            width: `${pct}%`,
                            background: PLATFORM_COLORS[row.platform] || '#f97316',
                          }}
                          title={`${row.platform}: ${formatINRPrecise(row.realPerHour)}/hr`}
                        />
                      </div>
                      <span className="vbar-sub muted tiny">
                        {row.count} order{row.count !== 1 ? 's' : ''} · {formatINR(row.earnings)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="section">
            <h2 className="section-title">Day by day</h2>
            {daysWithData.length < 7 && firstOrderDate && (
              <p className="section-hint">
                Showing last 7 days — empty days stay blank (not broken). Tracking since{' '}
                {firstOrderDate}.
              </p>
            )}
            <ul className="day-bars">
              {days.map((d) => (
                <li key={d.dateKey} className="day-bar-row">
                  <div className="day-bar-label">
                    <span>{formatDisplayDate(d.dateKey).split(' ')[0]}</span>
                    <span className="muted tiny">{d.dateKey.slice(5)}</span>
                  </div>
                  <div className="day-bar-track">
                    {d.orderCount > 0 && maxEarn > 0 ? (
                      <div
                        className="day-bar-fill"
                        style={{
                          width: `${Math.max(4, (d.totalEarnings / maxEarn) * 100)}%`,
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="day-bar-value">
                    {d.orderCount === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <>
                        <strong>{formatINR(d.totalEarnings)}</strong>
                        <span className="muted tiny">
                          {d.realPerHour == null
                            ? ''
                            : `${formatINRPrecise(d.realPerHour)}/hr`}
                        </span>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="section">
            <h2 className="section-title">Platforms this week</h2>
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
                  {weekStats.platformRows.map((row) => (
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
          </section>
        </>
      )}
    </div>
  )
}
