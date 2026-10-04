import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function DashboardTabs() {
  const { currentRole } = useAuth()
  return (
    <nav className="dashboard-tabs" aria-label="Dashboard navigation">
      {currentRole === 'staff' && <NavLink to="/staff" className={({ isActive }) => isActive ? 'dashboard-tab active' : 'dashboard-tab'}>Staff</NavLink>}
      {currentRole === 'admin' && <NavLink to="/admin" className={({ isActive }) => isActive ? 'dashboard-tab active' : 'dashboard-tab'}>Admin</NavLink>}
    </nav>
  )
}
