import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, currentRole, loading } = useAuth()
  const location = useLocation()

  if (loading) return <main className="app-shell loading">Loading your account...</main>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (allowedRoles?.length && !allowedRoles.includes(currentRole)) {
    return (
      <main className="app-shell">
        <section className="card access-denied">
          <p className="eyebrow">Access restricted</p>
          <h1>Not authorized</h1>
          <p>Your account does not have permission to view this page.</p>
        </section>
      </main>
    )
  }
  return children
}
