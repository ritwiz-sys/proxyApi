import { useEffect, useState } from 'react'
import axios from 'axios'
import api, { AUTH_TOKEN_KEY } from '../api/axiosInstance.ts'
import type { AuthUser } from '../types.ts'

interface AuthResponse {
  token: string
  user: AuthUser
}

const extractErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined
    if (data?.error) return data.error
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong'
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)

    if (!storedToken) {
      setIsLoading(false)
      return
    }

    api
      .get<AuthUser>('/api/auth/me')
      .then(({ data }) => {
        setToken(storedToken)
        setUser(data)
      })
      .catch(() => {
        localStorage.removeItem(AUTH_TOKEN_KEY)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const signup = async (email: string, username: string, password: string) => {
    try {
      const { data } = await api.post<AuthResponse>('/api/auth/signup', {
        email,
        username,
        password,
      })
      localStorage.setItem(AUTH_TOKEN_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
    } catch (error) {
      throw new Error(extractErrorMessage(error), { cause: error })
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post<AuthResponse>('/api/auth/login', { email, password })
      localStorage.setItem(AUTH_TOKEN_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
    } catch (error) {
      throw new Error(extractErrorMessage(error), { cause: error })
    }
  }

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return {
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(user && token),
    signup,
    login,
    logout,
  }
}
