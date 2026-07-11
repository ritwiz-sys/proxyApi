# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: weather.test.ts >> Weather API — Happy Path >> should return location details
- Location: tests\weather.test.ts:26:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 500
```

# Test source

```ts
  1  | import { test, expect, type APIResponse } from '@playwright/test'
  2  | 
  3  | // Group 1 — Happy path tests (things that SHOULD work)
  4  | test.describe('Weather API — Happy Path', () => {
  5  |   test('should return weather data for valid city', async ({ request }) => {
  6  |     // make the actual API call
  7  |     const response = await request.get('/api/weather?city=London')
  8  | 
  9  |     // check status code
  10 |     expect(response.status()).toBe(200)
  11 | 
  12 |     // check response body
  13 |     const data = await response.json()
  14 | 
  15 |     // check structure of response
  16 |     expect(data).toHaveProperty('location')
  17 |     expect(data).toHaveProperty('current')
  18 |     expect(data.location.name).toBe('London')
  19 |     expect(data.current).toHaveProperty('temperature')
  20 |     expect(data.current).toHaveProperty('humidity')
  21 |     expect(data.current).toHaveProperty('wind_speed')
  22 | 
  23 |     console.log('✅ Weather data received for London')
  24 |   })
  25 | 
  26 |   test('should return location details', async ({ request }) => {
  27 |     const response = await request.get('/api/weather?city=Bhubaneswar')
  28 |     const data = await response.json()
  29 | 
> 30 |     expect(response.status()).toBe(200)
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  31 |     expect(data.location).toHaveProperty('name')
  32 |     expect(data.location).toHaveProperty('country')
  33 |     expect(data.location).toHaveProperty('localtime')
  34 |   })
  35 | })
  36 | 
  37 | // Group 2 — Error path tests (things that SHOULD fail)
  38 | test.describe('Weather API — Error Handling', () => {
  39 |   test('should return 400 if city is missing', async ({ request }) => {
  40 |     const response = await request.get('/api/weather')
  41 | 
  42 |     expect(response.status()).toBe(400)
  43 | 
  44 |     const data = await response.json()
  45 |     expect(data).toHaveProperty('error')
  46 |     expect(data.error).toBe('City is required')
  47 | 
  48 |     console.log('✅ Correctly handled missing city')
  49 |   })
  50 | 
  51 |   test('should return error for invalid city', async ({ request }) => {
  52 |     const response = await request.get('/api/weather?city=xyzabc123invalid')
  53 | 
  54 |     const data = await response.json()
  55 | 
  56 |     // either 400 from weatherstack or has error property
  57 |     expect(data).toHaveProperty('error')
  58 | 
  59 |     console.log('✅ Correctly handled invalid city')
  60 |   })
  61 | })
  62 | 
  63 | // Group 3 — Rate limiting tests
  64 | test.describe('Weather API — Rate Limiting', () => {
  65 |   test('should block after 10 requests in 15 minutes', async ({ request }) => {
  66 |     // make 11 requests rapidly
  67 |     let lastResponse: APIResponse | undefined
  68 | 
  69 |     for (let i = 0; i < 101; i++) {
  70 |       lastResponse = await request.get('/api/weather?city=London')
  71 |     }
  72 | 
  73 |     // 11th request should be blocked
  74 |     expect(lastResponse?.status()).toBe(429)
  75 | 
  76 |     const data = await lastResponse!.json()
  77 |     expect(data).toHaveProperty('error')
  78 | 
  79 |     console.log('✅ Rate limiting working correctly')
  80 |   })
  81 | })
  82 | 
```