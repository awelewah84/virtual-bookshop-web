import { NavLink, Outlet } from 'react-router-dom'
import { API_BASE_URL } from '../lib/env'
import { useAuth } from '../hooks/useAuth'

const publicNavItems = [
  { to: '/', label: 'Book Collection', end: true },
]

const adminNavItems = [
  { to: '/admin/catalog', label: 'Admin Catalog' },
  { to: '/admin/reservations', label: 'Orders' },
  { to: '/admin/stock', label: 'Admin Stock' },
  { to: '/admin/reconciliation', label: 'Reconciliation' },
  { to: '/admin/staff-users', label: 'Staff Users' },
]

export function AppLayout() {
  const { isAuthenticated, logout } = useAuth()

  return (
    <div className="page-shell">
      <header className="hero-banner">
        <div className="hero-corner-action">
          {isAuthenticated ? (
            <button type="button" className="ghost nav-auth-btn" onClick={logout}>
              Logout
            </button>
          ) : (
            <NavLink className="button-link nav-auth-btn" to="/login">
              Staff Login
            </NavLink>
          )}
        </div>

        <p className="eyebrow">DC UK</p>
        <h1>Apostolic Service Virtual Bookstore</h1>
        <p className="hero-copy">
          Make your bookings here and reduce the waiting time for collection.
        </p>

        <div className="main-nav-row">
          <nav className="main-nav" aria-label="Primary">
            {publicNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-pill${isActive ? ' active' : ''}`}
                end={item.end === true}
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
                >
                  {item.label}
                </NavLink>
              ))}
            {isAuthenticated && (
              <a className="nav-pill" href={`${API_BASE_URL}/api-docs/`} target="_blank" rel="noreferrer">
                Open API Docs
              </a>
            )}
          </nav>
        </div>
      </header>

      <main className="route-content">
        <Outlet />
      </main>
    </div>
  )
}
