import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function UserMenu() {
  const { currentUser, currentRole, logout } = useAuth()

  return (
    <div className="user-menu">
      {!currentUser && <Link className="secondary-button" to="/login">Sign in</Link>}
      {currentUser && <span className="user-role">{currentUser.email} ({currentRole})</span>}
      {currentUser && <button className="secondary-button" type="button" onClick={logout}>Sign out</button>}
    </div>
  )
}
