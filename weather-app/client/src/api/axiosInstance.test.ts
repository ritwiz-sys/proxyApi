import { describe, it, expect, vi, beforeEach } from 'vitest'

interface FakeAxiosError {
  response?: { status: number }
  code?: string
}

type ErrorHandler = (error: FakeAxiosError | Error) => unknown

let errorHandler: ErrorHandler = () => undefined

vi.mock('axios', () => {
  const instance = {
    interceptors: {
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
