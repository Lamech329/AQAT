import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getApiConfig } from '../api/checklistApi'
import { supabase } from '../utils/supabase/client'

const LOCAL_AUTH_KEY = 'aqat-auth-user'
const DEFAULT_ROLE = 'user'
const VALID_ROLES = ['user', 'admin', 'super_admin']

const AuthContext = createContext(null)

const normalizeRole = (role) => VALID_ROLES.includes(role) ? role : DEFAULT_ROLE

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const isSupabaseMode = getApiConfig().mode === 'supabase'

  useEffect(() => {
    let mounted = true

    const loadUser = async () => {
      if (!isSupabaseMode) {
        const savedUser = localStorage.getItem(LOCAL_AUTH_KEY)
        if (mounted && savedUser) setCurrentUser(JSON.parse(savedUser))
        if (mounted) setLoading(false)
        return
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (sessionData.session?.user) {
        const user = await userWithRole(sessionData.session.user)
        if (mounted) setCurrentUser(user)
      }
      if (mounted) setLoading(false)
    }

    loadUser().catch((error) => {
      console.error('Unable to restore authentication session.', error)
      if (mounted) setLoading(false)
    })

    if (!isSupabaseMode) return () => { mounted = false }

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      setCurrentUser(session?.user ? await userWithRole(session.user) : null)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [isSupabaseMode])

  const login = async (email, password, role = DEFAULT_ROLE) => {
    if (isSupabaseMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const user = await userWithRole(data.user)
      setCurrentUser(user)
      return user
    }

    const user = { id: `local-${Date.now()}`, email, role: normalizeRole(role) }
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
