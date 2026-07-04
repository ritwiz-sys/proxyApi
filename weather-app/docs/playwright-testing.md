# Playwright — API Integration Testing

Location: [weather-app/server/tests/weather.test.js](../server/tests/weather.test.js)
Config: [weather-app/server/playwright.config.js](../server/playwright.config.js)

## What Playwright is used for here

Playwright is normally known as a browser end-to-end tool, but its
`request` fixture can also fire plain HTTP calls with no browser involved.
That's how it's used in this project: as an API integration test runner
against the Express server in [server.js](../server/server.js), hitting
the real `/api/weather` route over HTTP instead of importing the route
handler in-process.

## Setup

```js
// playwright.config.js
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5000',
  },
  reporter: 'html'
})
```

`baseURL` means every test can call `request.get('/api/weather?city=London')`
instead of hardcoding `http://localhost:5000` everywhere.

The server must already be running (`npm start` / `npm run dev` in
`server/`) before the suite runs — this config has no `webServer` block,
so Playwright does not boot the server itself.

## Running the tests

```bash
cd weather-app/server
npm test           # runs the suite headlessly
npm run test:report # opens the last HTML report
```

## Test structure

Tests are grouped with `test.describe` by concern, which keeps the HTML
report readable and makes it obvious what a failure is about:

- **Happy path** — valid city returns 200 with `location` / `current` shape
- **Error handling** — missing city → 400, invalid city → error payload
- **Rate limiting** — hammer the endpoint until the 100-req/15-min limiter returns 429

```js
test.describe('Weather API — Rate Limiting', () => {
  test('should block after 10 requests in 15 minutes', async ({ request }) => {
    let lastResponse
    for (let i = 0; i < 101; i++) {
      lastResponse = await request.get('/api/weather?city=London')
    }
    expect(lastResponse.status()).toBe(429)
  })
})
```

## New things learnt

- **`request` fixture needs no `page`/browser context.** Declaring
  `async ({ request })` instead of `async ({ page })` skips launching
  Chromium entirely, which is why a pure API suite runs in a couple of
  seconds instead of the usual multi-second-per-test browser boot cost.
- **`baseURL` + relative paths keep tests portable.** Switching ports or
  environments later is a one-line config change, not a find/replace
  across every test file.
- **Retries can hide a real bug in a rate-limit test.** `retries: 1` is
  useful for flaky network tests, but combined with a test that mutates
  shared state (request count against a rate limiter), a retry doesn't
  start from a clean slate — the counter is already partially consumed
  from the first attempt. `test-results/*-retry1/` in this repo is the
  artifact from exactly that: the first attempt failed, Playwright
  retried automatically, and both attempts got recorded.
- **Playwright's HTML reporter writes two output folders that are easy to
  forget about:** `test-results/` (raw traces/error-context per test) and
  `playwright-report/` (the viewable HTML). Both were committed to this
  repo by accident — they're generated on every run and should normally
  be gitignored, since they'll just churn in every commit and can contain
  stale failure artifacts (a stray `setup.js` had even ended up inside
  `test-results/` from an unrelated edit). Add `test-results/` and
  `playwright-report/` to `.gitignore` if you don't want that noise in
  history.
- **Testing a live rate limiter is inherently order-dependent.** Because
  the limiter's window is shared server-side state, this test only works
  reliably if it's the *last* test to run against a fresh server process
  — running it before the other suites, or running the whole file twice
  without restarting the server, changes the outcome.
- **Assert on the error *shape*, not the exact provider message,** for
  third-party-dependent tests (`should return error for invalid city`
  just checks `data` has an `error` key rather than asserting the exact
  Weatherstack error string) — the upstream API's wording can change
  without it being a bug in this app.

## Practical checklist for adding a new endpoint test

1. Start the server (`npm run dev` in `server/`).
2. Add a `test()` inside the relevant `test.describe` block, or a new
   `describe` if it's a new concern.
3. Run `npm test` — check `npm run test:report` for a failure's request/
   response detail if something doesn't match.
4. Keep destructive/stateful tests (like rate limiting) last, and be
   aware they'll affect any test that runs after them in the same
   process.
