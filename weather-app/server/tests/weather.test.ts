import { test, expect, type APIResponse } from '@playwright/test'

// Group 1 — Happy path tests (things that SHOULD work)
test.describe('Weather API — Happy Path', () => {
  test('should return weather data for valid city', async ({ request }) => {
    // make the actual API call
    const response = await request.get('/api/weather?city=London')

    // check status code
    expect(response.status()).toBe(200)

    // check response body
    const data = await response.json()

    // check structure of response
    expect(data).toHaveProperty('location')
    expect(data).toHaveProperty('current')
    expect(data.location.name).toBe('London')
    expect(data.current).toHaveProperty('temperature')
    expect(data.current).toHaveProperty('humidity')
    expect(data.current).toHaveProperty('wind_speed')

    console.log('✅ Weather data received for London')
  })

  test('should return location details', async ({ request }) => {
    const response = await request.get('/api/weather?city=Bhubaneswar')
    const data = await response.json()

    expect(response.status()).toBe(200)
    expect(data.location).toHaveProperty('name')
    expect(data.location).toHaveProperty('country')
    expect(data.location).toHaveProperty('localtime')
  })
})

// Group 2 — Error path tests (things that SHOULD fail)
test.describe('Weather API — Error Handling', () => {
  test('should return 400 if city is missing', async ({ request }) => {
    const response = await request.get('/api/weather')

    expect(response.status()).toBe(400)

    const data = await response.json()
    expect(data).toHaveProperty('error')
    expect(data.error).toBe('City is required')

    console.log('✅ Correctly handled missing city')
  })

  test('should return error for invalid city', async ({ request }) => {
    const response = await request.get('/api/weather?city=xyzabc123invalid')

    const data = await response.json()

    // either 400 from weatherstack or has error property
    expect(data).toHaveProperty('error')

    console.log('✅ Correctly handled invalid city')
  })
})

// Group 3 — Rate limiting tests
test.describe('Weather API — Rate Limiting', () => {
  test('should block after 10 requests in 15 minutes', async ({ request }) => {
    // make 11 requests rapidly
    let lastResponse: APIResponse | undefined

    for (let i = 0; i < 101; i++) {
      lastResponse = await request.get('/api/weather?city=London')
    }

    // 11th request should be blocked
    expect(lastResponse?.status()).toBe(429)

    const data = await lastResponse!.json()
    expect(data).toHaveProperty('error')

    console.log('✅ Rate limiting working correctly')
  })
})
