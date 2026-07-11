# TypeScript Migration — Client, Server & the Commit Gate

See [code-quality.md](code-quality.md) for how ESLint/Prettier/Husky/lint-staged
work in this repo — this doc only covers what changed on top of that to add
TypeScript and make `tsc` errors block commits.

## What was converted

Every source file in both packages, plus their configs:

**Client** (`weather-app/client`)
- `main.jsx` → `main.tsx`, `App.jsx` → `App.tsx`
- `components/weather.jsx` → `weather.tsx` (added `WeatherResponse` /
  `WeatherLocation` / `WeatherCurrent` interfaces, exported so tests and
  stories can reuse the exact shape instead of redefining it)
- `api/axiosInstance.jsx` → `axiosInstance.ts`
- `components/weather.test.jsx` → `weather.test.tsx`
- `api/axiosInstance.test.js` → `axiosInstance.test.ts`
- `components/weather.stories.jsx` → `weather.stories.tsx`
- `tests/setup.js` → `setup.ts`
- `vite.config.js` → `vite.config.ts`
- `.storybook/main.js` → `main.ts`, `.storybook/preview.jsx` → `preview.tsx`
- Added `tsconfig.json` (references), `tsconfig.app.json` (browser code,
  `strict: true`), `tsconfig.node.json` (Vite/Storybook config files)
- Added `src/vite-env.d.ts` (`/// <reference types="vite/client" />`) so
  CSS/asset side-effect imports type-check

**Server** (`weather-app/server`)
- `server.js` → `server.ts`, typed `Request`/`Response`/`NextFunction`
  handlers, and a `WeatherstackSuccess | WeatherstackError` union for the
  upstream API response instead of trusting it as `any`
- `playwright.config.js` → `.ts`, `tests/weather.test.js` → `.ts`
- Added `server/tsconfig.json`
- Dev/start scripts switched from `nodemon server.js` to `tsx watch
  server.ts` / `tsx server.ts` — `tsx` runs TypeScript directly via esbuild,
  no separate compile step needed for local dev (`nodemon` was removed,
  it's no longer used)

## The commit gate — how it actually blocks a bad commit

Both packages got a `typecheck` script:

```json
// client/package.json
"typecheck": "tsc -b --noEmit"

// server/package.json
"typecheck": "tsc --noEmit"
```

`.husky/pre-commit` now runs both, after lint-staged, with `set -e` so the
hook stops (and blocks the commit) at the first non-zero exit:

```sh
set -e

npx lint-staged
npm run typecheck --prefix client
npm run typecheck --prefix server
```

This runs full-project type-checking on **every** commit, not just staged
files — unlike ESLint/Prettier, `tsc` needs whole-program context (a change
in one file can break a type in a file that isn't even staged), so scoping
it to staged files the way lint-staged does would miss exactly the errors
this is meant to catch.

**Verified this actually works**: added a deliberate type error
(`const x: number = 'a string'`) to `App.tsx`, staged it, and ran
`.husky/pre-commit` directly:

```
> client@0.0.0 typecheck
> tsc -b --noEmit

src/App.tsx(8,7): error TS2322: Type 'string' is not assignable to type 'number'.
src/App.tsx(8,7): error TS6133: 'brokenTypeError' is declared but its value is never read.
```

Hook exited non-zero — a real `git commit` would have been blocked here.
Reverted the test change afterward.

## New things learnt

- **`--legacy-peer-deps` can silently uninstall a package you already had.**
  Installing `typescript`/`typescript-eslint` in the client hit a pre-existing
  peer conflict (`eslint-plugin-react` wants `eslint <=9.7`, repo has
  `eslint@10.6`) and needed `--legacy-peer-deps` to proceed. That flag makes
  npm stop resolving peer dependencies at all — and on the *next* install, it
  pruned `@testing-library/dom`, which had only ever been present because it's
  a peer dependency of `@testing-library/react` that a normal (non-legacy)
  install had auto-added earlier. Every test that imports `screen` or
  `waitFor` from `@testing-library/react` broke (`Cannot find module
  '@testing-library/dom'`) with no code change of ours to blame. Fixed by
  installing it explicitly as a direct devDependency so it can't be pruned
  as a side effect of an unrelated peer conflict again.
- **The whole pre-commit pipeline was actually broken before this, silently.**
  Root `weather-app/package.json` (husky + lint-staged) has its own
  `node_modules`, separate from `client/node_modules` and
  `server/node_modules` — this isn't an npm workspace. `lint-staged`'s
  `eslint --fix` / `prettier --write` commands run from the repo root, and
  neither binary existed in the root's `node_modules/.bin`, so the very
  first real test of the hook failed with `'eslint' is not recognized as an
  internal or external command` — before ever reaching the new typecheck
  step. This would have failed identically for the original `.js`/`.jsx`
  lint-staged globs too; it just had never been exercised end-to-end.
  Fixed by adding `eslint` and `prettier` as root devDependencies — ESLint
  still resolves each package's own `eslint.config.js` (and that config's
  own plugins) based on the file being linted, so this doesn't change which
  rules apply, it just makes the CLI reachable from root.
- **`.gitignore` had `.storybook` as a bare entry**, which ignores the
  directory at any depth — meaning `.storybook/main.ts` and `preview.tsx`
  (real config, not generated output) would never be picked up by `git add`
  at all. Easy to miss because `git status` (without `--ignored`) just shows
  nothing for an ignored path, not a warning. Removed the entry; kept
  `storybook-static` and added `*.tsbuildinfo` (the new cache files `tsc -b`
  writes) instead.
- **Express 5's route handler types want `void`, not `Response`.** Writing
  `return res.status(400).json(...)` type-checks fine in plain JS but is a
  style worth avoiding once typed, since a handler returning a value reads as
  if the return value matters. Switched to `res.status(400).json(...); return`
  on its own line in `server.ts` for the early-exit branches.
- **Mocking a real dependency's method (`api.get`) across a module boundary
  needs `vi.mocked()`, not a raw type assertion,** to get a mock object whose
  type includes `.mockResolvedValueOnce()` etc. while still checking the call
  matches the real `AxiosInstance['get']` signature. Directly reassigning
  `api.get = (async () => ...) as typeof api.get` (used in the Storybook
  story's `play` function, where there's no `vi.mock` hook available) still
  needed a cast, because a plain async function returning `{ data }` doesn't
  structurally satisfy axios's fully overloaded `get<T, R, D>(...)` signature.
- **`tsc -b --noEmit` on a project-references setup doesn't just skip
  emit-checking — with every referenced `tsconfig` already set to
  `"noEmit": true`, it still needs to run to validate types; passing
  `--noEmit` on the CLI on top of that is redundant but harmless, and doesn't
  fight with `--build` mode the way some older TS versions used to complain.**
  Confirmed no stray `.js` files land next to the `.tsx` sources — only
  `.tsbuildinfo` cache files at the project root, which are gitignored.
- **The Playwright suite's flakiness (documented in
  [playwright-testing.md](playwright-testing.md)) got worse, not better,
  while verifying this migration** — running the rate-limiting test twice in
  a row within its own 15-minute window exhausted both this app's own
  in-memory limiter *and* the real Weatherstack API's own rate limit for the
  same key, so later runs saw the app's own 429 message on `curl`, and saw
  `axios` throwing `Request failed with status code 429` from Weatherstack
  itself (surfaced by the server as a 500). This is unrelated to the
  TypeScript conversion — `tsc --noEmit` and `eslint` were clean the whole
  time, and the request/response code paths are unchanged — but it's a
  reminder that repeatedly re-running this specific suite for verification
  has a real cost against a shared external quota, not just local state.

## Running it

```bash
# client
cd weather-app/client
npm run typecheck   # tsc -b --noEmit
npm run build       # tsc -b && vite build — build now fails on type errors too

# server
cd weather-app/server
npm run typecheck   # tsc --noEmit
npm run dev          # tsx watch server.ts
```
