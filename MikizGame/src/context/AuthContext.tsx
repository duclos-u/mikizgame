import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, type User } from '../api/client'
import { STORAGE_KEYS } from '../constants/storage'

type AuthState = {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  updateAuth: (user: User, token?: string) => void
}

const AuthContext = createContext<AuthState | null>(null)

const TOKEN_KEY = STORAGE_KEYS.AUTH_TOKEN

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(!!localStorage.getItem(TOKEN_KEY))

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    api.auth
      .me()
      .then(({ user }) => setUser(user))
      .catch((err: unknown) => {
        // Only clear token on explicit auth rejection (401), not transient network errors
        if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Invalid or expired token')) {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
      })
      .finally(() => setLoading(false))
  }, [token])

  const login = useCallback(async (email: string, password: string) => {
    const { user, token } = await api.auth.login(email, password)
    localStorage.setItem(TOKEN_KEY, token)
    setToken(token)
    setUser(user)
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    const { user, token } = await api.auth.register(username, email, password)
    localStorage.setItem(TOKEN_KEY, token)
    setToken(token)
    setUser(user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const updateAuth = useCallback((user: User, token?: string) => {
    setUser(user)
    if (token) {
      localStorage.setItem(TOKEN_KEY, token)
      setToken(token)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
