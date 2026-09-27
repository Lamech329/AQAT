import { NavLink } from 'react-router-dom'

export function DashboardTabs() {
  return (
    <nav className="dashboard-tabs" aria-label="Dashboard navigation">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'dashboard-tab active' : 'dashboard-tab'}>
        Checklists
      </NavLink>
      <NavLink to="/admin" className={({ isActive }) => isActive ? 'dashboard-tab active' : 'dashboard-tab'}>
        Admin
      </NavLink>
      <NavLink to="/super-admin" className={({ isActive }) => isActive ? 'dashboard-tab active' : 'dashboard-tab'}>
        Super Admin
      </NavLink>
    </nav>
  )
}
