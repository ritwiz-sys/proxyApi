# Weather Dashboard

Converts the single-city Weatherstack lookup (`Weather.tsx`) into a multi-city
dashboard: search for cities, add them to a persisted list, see current
conditions + a 5-day forecast per city, and compare them side by side.
`Weather.tsx` and its Weatherstack route are untouched — this is additive.

## Data source

OpenWeatherMap free tier, called only from the server. Requires
`OPENWEATHER_API_KEY` in `server/.env`. The frontend never sees the key; it
only calls `/api/*`, which Vite proxies to `http://localhost:5000`.

**Note:** a fresh OpenWeatherMap key can take up to ~2 hours after signup to
activate. If `/api/cities/search`, `/api/weather/current`, or
`/api/weather/forecast` return `500` (surfacing as SearchBar's "Couldn't load
suggestions" or CityCard's "Failed to load weather data"), check the server
terminal for the actual upstream error (`Geocoding error: ...` /
`Current weather error: ...`) before assuming it's a code bug — a `401` there
means the key itself is invalid or not yet active, not a routing problem.

## Backend — `server/server.ts`

Three new routes, each behind the existing `ipRestriction` middleware so the
same localhost-only access control applies as the Weatherstack route:

| Route | Upstream | Rate limit |
|---|---|---|
| `GET /api/cities/search?q=` | Geocoding API (`/geo/1.0/direct`) | new `citySearchLimiter` — 20/min |
| `GET /api/weather/current?lat=&lon=` | Current Weather API | existing `weatherLimiter` — 100/15min |
| `GET /api/weather/forecast?lat=&lon=` | Forecast API (`/data/2.5/forecast`, 3-hour steps) | existing `weatherLimiter` |

**Forecast reshaping**: OpenWeatherMap's forecast endpoint returns 3-hour
entries for 5 days (40 entries), not one-per-day. The route groups entries by
calendar day, takes the min/max temp across *all* entries seen for that day
(not just one sample), and picks the entry closest to 12:00 as the
representative icon/description — then returns at most 5 days as a flat
array: `{ date, minTemp, maxTemp, icon, description }[]`. This does the
day-bucketing server-side so the client never touches the raw 3-hour list.

## Frontend

```
client/src/
├── types.ts                    # City, CitySearchResult, CurrentWeather, ForecastDay, AuthUser, FavoriteCity
├── hooks/
│   ├── useFavoriteCities.ts     # DB-backed when authed, localStorage fallback otherwise
│   ├── useAuth.ts               # signup/login/logout, JWT verification on load
│   ├── useDebounce.ts           # generic debounce hook
│   └── useUnit.ts               # localStorage-backed °C/°F preference
├── utils/
│   ├── temperature.ts           # celsiusTo / formatTemp — display-time conversion only
│   └── city.ts                  # toCityId — shared by SearchBar and useFavoriteCities
├── components/
│   ├── SearchBar.tsx            # debounced city search + add
│   ├── CityCard.tsx             # current + forecast for one city
│   ├── ComparisonTable.tsx      # side-by-side table, 2+ cities
│   ├── Dashboard.tsx            # page shell — search, grid, table, empty state, auth UI
│   ├── AuthModal.tsx            # login/signup modal
│   ├── UserMenu.tsx             # username + logout, shown when authenticated
│   └── weather.tsx              # unchanged — old single-city lookup
```

Accounts, JWTs, and the DB-backed favorites list are covered in their own
doc — see [JWT_AUTH_GUIDE.md](JWT_AUTH_GUIDE.md) — since that's a
substantial feature on its own. `useCities.ts` (described below in its
original localStorage-only form) no longer exists as a separate file: its
entire behavior was folded into `useFavoriteCities.ts`'s unauthenticated
branch, so unauthenticated visitors get the exact same experience as
before, with no separate hook to maintain.

Everything is `.tsx`/`.ts` to match the rest of the client, which had already
migrated off `.jsx` before this feature (see
[typescript-migration.md](typescript-migration.md)) — the original spec was
written against `.jsx` filenames, adapted here to fit the codebase as it
actually exists.

### `useFavoriteCities` / localStorage

Key: `dashboard_cities`. Stores only `{ id, name, country, lat, lon,
addedAt }` — never weather data, which is always fetched fresh per the spec.
`id` is derived as `${name}-${country}`.toLowerCase().replace(/\s+/g, '-')`
(`toCityId`, in `utils/city.ts`) so duplicate detection doesn't need a
round-trip. `addCity` resolves to `false` without mutating state if the id
already exists, which `SearchBar` uses to trigger the "already added" toast
instead of silently no-oping.

This is the *unauthenticated* branch of `useFavoriteCities` — once a user
logs in, the same hook switches to fetching/writing through
`/api/cities/favorites` instead, and migrates whatever was in localStorage
into the database exactly once. See [JWT_AUTH_GUIDE.md](JWT_AUTH_GUIDE.md#10-migration-logic--localstorage-to-database)
for the full mechanics.

### `SearchBar`

- Debounces the input 300ms, queries `/api/cities/search` only once the
  debounced value is ≥ 3 characters (`useQuery` `enabled` gate).
- Dropdown states: loading spinner, per-row "Already added" label, inline
  error message if the search request fails, "No cities found" for an empty
  result, click-outside-to-close via a `mousedown` listener on a container
  `ref`.
- Clicking a suggestion always closes the dropdown; if it's a duplicate, a
  toast appears instead of adding a second entry.

### `CityCard`

Two independent queries per city, matching the spec's cache keys exactly so
`ComparisonTable` can share the same cache entries:

```ts
['weather', 'current', city.lat, city.lon]   // staleTime 5 min
['weather', 'forecast', city.lat, city.lon]  // staleTime 30 min
```

Skeleton (`animate-pulse`) while loading, inline error state on failure,
refresh button calls `refetch()` on both queries, remove button calls
`onRemove(city.id)` from the parent.

### `ComparisonTable`

Only renders once `cities.length >= 2`. Uses `useQueries` (not a `.map` of
individual `useQuery` calls, which would violate the rules of hooks as the
city list grows/shrinks) with the *same* `['weather', 'current', lat, lon]`
key as `CityCard`, so adding a comparison table doesn't double the number of
network requests — it reads from the query cache each card already
populated. Highest temperature renders in red, lowest in sky-blue, only when
they actually differ.

### `Dashboard`

Renders the empty state ("Search for a city above to get started") when no
cities are saved, otherwise a responsive grid (1 col mobile → 2 tablet → 3
desktop) of `CityCard`s plus the comparison table below it. A °C/°F toggle
sits top-right of the header (see below) and is passed down to `CityCard`
and `ComparisonTable` as a `unit` prop.

### Temperature unit toggle

`useUnit` (`hooks/useUnit.ts`) mirrors `useCities`'s localStorage pattern —
key `dashboard_unit`, defaults to `'C'` for any missing/invalid stored value.
`Dashboard` owns the toggle UI (a segmented `°C`/`°F` control) and passes
`unit` + `toggleUnit` down; `CityCard` and `ComparisonTable` only receive
`unit` and never write to localStorage themselves.

Conversion happens **only at display time**, via `utils/temperature.ts`:
- `celsiusTo(celsius, unit)` — the raw number, converted if `unit === 'F'`
- `formatTemp(celsius, unit)` — the above, rounded and suffixed (`"72°F"`, `"—"` if `undefined`)

This matters for `ComparisonTable`'s highest/lowest highlighting: `tempClass`
compares the *raw Celsius* values from the query cache (server always fetches
OpenWeatherMap with `units=metric`), then `formatTemp` only converts what's
rendered in the cell. Converting before comparing would still produce the
same min/max under a monotonic conversion like C→F, but keeping raw Celsius
as the single source of truth avoids relying on that assumption holding for
every metric added later (humidity, wind, etc. aren't temperatures and
shouldn't go through this path at all).

Small polish pass alongside the toggle: `CityCard` now shows "Updated Xs/Xm
ago" (from `useQuery`'s `dataUpdatedAt`) and lifts slightly on hover; the
empty state got a `🌤️` icon; `SearchBar`'s input has a `🔍` icon (`pl-10` to
make room, `pointer-events-none` so it doesn't intercept clicks/focus).

## Verification performed

- `tsc -b --noEmit` (client) and `tsc --noEmit` (server) — clean
- `eslint .` in both packages — clean
- `npm run build` (client) — production build succeeds
- Existing Vitest suite (`weather.test.tsx`, `axiosInstance.test.ts`, 8
  tests) — all still pass, unmodified
- Live in-browser check (dev servers on 5000/5173, added a `weather-client`
  entry to `.claude/launch.json` for this):
  - Empty state renders correctly on first load
  - Typed a query, confirmed the debounced request actually hits
    `/api/cities/search` (visible in network log), and that a 500 from the
    upstream (expected — placeholder API key) surfaces the new "Couldn't
    load suggestions" dropdown state, which wasn't there before this check
  - Seeded `localStorage.dashboard_cities` with two cities directly and
    reloaded — confirmed cities load on mount, both `CityCard`s render with
    name/country/refresh/remove, and `ComparisonTable` appears with the
    correct rows
  - Clicked Remove on one city — confirmed it disappears, the comparison
    table correctly unmounts (drops below the 2-city threshold), and
    `localStorage` is updated to match

**Unit toggle + polish pass** — `tsc -b --noEmit` and `eslint` (both clean)
re-run after adding `useUnit`, `utils/temperature.ts`, and wiring `unit`
through `Dashboard`/`CityCard`/`ComparisonTable`. Not yet re-verified live in
a browser — worth a manual click-through of the °C/°F toggle (does every
number update: current temp, feels-like, forecast row, comparison table?)
before considering this fully done.

### A red herring worth recording

Mid-testing, the search dropdown appeared to hang forever with no error and
no loading state. Instrumenting `useQuery`'s return value showed
`fetchStatus: "paused"` — React Query's default `networkMode: 'online'`
pauses retries when its `onlineManager` believes the browser is offline.
`navigator.onLine` reported `true`, but dispatching a synthetic `online`
event un-paused it immediately (one more fetch fired, then it paused again).
This is specific to the sandboxed preview browser's network-state signaling,
not the app — confirmed separately by calling `axiosInstance.get()` directly
from the browser console, which correctly rejected with the real
`AxiosError` every time. No code change was made for this; it's noted here
so it isn't re-investigated as a suspected bug next time.

## Setup

```bash
# server/.env
OPENWEATHER_API_KEY=your_key_here   # replace with a real key from openweathermap.org

cd weather-app/server && npm run dev     # port 5000
cd weather-app/client && npm run dev     # port 5173, proxies /api → :5000
```

Until a real key is set, `/api/cities/search`, `/api/weather/current`, and
`/api/weather/forecast` all return `500 { error: "Something went wrong" }` —
the Weatherstack route (`/api/weather`) is unaffected and keeps working with
its own key.
