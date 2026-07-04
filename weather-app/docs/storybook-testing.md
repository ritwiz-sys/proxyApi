# Storybook — Component Development & Visual Testing

Config: [.storybook/main.js](../client/.storybook/main.js),
[.storybook/preview.jsx](../client/.storybook/preview.jsx)
Stories: [weather.stories.jsx](../client/src/components/weather.stories.jsx)

## What was done

Storybook was added via `npx storybook@latest init` from `weather-app/client`.
The installer auto-detected Vite + React and wired itself into the
existing `vite.config.js` rather than needing a separate build setup.
After the base install, three things needed cleaning up before it was
actually usable:

1. **Removed the generated example stories** (`src/stories/` — Button,
   Header, Page, and their asset files). Those ship by default so a new
   Storybook install has something to look at, but they aren't part of
   this app.
2. **Wrote a real story file** for the app's one component,
   [`Weather`](../client/src/components/weather.jsx), covering the empty
   state, a successful search, and a failed search.
3. **Fixed a missing global stylesheet import.** `.storybook/preview.jsx`
   didn't import the app's `src/index.css`, so every story rendered with
   zero Tailwind styling (confirmed by checking the `<h1>`'s computed
   style in a real browser: `color` and `font-size` were the browser
   defaults, not `blue-800` / `30px`). Fixed with one line:
   `import '../src/index.css'` at the top of `preview.jsx`. Re-checked
   after the fix — the heading now computes to `oklch(0.424 0.199
   265.638)` / `30px` / `700`, matching the `text-3xl font-bold
   text-blue-800` classes on the element.

## What's in `.storybook/main.js`

```js
const config = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp"
  ],
  framework: "@storybook/react-vite"
}
```

The addons that matter day-to-day:

- **`addon-vitest`** — turns every story into a Vitest test (see below).
  This is the big one.
- **`addon-a11y`** — runs an automated accessibility scan against every
  story and surfaces violations in the addon panel.
- **`addon-docs`** — auto-generates a docs page per component from
  props/JSDoc.

## The Vitest integration — stories are tests now

The installer added a second Vitest "project" to `vite.config.js`
alongside the existing jsdom unit-test project:

```js
test: {
  projects: [
    { extends: true, test: { environment: 'jsdom', setupFiles: './src/tests/setup.js' } },
    {
      extends: true,
      plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
      test: {
        name: 'storybook',
        browser: { enabled: true, headless: true, provider: playwright({}), instances: [{ browser: 'chromium' }] }
      }
    }
  ]
}
```

This means `npm run test:run` (and the plain Vitest CLI) now runs stories
as real assertions in a headless Chromium instance, not just the jsdom
component tests — `npx vitest run` currently reports **3 test files, 11
tests** (8 jsdom unit tests + 3 story-driven browser tests: `Empty`,
`Loaded`, `ErrorState`).

## The Weather story file

`Weather` fetches through `@tanstack/react-query`, so every story needs
its own `QueryClientProvider` (a shared one across stories would leak
cached results):

```jsx
const withQueryClient = (Story) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}><Story /></QueryClientProvider>
}

export default {
  title: 'Weather',
  component: Weather,
  decorators: [withQueryClient],
  parameters: { layout: 'fullscreen' }
}
```

Three stories, using CSF3 `play` functions (from `storybook/test`) to
drive the UI the same way a user would, since `Weather` only fetches
after a search is triggered — there's nothing interesting to show on
mount alone:

- **`Empty`** — no play function, just the initial render.
- **`Loaded`** — types a city, clicks Search, and overrides
  `api.get` (the shared axios instance) to resolve with sample data, then
  asserts the weather card renders.
- **`ErrorState`** — same interaction, but `api.get` is overridden to
  reject, asserting the red error banner appears.

```jsx
export const Loaded = {
  play: async ({ canvasElement }) => {
    api.get = async () => ({ data: sampleWeather })
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByPlaceholderText('Enter city name...'), 'London')
    await userEvent.click(canvas.getByRole('button', { name: /search/i }))
    await waitFor(() => expect(canvas.getByText('London')).toBeInTheDocument())
  }
}
```

## Running it

```bash
cd weather-app/client
npm run storybook        # dev server at http://localhost:6006
npm run build-storybook  # static export to storybook-static/
npx vitest run           # runs unit tests + story tests headlessly
```

## New things learnt

- **Mocking a real dependency vs. mocking in Vitest are different
  mechanics.** In the jsdom unit tests (`weather.test.jsx`),
  `vi.mock('../api/axiosInstance', ...)` swaps the module before import.
  Storybook stories don't have that hook available in the browser — the
  real `axiosInstance.jsx` module loads as-is. The workaround used here
  is to directly reassign `api.get` at the top of each story's `play`
  function, since the module's default export is a plain mutable object
  (an axios instance), not a frozen one. This is simple but has a real
  gotcha: it's a **shared singleton across every story**, so a later
  story's override persists if you switch stories without a full reload.
  For anything beyond a demo like this, request mocking via MSW
  (Mock Service Worker) would be the safer approach since it intercepts
  at the network layer per-story instead of mutating shared module state.
- **Retry timing bit again, exactly like it did in the Vitest unit
  tests.** The first version of `ErrorState`'s assertion
  (`waitFor(() => expect(...).toBeInTheDocument())`) initially appeared
  to fail when checked manually in the browser immediately after the
  interaction — the DOM still showed no error text yet. `Weather`'s
  `useQuery` has `retry: 1`, so the error only becomes visible after the
  second attempt also fails, which takes an extra beat past the first
  rejection. Waiting a couple more seconds (or trusting `waitFor`'s
  polling, which the actual Vitest assertion already does correctly)
  confirmed it renders fine — this is the same class of bug documented
  in [vitest-testing.md](vitest-testing.md), just observed from the
  interactive Storybook UI instead of a test failure message. This
  eventually did show up as real, intermittent CI flakiness: the
  `ErrorState` story's browser-mode test would pass or fail from run to
  run depending on whether the retry's ~1s backoff finished before
  `waitFor`'s default 1000ms timeout. Fixed by passing `{ timeout: 5000 }`
  to that `waitFor` call, same as the matching fix in the jsdom
  `weather.test.jsx` error-path test.
- **A missing global CSS import is silent, not an error.** Nothing in
  the terminal or browser console indicated Tailwind wasn't loaded —
  the story just rendered with unstyled, browser-default HTML. The only
  way to actually catch this was to inspect a real computed style
  (`getComputedStyle`) rather than trust that "it rendered without
  errors" means "it rendered correctly." A screenshot alone likely would
  have looked plausible-but-wrong at a glance too.
- **`storybook/test` (not `@storybook/test`) is the current import path**
  for `within`, `userEvent`, `expect`, and `waitFor` inside story files
  in this Storybook version — the addon-vitest integration re-exports
  Vitest's own `expect`/browser-mode utilities through it, so assertions
  in `play` functions behave identically to a normal Vitest browser test.
- **The installer's default suggestion (`npx storybook ai setup`) is
  optional AI-agent tooling**, not required for Storybook to function —
  skipped here since the basic dev/build/test workflow already worked
  without it.

## Practical checklist for adding a new story

1. Colocate `ComponentName.stories.jsx` next to the component.
2. If the component needs any React context (query client, router,
   theme), add a `decorators` array in the story's default export rather
   than duplicating providers per story.
3. If the component fetches data only after user interaction, use a
   `play` function to drive that interaction rather than trying to seed
   initial `args`.
4. Run `npx vitest run` before committing — a broken story now fails CI
   the same way a broken unit test does.
