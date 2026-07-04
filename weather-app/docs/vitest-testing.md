# Vitest — Client Unit Testing

Config: [weather-app/client/vite.config.js](../client/vite.config.js)
Setup file: [weather-app/client/src/tests/setup.js](../client/src/tests/setup.js)
Tests:
[weather.test.jsx](../client/src/components/weather.test.jsx),
[axiosInstance.test.js](../client/src/api/axiosInstance.test.js)

## What was done

The client already had the Vitest/Testing Library/jsdom packages listed
in `package.json` and a `test` block in `vite.config.js`, but the setup
was incomplete and nothing had actually been tested yet:

- `vite.config.js` pointed `setupFiles` at
  `./src/tests/setup.js`, but that file didn't exist — a copy of it had
  been created by mistake inside `server/test-results/`, a Playwright
  output folder, so `npm test` on the client would have failed to find
  its setup file. It's been recreated at the correct path
  (`client/src/tests/setup.js`) and the stray copy removed.
- The same edit that added the `test` block to `vite.config.js` had also
  silently dropped the `@tailwindcss/vite` plugin from the `plugins`
  array. Since this project uses Tailwind v4's `@import "tailwindcss"`
  in `index.css` with no PostCSS config, that plugin is the only thing
  that processes Tailwind — removing it would have broken all styling
  the next time `vite.config.js` was touched. Restored.
- Two real unit test files were added (there were none before).

## Config

```js
// vite.config.js
test: {
  globals: true,                        // describe/test/expect available without importing
  environment: 'jsdom',                 // fake DOM so React components can render
  setupFiles: './src/tests/setup.js',   // runs jest-dom matchers before every test
}
```

```js
// src/tests/setup.js
import '@testing-library/jest-dom'
```

## Running the tests

```bash
cd weather-app/client
npm test        # watch mode
npm run test:run  # single run, good for CI
npm run test:ui   # Vitest's browser UI
```

## What's covered

**`weather.test.jsx`** — renders the `Weather` component inside a
`QueryClientProvider` (required because the component uses
`@tanstack/react-query`'s `useQuery`) and mocks `../api/axiosInstance` so
no real HTTP call happens:

- input + search button render
- a successful `api.get` resolves and the weather data renders (city
  name, description, humidity, etc.)
- a failing `api.get` renders the thrown error message
- clicking Search with an empty city never calls the API at all

**`axiosInstance.test.js`** — mocks the `axios` module itself (not the
project's wrapper) so the response interceptor registered in
`axiosInstance.jsx` can be captured and called directly with fabricated
error objects, without needing a real network failure to trigger a 429
or 403:

```js
vi.mock('axios', () => ({
  default: { create: vi.fn(() => ({ interceptors: { response: { use: vi.fn((_ok, onError) => { errorHandler = onError }) } } })) }
}))
```

This checks that a 429 becomes "Too many requests — slow down!", a 403
becomes "Access denied", `ECONNABORTED` becomes "Request timed out", and
anything else is rethrown unchanged.

## New things learnt

- **`useQuery`'s `retry` option overrides the test `QueryClient`'s
  defaults if the component sets its own.** The first version of the
  error-path test used `api.get.mockRejectedValueOnce(...)`. It failed
  with `Cannot destructure property 'data' of undefined` instead of
  showing the expected error message. Cause: `Weather` calls `useQuery({
  ..., retry: 1 })`, so on failure react-query retries once — the second
  call to the mock had nothing queued, `vi.fn()` returned `undefined`,
  and `const { data } = await api.get(...)` tried to destructure that.
  Fix: use `mockRejectedValue` (no "Once") so every retry attempt still
  rejects. This generalizes — any mock for code under test that retries
  needs to account for every attempt, not just the first.
- **Mocking the wrapper vs. mocking the library gives two different
  kinds of test.** Mocking `../api/axiosInstance` in the component test
  treats the API client as a black box (good for testing the component's
  render logic). Mocking `axios` itself in the interceptor test is the
  only way to unit-test the interceptor's error-mapping logic in
  isolation, since the interceptor function isn't exported — it's only
  reachable via the callback passed to `interceptors.response.use`.
- **`vi.mock(..., factory)` needs the factory to return the same shape
  the real module exports**, i.e. `{ default: {...} }` for a module
  using `export default`. Forgetting the `default` wrapper is a common
  mistake that silently breaks the mock instead of throwing.
- **jsdom needs `environment: 'jsdom'` explicitly** — Vitest's default
  environment is `node`, which has no `document`/`window`, so any test
  that renders a component fails immediately without this setting.
- **A stray file in the wrong directory can silently break `npm test`.**
  The setup file had been created under a Playwright artifacts folder
  instead of the client's `src/tests/`, which would only surface as a
  confusing "cannot find module" error the first time someone actually
  ran the client test suite — a reminder to actually run a test command
  after wiring up config, rather than assuming config + dependencies
  installed means the setup works.

## Practical checklist for adding a new unit test

1. Colocate `*.test.jsx` / `*.test.js` next to the file it tests.
2. If the component uses React Query, wrap it in a fresh
   `QueryClientProvider` per test (a shared client leaks cache state
   between tests).
3. Mock at the boundary that makes the test meaningful — mock
   `axiosInstance` for component/UI tests, mock `axios` only when you
   need to test the axios wrapper itself.
4. Run `npm run test:run` before committing — `npm test`'s watch mode
   can mask a test that's actually failing if you don't look closely.
