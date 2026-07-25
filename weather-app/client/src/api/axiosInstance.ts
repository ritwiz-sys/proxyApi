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
// axiosInstance.ts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // token expired → clear and redirect to login
      localStorage.removeItem('weather_auth_token')
      window.location.reload()
    }
    throw error
  }
)

export default api
