# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: weather.test.js >> Weather API — Rate Limiting >> should block after 10 requests in 15 minutes
- Location: tests\weather.test.js:70:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 429
Received: 200
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | // Group 1 — Happy path tests (things that SHOULD work)
  4  | test.describe('Weather API — Happy Path', () => {
  5  | 
  6  |   test('should return weather data for valid city', async ({ request }) => {
  7  |     // make the actual API call
  8  |     const response = await request.get('/api/weather?city=London')
  9  | 
  10 |     // check status code
  11 |     expect(response.status()).toBe(200)
  12 | 
  13 |     // check response body
  14 |     const data = await response.json()
  15 | 
  16 |     // check structure of response
  17 |     expect(data).toHaveProperty('location')
  18 |     expect(data).toHaveProperty('current')
  19 |     expect(data.location.name).toBe('London')
  20 |     expect(data.current).toHaveProperty('temperature')
  21 |     expect(data.current).toHaveProperty('humidity')
  22 |     expect(data.current).toHaveProperty('wind_speed')
  23 | 
  24 |     console.log('✅ Weather data received for London')
  25 |   })
  26 | 
  27 |   test('should return location details', async ({ request }) => {
  28 |     const response = await request.get('/api/weather?city=Bhubaneswar')
  29 |     const data = await response.json()
  30 | 
  31 |     expect(response.status()).toBe(200)
  32 |     expect(data.location).toHaveProperty('name')
  33 |     expect(data.location).toHaveProperty('country')
  34 |     expect(data.location).toHaveProperty('localtime')
  35 |   })
  36 | 
  37 | })
  38 | 
  39 | // Group 2 — Error path tests (things that SHOULD fail)
  40 | test.describe('Weather API — Error Handling', () => {
  41 | 
  42 |   test('should return 400 if city is missing', async ({ request }) => {
  43 |     const response = await request.get('/api/weather')
  44 | 
  45 |     expect(response.status()).toBe(400)
  46 | 
  47 |     const data = await response.json()
  48 |     expect(data).toHaveProperty('error')
  49 |     expect(data.error).toBe('City is required')
  50 | 
  51 |     console.log('✅ Correctly handled missing city')
  52 |   })
  53 | 
  54 |   test('should return error for invalid city', async ({ request }) => {
  55 |     const response = await request.get('/api/weather?city=xyzabc123invalid')
  56 | 
  57 |     const data = await response.json()
  58 | 
  59 |     // either 400 from weatherstack or has error property
  60 |     expect(data).toHaveProperty('error')
  61 | 
  62 |     console.log('✅ Correctly handled invalid city')
  63 |   })
  64 | 
  65 | })
  66 | 
  67 | // Group 3 — Rate limiting tests
  68 | test.describe('Weather API — Rate Limiting', () => {
  69 | 
  70 |   test('should block after 10 requests in 15 minutes', async ({ request }) => {
  71 |     // make 11 requests rapidly
  72 |     let lastResponse
  73 | 
  74 |     for (let i = 0; i < 11; i++) {
  75 |       lastResponse = await request.get('/api/weather?city=London')
  76 |     }
  77 | 
  78 |     // 11th request should be blocked
> 79 |     expect(lastResponse.status()).toBe(429)
     |                                   ^ Error: expect(received).toBe(expected) // Object.is equality
  80 | 
  81 |     const data = await lastResponse.json()
  82 |     expect(data).toHaveProperty('error')
  83 | 
  84 |     console.log('✅ Rate limiting working correctly')
  85 |   })
  86 | 
  87 | })
```