# Weather App — Complete Testing Guide

> A comprehensive document covering everything built, every concept learned, and every testing tool used in the Weather App project.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Security Architecture](#security-architecture)
3. [What is Testing and Why](#what-is-testing-and-why)
4. [The Testing Pyramid](#the-testing-pyramid)
5. [Module 1 — Playwright Integration Testing](#module-1--playwright-integration-testing)
6. [Module 2 — Vitest Unit Testing](#module-2--vitest-unit-testing)
7. [Module 3 — Storybook Component Testing](#module-3--storybook-component-testing)
8. [All Testing Types Reference](#all-testing-types-reference)
9. [Tools and Dependencies](#tools-and-dependencies)
10. [Project Structure](#project-structure)
11. [Run Commands Reference](#run-commands-reference)

---

## Project Overview

A weather app built with React + Vite (frontend) and Node + Express (backend), using the Weatherstack API. The project demonstrates:

- Secure API key management via backend proxy pattern
- Rate limiting and IP restriction
- Axios instance with interceptors
- React Query for data fetching and caching
- Vite proxy for hiding backend URL
- Three complete testing modules covering the full testing pyramid

**Live Stack:**
```
Frontend  → React + Vite + Tailwind + Axios + React Query
Backend   → Node.js + Express + Axios
Security  → express-rate-limit, IP whitelist, .env, Vite proxy
Testing   → Playwright + Vitest + Storybook
```

---

## Security Architecture

### The 4 Layer Security System

```
Layer 1 — Vite Proxy
"User only sees frontend URL — backend URL hidden"

Layer 2 — IP Restriction
"Only whitelisted IPs can call the backend"

Layer 3 — Rate Limiting
"Max 10 requests per 15 minutes per IP"

Layer 4 — Backend Proxy
"API key lives in .env on server — never exposed to browser"
```

### How a Request Flows

```
User types city → clicks Search
↓
React (localhost:5173/api/weather)     ← user sees this only
↓
Vite proxy intercepts /api/*
Forwards to localhost:5000             ← user never sees this
↓
IP restriction check
→ Not whitelisted → 403 Forbidden ❌
→ Whitelisted → continue ✅
↓
Rate limiter check
→ Over 10 requests → 429 Too Many Requests ❌
→ Under limit → continue ✅
↓
Express backend calls Weatherstack
with HIDDEN API key from .env          ← user never sees this
↓
Weather data returned to frontend
↓
User sees weather data ✅
```

### Backend Proxy Pattern

The core security concept — your server acts as a middleman:

```
❌ WRONG — key exposed in browser
React → directly calls Weatherstack API (key visible in devtools)

✅ CORRECT — key hidden on server
React → your backend → Weatherstack API (key only on server)
```

### Environment Variables

```
# server/.env (never committed to GitHub)
WEATHERSTACK_API_KEY=your_secret_key
PORT=5000

# client/.env
VITE_API_URL=http://localhost:5000
```

### Rate Limiting Code

```js
const weatherLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minute window
  max: 10,                   // max 10 requests per window
  message: { error: 'Too many requests — try again after 15 minutes.' }
})
```

### IP Restriction Code

```js
const allowedIPs = ['127.0.0.1', '::1']

const ipRestriction = (req, res, next) => {
  const userIP = req.ip || req.connection.remoteAddress
  if (!allowedIPs.includes(userIP)) {
    return res.status(403).json({ error: 'Access denied' })
  }
  next()
}
```

### Axios Instance (Frontend)

```js
const api = axios.create({
  baseURL: '/',       // hits frontend URL — Vite proxy handles rest
  timeout: 10000,
})

// Global error handling — write once, works everywhere
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) throw new Error('Too many requests!')
    if (error.response?.status === 403) throw new Error('Access denied!')
    throw error
  }
)
```

### React Query

```js
const { data, isLoading, error } = useQuery({
  queryKey: ['weather', searchCity],     // unique cache key
  queryFn: () => fetchWeather(searchCity), // fetch function
  enabled: !!searchCity,                 // only fetch when city exists
  staleTime: 1000 * 60 * 5,            // cache fresh for 5 minutes
  retry: 1                              // retry once on failure
})
```

**Why two states (city vs searchCity):**
```
city        → changes every keystroke → would fire API on every key ❌
searchCity  → only changes on Search click → ONE API call ✅
```

**Caching behavior:**
```
Search "London" at 10:00 → API call → cached (FRESH)
Search "London" at 10:03 → NO API call → cached data returned instantly ✅
Search "London" at 10:07 → stale → cached data shown + background refetch ✅
```

---

## What is Testing and Why

### The Core Problem Testing Solves

```
Day 1: Build feature A → works ✅
Day 2: Build feature B → works ✅
Day 3: Add feature C → feature A breaks ❌
       You don't know until user complains
```

Testing = automated checks that catch this instantly:

```
You change code
Tests run automatically (3 seconds)
"Feature A is BROKEN — you broke it in this commit"
Fix before any user is affected ✅
```

### Three Key Benefits

**1. Catches regressions** — code that worked before but broke after a change

**2. Forces better code** — testable code = small, focused functions that do one thing

**3. Living documentation** — tests describe exactly how code should behave

---

## The Testing Pyramid

```
         /\
        /  \
       / E2E \          ← Few (5-10), slow, most realistic
      /────────\
     / Integration\     ← Some (20-30), medium speed
    /──────────────\
   /   Unit Tests   \   ← Many (100+), fast, specific
  /──────────────────\
```

### Rule of thumb

```
Unit        → 70% of your tests
Integration → 20% of your tests
E2E         → 10% of your tests
```

Why? Unit tests are fast and cheap. E2E tests are slow and expensive.

---

## Module 1 — Playwright Integration Testing

### What is Playwright?

Browser automation and API testing tool by Microsoft. Used here for **backend API integration testing** — testing how multiple parts of the system work together.

### Integration vs Unit Testing

```
Unit test        → tests ONE function in isolation
Integration test → tests how MULTIPLE parts work TOGETHER
```

For your backend:
```
Route → IP restriction → Rate limiter → Axios call → Response
```
Integration test checks this ENTIRE flow together.

### What is jsdom?

Fake browser environment inside Node.js. React components need `document`, `window`, DOM — Node.js has none of these. jsdom provides them.

```
Node.js: no document, no window ❌
jsdom:   fake document, fake window ✅
```

### Setup

```bash
npm install -D @playwright/test
```

### Playwright Config

```js
// playwright.config.js
export default defineConfig({
  testDir: './tests',        // where test files live
  timeout: 30000,            // 30 seconds before test fails
  retries: 1,                // retry failed test once
  use: {
    baseURL: 'http://localhost:5000', // base for all requests
  },
  reporter: 'html'           // generates HTML report
})
```

**Each config option explained:**
- `testDir` — where Playwright looks for test files
- `timeout` — how long to wait before declaring test failed
- `retries` — retry once on failure (handles flaky network)
- `baseURL` — so you write `/api/weather` not full URL everywhere
- `reporter: 'html'` — beautiful visual report in browser

### The AAA Pattern

Every test follows this structure:

```
ARRANGE → set up what you need (mock data, test inputs)
ACT     → do the thing (make API call, click button)
ASSERT  → check the result (verify response, check UI)
```

### Tests Written

```js
// Group 1 — Happy Path (things that SHOULD work)
test('should return weather data for valid city')
test('should return location details')

// Group 2 — Error Handling (things that SHOULD fail gracefully)
test('should return 400 if city is missing')
test('should return error for invalid city')

// Group 3 — Rate Limiting
test('should block after 10 requests in 15 minutes')
```

### Key Playwright API

```js
// Make HTTP request
const response = await request.get('/api/weather?city=London')

// Check status code
expect(response.status()).toBe(200)

// Parse body
const data = await response.json()

// Check property exists
expect(data).toHaveProperty('location')

// Check exact value
expect(data.location.name).toBe('London')

// Group related tests
test.describe('Group Name', () => { ... })
```

### Test Results

```
✅ should return weather data for valid city       1.7s
✅ should return location details                  1.0s
✅ should return 400 if city is missing            33ms
✅ should return error for invalid city            608ms
✅ should block after 10 requests in 15 minutes    15.4s

5 passed ✅
```

### Commands

```bash
npm test              # run all tests
npm run test:report   # view HTML report in browser
```

### Playwright vs Postman

| | Postman | Playwright |
|---|---|---|
| Manual testing | ✅ | ❌ |
| Automated | ❌ | ✅ |
| Runs in CI/CD | ❌ | ✅ |
| Repeatable every time | ❌ | ✅ |
| Part of codebase | ❌ | ✅ |

---

## Module 2 — Vitest Unit Testing

### What is Vitest?

Unit testing framework built specifically for Vite projects. Tests individual functions and components in complete isolation.

### Unit Testing Core Concept

**ISOLATION** is the key word. When testing a function:
- Fake (mock) all API calls
- Fake all database calls
- Test ONLY the function's own logic

```
Real API call = slow, costs rate limit, needs internet, unreliable
Mock          = instant, free, controlled, always same result
```

### Setup

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### Vitest Config (inside vite.config.js)

```js
test: {
  globals: true,           // use describe/test/expect without importing
  environment: 'jsdom',    // fake browser for React components
  setupFiles: './src/tests/setup.js', // runs before every test
}
```

**Each option explained:**

`globals: true` — without this you'd import in every file:
```js
// Without globals
import { describe, test, expect } from 'vitest' // every file

// With globals — just use them directly ✅
describe('...', () => { test('...', () => { expect() }) })
```

`environment: 'jsdom'` — React components need browser APIs (document, window). Node.js doesn't have them. jsdom provides a fake browser.

`setupFiles` — runs setup.js before every test. Your setup.js imports `@testing-library/jest-dom` which gives extra matchers:
```js
expect(element).toBeInTheDocument()
expect(element).toBeVisible()
expect(element).toHaveText()
```

### Mocking — Most Important Concept

```js
vi.mock('../api/axiosInstance') // tell Vitest to fake this module

// Mock success
api.get.mockResolvedValue({ data: mockData })
// "when api.get is called → return this data"

// Mock failure
api.get.mockRejectedValue(new Error('Too many requests!'))
// "when api.get is called → throw this error"
```

### Testing Library API

```js
// Render component in fake browser
render(<Weather />)

// Find elements
screen.getByPlaceholderText('Enter city name...')
screen.getByText('Search')
screen.getByRole('button')

// Simulate user actions
fireEvent.change(input, { target: { value: 'London' } })
fireEvent.click(button)

// Wait for async updates
await waitFor(() => {
  expect(screen.getByText('London')).toBeInTheDocument()
})
```

### Tests Written

```js
// Function tests
test('returns weather data for valid city')
test('throws error when API fails')

// Component tests
test('renders search input and button')
test('updates input when user types')
test('displays weather data after successful search')
test('displays error when API fails')
test('does not search when input is empty')
```

### Test Results

```
✅ fetchWeather → returns weather data for valid city
✅ fetchWeather → throws error when API fails
✅ Weather Component → renders search input and button
✅ Weather Component → updates input when user types
✅ Weather Component → displays weather data after search
✅ Weather Component → displays error when API fails
✅ Weather Component → does not search when input is empty

7 passed ✅
```

### Commands

```bash
npm test              # watch mode — reruns on file change
npm run test:run      # run once and exit
npm run test:ui       # visual UI in browser
```

### Vitest vs Playwright

| | Vitest | Playwright |
|---|---|---|
| Type | Unit | Integration |
| Speed | Very fast (ms) | Slower (seconds) |
| Real API calls | No (mocked) | Yes |
| Tests | Functions + components | Full API flows |
| Scope | Frontend only | Backend API |

---

## Module 3 — Storybook Component Testing

### What is Storybook?

Tool for building and testing UI components in complete isolation — see every component in every possible state without running your full app.

### What is a Story?

One specific state of a component:

```
Weather component stories:
→ Default (empty search)
→ Loading (fetching data)
→ Success (weather data showing)
→ Error (something went wrong)
→ Cold weather (-15°C)
→ Hot weather (45°C)
```

### Why Storybook?

```
Without Storybook:
Run full app → navigate to page → manipulate state → see component
Painful for every state

With Storybook:
Open localhost:6006 → click story → instantly see component ✅
```

### Setup

```bash
npx storybook@latest init
npm install -D msw msw-storybook-addon
```

### Story Structure

```js
// Default export — component metadata
export default {
  title: 'Components/Weather',  // sidebar location in Storybook
  component: Weather,           // which component to show
  decorators: [withQueryClient], // wrappers needed
  parameters: {
    layout: 'fullscreen'
  }
}

// Named exports — individual stories
export const Default = {}           // empty state

export const WithWeatherData = {    // success state
  parameters: {
    msw: {
      handlers: [
        http.get('/api/weather', () => {
          return HttpResponse.json({ /* mock data */ })
        })
      ]
    }
  }
}
```

### MSW (Mock Service Worker)

Intercepts real API calls in the browser and returns fake data — so Storybook doesn't need your backend running.

```
Without MSW:
Component makes real API call → needs backend running → painful

With MSW:
Component makes API call → MSW intercepts → returns fake data ✅
No backend needed
```

### Stories Written

```
Default        → empty search input, no data
Loading        → spinner showing, data loading
WithWeatherData → London, 18°C, Partly Cloudy
WithError      → "Too many requests!" error message
ColdWeather    → Moscow, -15°C, Heavy Snow
HotWeather     → Dubai, 45°C, Sunny
```

### Commands

```bash
npm run storybook       # opens localhost:6006
npm run build-storybook # builds static Storybook site
```

### Storybook vs Vitest

| | Vitest | Storybook |
|---|---|---|
| Tests | Logic + behavior | Visual appearance |
| Output | Pass/fail | Visual component |
| Purpose | Catch bugs | Design review |
| Mock | vi.mock() | MSW |

---

## All Testing Types Reference

### 1. Unit Testing (Vitest)
- Tests ONE function or component in isolation
- All dependencies mocked
- Very fast, very specific
- Many tests (70% of all tests)

### 2. Integration Testing (Playwright API mode)
- Tests multiple parts working TOGETHER
- Real HTTP calls
- Medium speed
- Some tests (20% of all tests)

### 3. E2E Testing (Playwright browser mode)
- Tests entire app like a real user
- Real browser, real clicks, real navigation
- Slowest, most realistic
- Few tests (10% of all tests)

### 4. Component Testing (Storybook)
- Tests UI components in all states visually
- No logic testing — purely visual + behavioral
- Great for design review

### 5. Snapshot Testing
- Takes a "photo" of component output
- Future runs compare against photo
- Catches unexpected UI changes

### 6. Performance Testing
- How fast does API respond?
- Can it handle 1000 users?
- Tools: k6, Artillery, Lighthouse

### 7. Security Testing
- Can someone inject SQL?
- Are API keys exposed?
- Tools: OWASP ZAP

### 8. Accessibility Testing
- Can screen readers read it?
- Keyboard navigation works?
- Tools: axe, Lighthouse

---

## Tools and Dependencies

### Backend (server/)

```json
{
  "dependencies": {
    "express": "^5.2.1",
    "cors": "^2.8.6",
    "dotenv": "^16.4.5",
    "axios": "^1.18.1",
    "express-rate-limit": "^8.5.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.14",
    "@playwright/test": "^1.61.1"
  }
}
```

### Frontend (client/)

```json
{
  "dependencies": {
    "react": "^18",
    "axios": "^1.18.1",
    "@tanstack/react-query": "^5.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "tailwindcss": "^3.0.0",
    "vitest": "latest",
    "@testing-library/react": "latest",
    "@testing-library/jest-dom": "latest",
    "jsdom": "latest",
    "@storybook/react-vite": "latest",
    "msw": "latest",
    "msw-storybook-addon": "latest"
  }
}
```

---

## Project Structure

```
weather-app/
├── server/
│   ├── tests/
│   │   └── weather.test.js        ← Playwright tests
│   ├── docs/
│   │   └── PLAYWRIGHT_TESTING.md  ← Module 1 doc
│   ├── .env                       ← API key (never committed)
│   ├── playwright.config.js       ← Playwright config
│   ├── server.js                  ← Express backend
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── api/
│   │   │   └── axiosInstance.js   ← Axios instance + interceptors
│   │   ├── components/
│   │   │   └── Weather.jsx        ← Main component
│   │   ├── stories/
│   │   │   └── Weather.stories.jsx ← Storybook stories
│   │   ├── tests/
│   │   │   ├── setup.js           ← Vitest setup
│   │   │   ├── Weather.test.jsx   ← Component tests
│   │   │   └── fetchWeather.test.js ← Function tests
│   │   └── main.jsx               ← React Query provider
│   ├── .storybook/
│   │   ├── main.js                ← Storybook config
│   │   └── preview.js             ← MSW setup
│   ├── docs/
│   │   ├── VITEST_TESTING.md      ← Module 2 doc
│   │   └── STORYBOOK_TESTING.md   ← Module 3 doc
│   ├── .env                       ← Frontend env vars
│   ├── vite.config.js             ← Vite + Vitest + proxy config
│   └── package.json
│
├── .gitignore                     ← excludes .env, node_modules
└── WEATHER_APP_TESTING_GUIDE.md   ← this file
```

---

## Run Commands Reference

### Backend

```bash
cd server

npm run dev           # start server with nodemon
npm run start         # start server without nodemon
npm test              # run Playwright tests
npm run test:report   # view Playwright HTML report
```

### Frontend

```bash
cd client

npm run dev           # start Vite dev server
npm run build         # build for production
npm test              # run Vitest in watch mode
npm run test:run      # run Vitest once
npm run test:ui       # Vitest visual UI
npm run storybook     # start Storybook (localhost:6006)
npm run build-storybook # build static Storybook
```

---

## Interview Answer — How did you test this app?

> "I implemented three levels of testing covering the full testing pyramid. For the backend, I used Playwright in API mode for integration testing — testing the entire request flow including rate limiting and error handling across 5 test cases. For the frontend, I used Vitest with Testing Library for unit testing — mocking API calls and testing component behavior in 7 test cases. For UI component testing, I used Storybook with MSW to render the Weather component in 6 different states — default, loading, success, error, cold weather, and hot weather — without needing the backend running. This gives confidence that security layers, business logic, and UI all work correctly independently and together."

---

*Built by Ritwiz | github.com/ritwiz-sys*
