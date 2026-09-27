import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getApiConfig } from '../api/checklistApi'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isSupabaseMode = getApiConfig().mode === 'supabase'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const result = await signUp(email, password)
        if (result.requiresEmailConfirmation) {
          setError('Account created. Check your email to confirm your account, then sign in.')
          setMode('login')
          return
        }
      } else {
        await login(email, password, role)
      }
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (authError) {
      setError(authError.message ?? `Unable to ${mode === 'signup' ? 'create your account' : 'sign in'}.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app-shell auth-shell">
      <section className="card auth-card">
        <div className="brand-mark">AQAT</div>
        <p className="eyebrow">Subject File Checklist</p>
        <h1>{mode === 'signup' ? 'Create an account' : 'Sign in'}</h1>
        <p className="auth-copy">{isSupabaseMode ? 'Use your Supabase account to continue.' : 'Local mode is active. Use any email and password to test the app offline.'}</p>
        {mode === 'signup' && <p className="required-note">New accounts start as standard users. An administrator must grant Admin or Super Admin access.</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength="6" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
          {mode === 'login' && !isSupabaseMode && (
            <label>Role
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </label>
          )}
          {error && <p className="connection-feedback error">{error}</p>}
          <button className="submit-button" type="submit" disabled={busy}>{busy ? (mode === 'signup' ? 'Creating account...' : 'Signing in...') : (mode === 'signup' ? 'Create account' : 'Sign in')}</button>
        </form>
        <button className="auth-switch" type="button" onClick={() => { setMode((current) => current === 'login' ? 'signup' : 'login'); setError('') }}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>
      </section>
    </main>
  )
}
