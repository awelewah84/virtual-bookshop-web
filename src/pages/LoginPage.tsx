import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

type LocationState = {
  from?: string
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useAuth()
  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const state = location.state as LocationState | null
  const target = state?.from ?? '/admin/catalog'

  if (isAuthenticated) {
    return <Navigate to={target} replace />
  }

  return (
    <section className="panel login-panel">
      <h2>Login</h2>
      <p className="panel-note">Sign in to access protected admin endpoints.</p>

      <form
        onSubmit={async (event) => {
          event.preventDefault()
          setError('')
          setIsSubmitting(true)
          try {
            await login(staffId, password)
            navigate(target, { replace: true })
          } catch (loginError) {
            setError(loginError instanceof Error ? loginError.message : 'Login failed')
          } finally {
            setIsSubmitting(false)
          }
        }}
      >
        <label className="field">
          <span>Staff ID</span>
          <input value={staffId} onChange={(event) => setStaffId(event.target.value)} required />
          <small>{'\u00a0'}</small>
        </label>

        <label className="field">
          <span>Password or PIN</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <small>{'\u00a0'}</small>
        </label>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Login'}
        </button>
        {error && <div className="error-banner">{error}</div>}
      </form>
    </section>
  )
}
