import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getApiConfig } from '../api/checklistApi'
import { supabase } from '../utils/supabase/client'
import { normalizeRole, portalMismatchMessage } from '../auth/roles'

const LOCAL_AUTH_KEY = 'aqat-auth-user'
const DEFAULT_ROLE = 'staff'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const isSupabaseMode = getApiConfig().mode === 'supabase'

  useEffect(() => {
    let mounted = true
    let authRevision = 0

    const loadUser = async () => {
      if (!isSupabaseMode) {
        const savedUser = localStorage.getItem(LOCAL_AUTH_KEY)
        if (mounted && savedUser) {
          const { id, email } = JSON.parse(savedUser)
          setCurrentUser({ id, email, role: DEFAULT_ROLE })
        }
        if (mounted) setLoading(false)
        return
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (sessionData.session?.user) {
        const user = await userWithRole(sessionData.session.user)
        if (mounted && authRevision === 0) setCurrentUser(user)
      }
      if (mounted) setLoading(false)
    }

    loadUser().catch((error) => {
      console.error('Unable to restore authentication session.', error)
      if (mounted) setLoading(false)
    })

    if (!isSupabaseMode) return () => { mounted = false }

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const revision = ++authRevision
      if (!mounted) return
      if (!session?.user) {
        setCurrentUser(null)
        return
      }
      try {
        const user = await userWithRole(session.user)
        if (mounted && revision === authRevision) setCurrentUser(user)
      } catch (error) {
        console.error('Unable to load the authenticated profile.', error)
        if (mounted && revision === authRevision) setCurrentUser(null)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [isSupabaseMode])

  const login = async (email, password, portal = DEFAULT_ROLE) => {
    if (isSupabaseMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const user = await userWithRole(data.user)
      const mismatch = portalMismatchMessage(portal, user.role)
      if (mismatch) {
        const { error: signOutError } = await supabase.auth.signOut()
        setCurrentUser(null)
        if (signOutError) throw new Error(`${mismatch} Sign-out failed: ${signOutError.message}`)
        throw new Error(mismatch)
      }
      setCurrentUser(user)
      return user
    }

    if (portal === 'admin') throw new Error('Admin sign-in requires Supabase authentication.')
    const user = { id: `local-${Date.now()}`, email, role: DEFAULT_ROLE }
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(user))
    setCurrentUser(user)
    return user
  }

  const signUp = async (email, password) => {
    if (isSupabaseMode) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      if (data.user && data.session) {
        const user = await userWithRole(data.user)
        if (user.role !== DEFAULT_ROLE) {
          const { error: signOutError } = await supabase.auth.signOut()
          if (signOutError) throw signOutError
          throw new Error('New accounts must be assigned the staff role.')
        }
        setCurrentUser(user)
        return { user, requiresEmailConfirmation: false }
      }
      return { user: null, requiresEmailConfirmation: true }
    }

    const user = { id: `local-${Date.now()}`, email, role: DEFAULT_ROLE }
    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(user))
    setCurrentUser(user)
    return { user, requiresEmailConfirmation: false }
  }

  const logout = async () => {
    if (isSupabaseMode) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setCurrentUser(null)
    } else {
      localStorage.removeItem(LOCAL_AUTH_KEY)
      setCurrentUser(null)
    }
  }

  const value = useMemo(() => ({
    currentUser,
    currentRole: currentUser?.role ?? null,
    login,
    signUp,
    logout,
    isAuthenticated: Boolean(currentUser),
    loading,
  }), [currentUser, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

async function userWithRole(user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  return { id: user.id, email: user.email, role: normalizeRole(data?.role) }
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.')
  return context
}
