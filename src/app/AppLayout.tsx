import { NavLink, Outlet } from 'react-router-dom'
import { API_BASE_URL } from '../lib/env'
import { useAuth } from '../hooks/useAuth'

const publicNavItems = [
  { to: '/', label: 'Overview' },
  { to: '/catalog', label: 'Browse Books' },
  { to: '/reserve', label: 'Reserve a Book' },
]

const adminNavItems = [
  { to: '/admin/catalog', label: 'Admin Catalog' },
  { to: '/admin/reservations', label: 'Reservations' },
  { to: '/admin/stock', label: 'Admin Stock' },
  { to: '/admin/reconciliation', label: 'Reconciliation' },
  { to: '/admin/staff-users', label: 'Staff Users' },
]

export function AppLayout() {
  const { isAuthenticated, logout } = useAuth()

  return (
    <div className="page-shell">
      <header className="hero-banner">
        <p className="eyebrow">DC UK</p>
        <h1>DC UK Virtual Bookstore</h1>
        <p className="hero-copy">
          Make your booking here and reduce the waiting time when it is time to collect.
        </p>

        <div className="hero-actions">
          <a href={`${API_BASE_URL}/api-docs/`} target="_blank" rel="noreferrer">
            Open API Docs
          </a>
          {isAuthenticated ? (
            <button type="button" className="ghost" onClick={logout}>
              Logout
            </button>
          ) : (
            <NavLink className="button-link" to="/login">
              Staff Login
            </NavLink>
          )}
        </div>

        <nav className="main-nav" aria-label="Primary">
          {publicNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-pill${isActive ? ' active' : ''}`}
              end={item.to === '/'}
            >
              {item.label}
            </NavLink>
          ))}
          {isAuthenticated &&
            adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-pill${isActive ? ' active' : ''}`}
                end={item.to === '/'}
              >
                {item.label}
              </NavLink>
            ))}
        </nav>
      </header>

      <main className="route-content">
        <Outlet />
      </main>
    </div>
  )
}
