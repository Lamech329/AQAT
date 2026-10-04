import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getApiConfig } from '../api/checklistApi'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isSupabaseMode = getApiConfig().mode === 'supabase'
  const [portal, setPortal] = useState('staff')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (portal !== 'staff') throw new Error('Admin accounts cannot be created through sign-up.')
        const result = await signUp(email, password)
        if (result.requiresEmailConfirmation) {
          setError('Account created. Check your email to confirm your account, then sign in.')
          setMode('login')
          return
        }
      } else {
        await login(email, password, portal)
      }
      const defaultPath = portal === 'admin' ? '/admin' : '/staff'
      const returnPath = location.state?.from
      navigate(returnPath?.startsWith(`${defaultPath}/`) || returnPath === defaultPath ? returnPath : defaultPath, { replace: true })
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
        <div className="portal-selector" role="tablist" aria-label="Choose sign-in portal">
          {['staff', 'admin'].map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={portal === option}
              className={portal === option ? 'portal-tab active' : 'portal-tab'}
              onClick={() => {
                setPortal(option)
                setMode('login')
                setError('')
              }}
            >
              {option === 'staff' ? 'Staff' : 'Admin'}
            </button>
          ))}
        </div>
        {mode === 'signup' && <p className="required-note">New accounts are always created as Staff. Admin access must be granted by an administrator.</p>}
        {!isSupabaseMode && portal === 'admin' && <p className="required-note">Admin sign-in requires Supabase authentication. Local mode is staff-only.</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength="6" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>
          {error && <p className="connection-feedback error">{error}</p>}
          <button className="submit-button" type="submit" disabled={busy || (!isSupabaseMode && portal === 'admin')}>{busy ? (mode === 'signup' ? 'Creating account...' : 'Signing in...') : (mode === 'signup' ? 'Create account' : `Sign in as ${portal === 'staff' ? 'Staff' : 'Admin'}`)}</button>
        </form>
        {portal === 'staff' && <button className="auth-switch" type="button" onClick={() => { setMode((current) => current === 'login' ? 'signup' : 'login'); setError('') }}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </button>}
      </section>
    </main>
  )
}
