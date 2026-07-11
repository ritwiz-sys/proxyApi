import axios, { type AxiosError } from 'axios'

const api = axios.create({
  baseURL: '/',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
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
