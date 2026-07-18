import axios, { type AxiosError } from 'axios'

export const AUTH_TOKEN_KEY = 'weather_auth_token'

const api = axios.create({
  baseURL: '/',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor — attach the JWT, if one is stored, to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 429) {
      throw new Error('Too many requests — slow down!')
    }
    if (error.response?.status === 403) {
      throw new Error('Access denied')
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out')
    }
    throw error
  }
)

export default api
