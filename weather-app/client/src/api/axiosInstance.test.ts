import { describe, it, expect, vi, beforeEach } from 'vitest'

interface FakeAxiosError {
  response?: { status: number }
  code?: string
}

interface FakeRequestConfig {
  headers: Record<string, string>
}

type ErrorHandler = (error: FakeAxiosError | Error) => unknown
type RequestHandler = (config: FakeRequestConfig) => FakeRequestConfig

let errorHandler: ErrorHandler = () => undefined
let requestHandler: RequestHandler = (config) => config

vi.mock('axios', () => {
  const instance = {
    interceptors: {
      request: {
        use: vi.fn((onFulfilled: RequestHandler) => {
          requestHandler = onFulfilled
        }),
      },
      response: {
        use: vi.fn((_onSuccess: unknown, onError: ErrorHandler) => {
          errorHandler = onError
        }),
      },
    },
  }
  return {
    default: {
      create: vi.fn(() => instance),
    },
  }
})

describe('axiosInstance error interceptor', () => {
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    await import('./axiosInstance.ts')
  })

  it('converts a 429 response into a rate limit message', () => {
    expect(() => errorHandler({ response: { status: 429 } })).toThrowError(
      'Too many requests — slow down!'
    )
  })

  it('converts a 403 response into an access denied message', () => {
    expect(() => errorHandler({ response: { status: 403 } })).toThrowError(
      'Access denied'
    )
  })

  it('converts a connection timeout into a timeout message', () => {
    expect(() => errorHandler({ code: 'ECONNABORTED' })).toThrowError(
      'Request timed out'
    )
  })

  it('rethrows unrecognized errors unchanged', () => {
    const original = new Error('boom')
    expect(() => errorHandler(original)).toThrow(original)
  })
})

describe('axiosInstance request interceptor', () => {
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    await import('./axiosInstance.ts')
  })

  it('attaches the stored JWT as a Bearer token', () => {
    localStorage.setItem('weather_auth_token', 'abc123')
    const config = requestHandler({ headers: {} })
    expect(config.headers.Authorization).toBe('Bearer abc123')
  })

  it('leaves requests unauthenticated when no token is stored', () => {
    const config = requestHandler({ headers: {} })
    expect(config.headers.Authorization).toBeUndefined()
  })
})
