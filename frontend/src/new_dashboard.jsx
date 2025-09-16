// src/pages/Dashboard.jsx
import React from 'react'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const [dark, setDark] = React.useState(false)

  React.useEffect(() => {
    const root = document.documentElement
    if (dark) root.classList.add(styles.darkRoot)
    else root.classList.remove(styles.darkRoot)
  }, [dark])

  const kpis = [
    { label: 'Revenue', value: '$128.4k', delta: '+6.2%' },
    { label: 'Active Users', value: '24,531', delta: '+2.1%' },
    { label: 'Conversion', value: '3.84%', delta: '-0.3%' },
    { label: 'Global Reach', value: '62 countries', delta: '+1' },
  ]

  const table = [
    { id: 1, name: 'Aurora', status: 'Active', mrr: 18200, growth: 6.2 },
    { id: 2, name: 'Nimbus', status: 'Active', mrr: 12900, growth: 3.4 },
    { id: 3, name: 'Zenith', status: 'Paused', mrr: 4200, growth: -1.8 },
    { id: 4, name: 'Pulse', status: 'Active', mrr: 15300, growth: 4.1 },
  ]

  return (
    <div className={styles.app}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>🟦</div>
          <div className={styles.brandText}>App Studio</div>
        </div>
        <nav className={styles.nav}>
          <button className={`${styles.navItem} ${styles.navActive}`}>Overview</button>
          <button className={styles.navItem}>Analytics</button>
          <button className={styles.navItem}>Customers</button>
          <button className={styles.navItem}>Automation</button>
          <button className={styles.navItem}>Settings</button>
        </nav>
        <div className={styles.shortcuts}>
          <div className={styles.shortcutTitle}>Shortcuts</div>
          <div className={styles.badgeRow}>
            <span className={styles.badge}>Create Report</span>
            <span className={styles.badge}>Invite Team</span>
            <span className={styles.badge}>Upload CSV</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.hLeft}>
            <div className={styles.hLogo}>📈</div>
            <div>
              <div className={styles.hTitle}>Your Dashboard</div>
              <div className={styles.hSubtitle}>Operational overview & quick actions</div>
            </div>
          </div>

          <div className={styles.hSearchRow}>
            <div className={styles.searchWrap}>
              <input className={styles.search} placeholder="Search projects, people, metrics…" />
            </div>
            <button className={styles.btnOutline}>Filters</button>
            <button className={styles.btnPrimary}>Export</button>
          </div>

          <div className={styles.hRight}>
            <button className={styles.btnOutline} onClick={() => setDark(v => !v)}>
              {dark ? 'Light' : 'Dark'}
            </button>
            <button className={styles.iconBtn} title="Notifications">
              🔔<span className={styles.pill}>3</span>
            </button>
            <div className={styles.userChip}>
              <div className={styles.avatar}>JG</div>
              <div>
                <div className={styles.userName}>J. Q. Gui</div>
                <div className={styles.userRole}>Admin</div>
              </div>
            </div>
          </div>
        </header>

        <main className={styles.content}>
          {/* KPI cards */}
          <section className={styles.kpiGrid}>
            {kpis.map(k => (
              <div key={k.label} className={styles.card}>
                <div className={styles.cardRow}>
                  <div>
                    <div className={styles.kpiLabel}>{k.label}</div>
                    <div className={styles.kpiValue}>{k.value}</div>
                  </div>
                  <span className={`${styles.delta} ${k.delta.startsWith('-') ? styles.deltaDown : styles.deltaUp}`}>
                    {k.delta}
                  </span>
                </div>
              </div>
            ))}
          </section>

          {/* Chart placeholders (simple, no libs) */}
          <section className={styles.chartGrid}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Monthly Trend</div>
              <div className={styles.chartPlaceholder}>[ chart goes here ]</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Weekly Volume</div>
              <div className={styles.chartPlaceholder}>[ chart goes here ]</div>
            </div>
          </section>

          {/* Table */}
          <section className={styles.card}>
            <div className={styles.tableHeader}>
              <div className={styles.cardTitle}>Projects</div>
              <div className={styles.tableActions}>
                <div className={styles.tabs}>
                  <button className={`${styles.tab} ${styles.tabActive}`}>All</button>
                  <button className={styles.tab}>Active</button>
                  <button className={styles.tab}>Paused</button>
                </div>
                <button className={styles.btnOutline}>Filter</button>
                <button className={styles.btnPrimary}>New Project</button>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>MRR</th>
                    <th>Growth</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {table.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div className={styles.projectCell}>
                          <div className={styles.projectIcon}>⚙️</div>
                          <div>
                            <div className={styles.projectName}>{r.name}</div>
                            <div className={styles.projectSub}>ID #{String(r.id).padStart(4, '0')}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.status} ${r.status === 'Active' ? styles.stOk : styles.stWarn}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>${r.mrr.toLocaleString()}</td>
                      <td className={r.growth >= 0 ? styles.gUp : styles.gDown}>
                        {r.growth >= 0 ? '+' : ''}{r.growth}%
                      </td>
                      <td className={styles.tdRight}>
                        <button className={styles.btnGhost}>Actions ▾</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {/* Right panel */}
      <aside className={styles.right}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Recent Activity</div>
          <div className={styles.activityList}>
            <div className={styles.activityItem}><span className={styles.dot} /> Deployed v1.2.3 <span className={styles.time}>· 2h ago</span></div>
            <div className={styles.activityItem}><span className={styles.dot} /> New enterprise signup: Acme Inc. <span className={styles.time}>· 4h ago</span></div>
            <div className={styles.activityItem}><span className={styles.dot} /> Payment received: $3,200 <span className={styles.time}>· Yesterday</span></div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Notifications</div>
          <div className={styles.toggleRow}><span>Weekly summary</span><input type="checkbox" defaultChecked /></div>
          <div className={styles.toggleRow}><span>Product updates</span><input type="checkbox" /></div>
          <div className={styles.toggleRow}><span>Billing alerts</span><input type="checkbox" defaultChecked /></div>
        </div>
      </aside>
    </div>
  )
}