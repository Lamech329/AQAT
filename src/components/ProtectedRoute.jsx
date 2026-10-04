import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { dashboardPath, hasRoleAccess } from '../auth/roles'

export function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, currentRole, loading } = useAuth()
  const location = useLocation()

  if (loading) return <main className="app-shell loading">Loading your account...</main>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (allowedRoles?.length && !hasRoleAccess(currentRole, allowedRoles)) {
    return <Navigate to={dashboardPath(currentRole)} replace />
  }
  return children
}
