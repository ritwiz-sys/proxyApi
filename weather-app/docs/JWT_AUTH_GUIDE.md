# JWT Authentication & Favorite Cities — Guide

This adds accounts to the [Weather Dashboard](weather-dashboard.md): sign up,
log in, and your city list follows you across devices instead of living only
in one browser's `localStorage`. This doc exists so that six months from now,
whoever reads it (possibly you) understands *why* each piece is built the way
it is, not just what the code does.

## 1. Why JWT authentication (the problem it solves)

Before this change, `useCities` (now folded into `useFavoriteCities`'s
unauthenticated branch) stored favorite cities in `localStorage` under the
key `dashboard_cities` — see [useFavoriteCities /
localStorage](weather-dashboard.md#usefavoritecities--localstorage) in the
dashboard doc. That works, but it has a hard ceiling: `localStorage` is scoped to one
browser on one device. Clear your browser data, switch to your phone, or use
a different computer, and your city list is gone. There was no concept of
"a user" at all — every visitor was anonymous and their data lived only on
their machine.

The problem to solve: let a person prove who they are on one request, then
have every *subsequent* request already know who they are, without the
server having to remember anything about them in between. That last part —
the server remembering nothing — is what pushed this toward JWTs instead of
traditional server-side sessions.

**Sessions vs. tokens, concretely for this app:**
- A session-based approach would have the server generate a random session
  ID at login, store `{ sessionId → userId }` in memory or a session table,
  and hand the browser a cookie with that ID. Every request, the server
  looks up the session table to find out who's asking.
- A JWT-based approach has the server sign a small package of claims
  (`{ userId, email, username }`) at login and hand it to the client. Every
  request, the client sends the token back, and the server just
  *verifies the signature* — no database lookup, no server-side state at
  all. The token **is** the proof.

Given this backend is deployed on Render (see [Render + Netlify
setup](weather-dashboard.md)) as a single small Node process with no
dedicated session store, statelessness is the practical win: nothing to
provision, nothing that gets wiped on a redeploy or a cold start, and the
same approach scales to multiple backend instances later without needing
shared session storage.

The tradeoff, to be upfront about it: a JWT can't be "revoked" the way a
server-side session can — once issued, it's valid until it expires, even if
you'd want to invalidate it early (see [Security
considerations](#11-security-considerations)). That's an accepted tradeoff
here given the 7-day expiry and the low stakes of this app (no payment data,
no PII beyond an email/username).

## 2. How JWT works (header.payload.signature)

A JWT is three base64url-encoded segments joined by dots:

```
eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6ImFAYi5jb20ifQ.4f8a...
└──────── header ────────┘└──────────── payload ────────────┘└─ signature ─┘
```

- **Header** — algorithm + token type: `{ "alg": "HS256", "typ": "JWT" }`.
  `HS256` means HMAC-SHA256, a *symmetric* algorithm — the same secret both
  signs and verifies. This matters: it's why `JWT_SECRET` must never leak
  (see [Security considerations](#11-security-considerations)) — anyone with
  it can forge a valid token for any user.
- **Payload** — the claims. In this app: `{ userId, email, username, iat,
  exp }` (`iat`/`exp` — issued-at and expiry — are added automatically by
  `jsonwebtoken` when you pass `expiresIn`). The payload is **not
  encrypted** — it's just base64, readable by anyone who has the token
  (paste one into jwt.io and you'll see your own email in plain text). Never
  put a password or anything secret in the payload.
- **Signature** — `HMAC-SHA256(base64(header) + "." + base64(payload),
  JWT_SECRET)`. This is the only part that requires the secret. It doesn't
  hide the payload; it proves the payload hasn't been tampered with since
  the server signed it. Change a single character of the payload and the
  signature no longer matches — `jwt.verify()` rejects it.

`server/middleware/auth.ts` does exactly this verification:

```ts
const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthTokenPayload
```

If the signature doesn't match, or the token is past its `exp`, `jwt.verify`
throws — caught in the `catch` block and turned into a `401`.

## 3. Signup flow — step by step

`POST /api/auth/signup` (`server/server.ts`), given `{ email, username,
password }`:

1. **Validate presence and shape.** All three fields required; email must
   match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; password must be ≥ 6 characters.
   Rejected requests never reach the database — cheaper to fail fast, and it
   means a malformed request can't produce a half-written row.
2. **Check for an existing account:**
   ```ts
   const { data: existing } = await supabase
     .from('users').select('id').eq('email', email).maybeSingle()
   if (existing) { res.status(409).json({ error: 'Email already registered' }); return }
   ```
   `maybeSingle()` (not `single()`) is deliberate — `single()` throws if zero
   rows come back, which would turn "this email is free" into a caught
   error. `maybeSingle()` returns `null` cleanly instead.
3. **Hash the password** — `bcrypt.hash(password, 10)`. See [bcrypt](#6-bcrypt--what-it-is-and-why-password-hashing-matters)
   for why this step exists and what `10` means.
4. **Insert the user**, selecting back only the safe columns:
   ```ts
   const { data: user } = await supabase
     .from('users')
     .insert({ email, username, password: hashedPassword })
     .select('id, email, username')   // never select password back
     .single()
   ```
5. **Sign a JWT** with a 7-day expiry:
   ```ts
   const token = jwt.sign(
     { userId: user.id, email: user.email, username: user.username },
     process.env.JWT_SECRET!,
     { expiresIn: '7d' }
   )
   ```
6. **Respond `201`** with `{ token, user }`. The client stores the token
   immediately — see [Frontend auth flow](#9-frontend-auth-flow).

## 4. Login flow — step by step

`POST /api/auth/login`, given `{ email, password }`:

1. **Validate presence** of both fields (`400` if missing).
2. **Look up the user by email**, this time selecting the password hash too
   (needed for the compare step, never for the response):
   ```ts
   const { data: user } = await supabase
     .from('users').select('id, email, username, password')
     .eq('email', email).maybeSingle()
   if (!user) { res.status(404).json({ error: 'User not found' }); return }
   ```
3. **Compare the submitted password against the stored hash:**
   ```ts
   const passwordMatches = await bcrypt.compare(password, user.password)
   if (!passwordMatches) { res.status(401).json({ error: 'Invalid password' }); return }
   ```
   `bcrypt.compare` re-hashes the submitted password with the *same salt*
   that's embedded in the stored hash and checks for a match — it never
   "decrypts" the stored hash, because hashing isn't reversible (see
   [bcrypt](#6-bcrypt--what-it-is-and-why-password-hashing-matters)).
4. **Sign the same shape of JWT** as signup, and respond with `{ token,
   user: { id, email, username } }` — explicitly re-built without the
   `password` field, so there's no path where a hash accidentally leaks
   into a response even if the earlier `select` changes later.

## 5. Protected routes — how the middleware works

`server/middleware/auth.ts` exports `authenticate`, used as Express
middleware on every route that needs to know who's asking:

```ts
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  const token = header.slice('Bearer '.length)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthTokenPayload
    req.user = { id: payload.userId, email: payload.email, username: payload.username }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
```

Two distinct failure modes, both `401` but for different reasons: no
`Authorization` header at all (never logged in / token never sent) vs. a
header that's present but fails `jwt.verify` (expired, tampered, or signed
with a different secret — e.g. a stale token from before `JWT_SECRET` was
rotated).

`req.user` is attached via TypeScript **declaration merging** — the
middleware file augments Express's own `Request` interface:

```ts
declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}
```

This is what lets every downstream route handler write `req.user!.id` with
full type-checking, instead of `(req as any).user.id`. It's flagged by
`@typescript-eslint/no-namespace` (namespaces are generally discouraged in
favor of ES modules) but this is the one place that rule doesn't apply —
augmenting an *external* module's own namespace is the documented way to do
this in TypeScript, so it's silenced with a scoped `eslint-disable-next-line`
rather than turning the rule off project-wide.

Route ordering matters: `authenticate` always runs *before* the route
handler in the middleware chain (`app.get('/api/auth/me', ipRestriction,
authenticate, handler)`), so by the time a handler body executes, `req.user`
is guaranteed to be set — that's what makes `req.user!.id` (non-null
assertion) safe rather than reckless.

## 6. bcrypt — what it is and why password hashing matters

Storing a password as plain text means anyone with read access to the
`users` table — a leaked backup, a compromised service-role key, a curious
employee — has every user's real password immediately. Because people reuse
passwords across sites, that's not just a breach of this app; it's a breach
of every other account that shares the password.

**Hashing** turns a password into a fixed-length string that's practically
impossible to reverse. `bcrypt.hash(password, 10)`:
- Generates a random **salt** and mixes it into the hash, so two users with
  the same password (`"password123"`) get *different* stored hashes. Without
  a salt, an attacker could precompute hashes for common passwords once
  (a "rainbow table") and match them instantly against every row.
- The `10` is the **cost factor** — it tells bcrypt to run its internal hash
  function 2¹⁰ (1024) times. This is deliberate slowness: a fast hash
  (like plain SHA-256) can be brute-forced at billions of guesses/second on
  modern hardware; bcrypt's cost factor caps that at a few hundred
  guesses/second even for an attacker with the stolen hash in hand. `10` is
  the current practical default — high enough to matter, low enough that a
  real login (one hash operation) still completes in well under 100ms.

The stored value already contains the algorithm, cost factor, and salt, all
readable in the string itself (`$2a$10$N9qo8uLOickgx2ZMRZoMye...`) — that's
why `bcrypt.compare(password, storedHash)` can re-derive the same salt and
verify a match without the app ever needing to store the salt separately.

## 7. Database schema

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE favorite_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  city_name TEXT NOT NULL,
  country TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lon FLOAT NOT NULL,
  added_at TIMESTAMP DEFAULT now()
);
```

Design choices worth calling out:
- **`UUID` primary keys, not auto-increment integers.** UUIDs are
  unguessable and safe to expose in a URL (`DELETE
  /api/cities/favorites/:id`) — an integer ID leaks how many rows exist and
  invites enumeration (`/favorites/1`, `/favorites/2`, ...).
- **`email TEXT UNIQUE NOT NULL`** — the uniqueness constraint is enforced
  by the database itself, not just the app-level `maybeSingle()` check in
  the signup route. That check-then-insert has a theoretical race (two
  signups for the same email landing between the check and the insert), and
  the `UNIQUE` constraint is what actually closes that gap — a concurrent
  duplicate insert would fail at the database level even if both requests
  passed the app-level check.
- **`user_id UUID REFERENCES users(id) ON DELETE CASCADE`** — deleting a
  user automatically deletes their favorite cities. Without `CASCADE`,
  deleting a user would either fail (foreign key violation) or leave orphaned
  rows pointing at a `user_id` that no longer exists.
- **No `UNIQUE` constraint on `(user_id, lat, lon)`.** Duplicate-favorite
  prevention is handled at the application layer instead (`POST
  /api/cities/favorites` checks for an existing `lat`/`lon` pair for that
  user before inserting, returning `409` if found) — see [API routes
  reference](#8-api-routes-reference). A database constraint would be more
  airtight against races, but the app-level check was sufficient here and
  keeps the schema simple; if this ever needs to be race-proof, add `UNIQUE
  (user_id, lat, lon)` and let the resulting constraint-violation error map
  to the same `409`.

## 8. API routes reference

All routes below sit behind the same `ipRestriction` middleware as the
existing weather routes (see [Backend —
server/server.ts](weather-dashboard.md#backend--serverserverts)); routes
marked **Auth required** additionally require `authenticate`.

| Method | Route | Auth required | Body | Success | Failure |
|---|---|---|---|---|---|
| POST | `/api/auth/signup` | No | `{ email, username, password }` | `201 { token, user }` | `400` missing/invalid fields, `409` email taken |
| POST | `/api/auth/login` | No | `{ email, password }` | `200 { token, user }` | `400` missing fields, `404` no such user, `401` wrong password |
| GET | `/api/auth/me` | Yes | — | `200 { id, email, username }` | `401` missing/invalid token |
| GET | `/api/cities/favorites` | Yes | — | `200 FavoriteCity[]` | `401` |
| POST | `/api/cities/favorites` | Yes | `{ city_name, country, lat, lon }` | `201 FavoriteCity` | `400` missing fields, `409` duplicate lat/lon for this user, `401` |
| DELETE | `/api/cities/favorites/:id` | Yes | — | `200 { success: true }` | `404` not found *or* not yours, `401` |

`user` in signup/login responses is always `{ id, email, username }` — never
`password`, regardless of what the underlying Supabase `select()` happens to
include (see [Security considerations](#11-security-considerations)).

`DELETE /api/cities/favorites/:id` returning the *same* `404` whether the
city doesn't exist or belongs to a different user is intentional — see
[ownership checks](#11-security-considerations) below.

Signup and login additionally share `authLimiter` — 20 requests per 15
minutes per IP — separate from the weather routes' own limiters, to slow
down credential-stuffing / brute-force attempts against `/api/auth/login`
specifically.

## 9. Frontend auth flow

**Token storage** — `client/src/hooks/useAuth.ts` stores the JWT in
`localStorage` under `weather_auth_token` (the constant `AUTH_TOKEN_KEY` is
exported from `client/src/api/axiosInstance.ts`, so both files reference the
exact same string rather than risking drift between two hardcoded copies).

**Attaching it automatically** — `axiosInstance.ts` adds a *request*
interceptor (new; the file previously only had a response interceptor for
converting `429`/`403`/timeout errors — see [axiosInstance.ts](weather-dashboard.md)):

```ts
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

This means every call through the shared `api` instance — weather lookups,
city search, favorites — automatically carries the token once one exists,
without every call site needing to remember to attach it. Unauthenticated
users simply never have a token in storage, so the header is never added,
and the *unprotected* routes (weather, search) never cared about it anyway.

**Verifying a stored token on load** — on mount, `useAuth` checks for a
stored token and, if present, calls `GET /api/auth/me` to confirm it's still
valid (not expired, not signed with a rotated secret) and to fetch the
current user data:

```ts
useEffect(() => {
  const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)
  if (!storedToken) { setIsLoading(false); return }
  api.get<AuthUser>('/api/auth/me')
    .then(({ data }) => { setToken(storedToken); setUser(data) })
    .catch(() => localStorage.removeItem(AUTH_TOKEN_KEY))
    .finally(() => setIsLoading(false))
}, [])
```

A stale/expired token is removed from storage on this check, rather than
kept around to fail again on every future request.

**Error messages** — the response interceptor in `axiosInstance.ts` only
special-cases `429`/`403`/timeout; a `409` (email taken) or `401` (wrong
password) passes through as a raw `AxiosError`. `useAuth`'s `signup`/`login`
extract the actual message the server sent (`error.response.data.error`)
and re-throw a plain `Error` with that text, which is what `AuthModal`
displays inline rather than a generic "Request failed with status code 409".

## 10. Migration logic — localStorage to database

The requirement: a returning anonymous user who already has cities saved
locally shouldn't lose them the moment they create an account. `useFavoriteCities.ts`
owns this, triggered by a `useEffect` watching the `isAuthenticated` flag
passed down from `useAuth`:

```ts
useEffect(() => {
  if (!isAuthenticated) { setCities(loadLocalCities()); return }

  const migrateThenLoad = async () => {
    if (!hasMigrated.current) {
      hasMigrated.current = true
      const localCities = loadLocalCities()
      for (const city of localCities) {
        try {
          await api.post('/api/cities/favorites', { city_name: city.name, ...city })
        } catch { /* duplicate or transient failure — skip, don't block the rest */ }
      }
      if (localCities.length > 0) localStorage.removeItem(STORAGE_KEY)
    }
    await fetchFavorites()
  }
  migrateThenLoad()
}, [isAuthenticated])
```

Walking through it: the moment `isAuthenticated` flips from `false` to
`true` (right after a successful login or signup), this effect reads
whatever's in `dashboard_cities`, `POST`s each one individually, then clears
the local key and fetches the authoritative list back from the database.
`hasMigrated` (a ref, not state) ensures this only runs once per session —
without it, any re-render that re-triggers the effect while already
authenticated would try to re-migrate an already-empty local list on every
render, which is harmless but wasteful.

Each `POST` is wrapped in its own `try/catch` **inside** the loop, not
around the whole loop — one city already existing as a favorite (`409`, e.g.
the user had added it locally once before on another device *and* it's
already synced) shouldn't abort the migration of the rest. A failed city is
simply dropped rather than retried; the tradeoff is that a transient network
blip during migration silently loses that one city, versus the alternative
of surfacing a partial-failure error to the user mid-login, which would be a
worse experience for what should be a background, seamless upgrade.

**Reconciling two different `City` shapes** — the pre-existing `City` type
(camelCase, client-derived `id`) and the database's `FavoriteCity` row
(snake_case, a real UUID `id`) aren't the same shape. Rather than touch
`CityCard`/`ComparisonTable`/`SearchBar` (which all already expect the
original `City` shape), `useFavoriteCities` maps every database row through
`toCity()` back into that same shape, and separately tracks the *real*
database id in a `dbIdMap` ref (`slug id → uuid`) purely so `removeCity(id)`
can resolve the right row to `DELETE`. Every component downstream of this
hook is unaware anything about storage changed at all — this is the same
reason `removeCity`/`addCity` keep the exact same call signature as the old
`useCities`, just now `async`.

## 11. Security considerations

- **Passwords are never returned in any response.** Every `select()` that
  touches the `users` table either omits `password` entirely
  (`select('id, email, username')`) or, in login's case where the hash is
  needed for `bcrypt.compare`, the response is explicitly rebuilt as `{ id,
  email, username }` before sending — never `res.json(user)` on the raw row.
- **Input validation happens before any database call** — email format,
  password length (≥ 6), and required-field checks all happen synchronously
  at the top of each handler, so a malformed request can't reach Supabase at
  all, let alone produce a partial write.
- **JWT expiry is 7 days**, set via `jwt.sign(..., { expiresIn: '7d' })` —
  long enough that a user isn't annoyingly logged out mid-week, short enough
  that a leaked token has a bounded lifetime. There's no refresh-token flow
  here (that would be the next thing to add if sessions needed to last
  longer without forcing a full re-login).
- **Ownership checks on every mutation.** `GET`/`POST`/`DELETE
  /api/cities/favorites*` all filter by `.eq('user_id', req.user!.id)` —
  never by a client-supplied user id. Concretely for `DELETE
  /api/cities/favorites/:id`: the query is `.eq('id', req.params.id).eq('user_id',
  req.user!.id)`, so attempting to delete someone *else's* city (a guessed
  or leaked UUID) matches zero rows and returns the same `404` as a
  genuinely nonexistent id — this is deliberate. Returning a distinct
  "403 Forbidden — not your city" would confirm to an attacker that the id
  *exists* and belongs to someone else; a uniform `404` reveals nothing
  either way.
- **The Supabase client uses the service-role key**, which bypasses Row
  Level Security entirely (see `server/lib/supabase.ts`). That's
  intentional here — this app has no Supabase Auth / RLS policies set up;
  the Express layer *is* the entire authorization boundary. This only holds
  as long as the service-role key never reaches the frontend (it doesn't —
  it's `server`-only, loaded from `.env`, never sent in any API response)
  and the server's own `authenticate`/ownership checks stay correct. If this
  app ever added RLS policies directly in Supabase, the service-role key
  would silently bypass every one of them — worth remembering before adding
  policies later and assuming they're being enforced.
- **`JWT_SECRET` compromise is total.** Because `HS256` is symmetric, anyone
  with `JWT_SECRET` can mint a token for *any* `userId` without ever
  touching the database or knowing a single password — `jwt.sign({ userId:
  'anyone' }, JWT_SECRET)` is all it takes. It must never be committed,
  logged, or exposed in a client bundle. It lives in `server/.env`
  (gitignored) locally and must be set as a Render environment variable in
  production, never inlined into source.
- **Rate limiting on auth routes** (`authLimiter`, 20 requests / 15 min /
  IP) exists specifically to slow down brute-force password guessing against
  `/api/auth/login` — the weather routes' rate limiters exist for a
  different reason (protecting the OpenWeatherMap/Weatherstack API quotas),
  so a dedicated limiter was added rather than reusing theirs.

## 12. Common errors and solutions

**`Could not find the table 'public.users' in the schema cache`** — the SQL
schema (section 7) hasn't been run yet in the Supabase SQL editor. The
Supabase JS client can't create tables itself; this is a one-time manual
step, confirmed via `curl` against the PostgREST endpoint during development
of this feature (`GET .../rest/v1/users` returned exactly this error before
the schema existed).

**`401 Invalid or expired token` on every request, right after it worked
before** — most often `JWT_SECRET` changed (e.g. rotated after being
accidentally exposed) while old tokens signed with the previous secret are
still in someone's `localStorage`. Those tokens are permanently invalid the
moment the secret changes — there's no grace period, since verification is
purely a signature check against the *current* secret. The fix from the
user's side is just logging in again.

**`500` from any `/api/auth/*` or `/api/cities/favorites*` route with no
useful message client-side** — check the server's own console/logs first;
every route logs the underlying error (`console.error('Signup insert
error:', ...)` etc.) before returning a generic `{ error: "Something went
wrong" }` to the client. A `401`-shaped error *from Supabase itself* here
almost always means `SUPABASE_SERVICE_KEY` is wrong or missing — distinct
from the app's own `401`s, which come from `authenticate` rejecting the
*client's* JWT, not Supabase rejecting the *server's* credentials to itself.

**Signup/login works locally but fails once deployed** — `JWT_SECRET`,
`SUPABASE_URL`, and `SUPABASE_SERVICE_KEY` all need to be set as environment
variables on Render directly; they only exist in `server/.env` locally,
which is gitignored and never deployed.

**`SUPABASE_URL` pointing at the dashboard URL instead of the API URL** —
`https://supabase.com/dashboard/project/<ref>` is where you *manage* the
project in a browser; the value the `@supabase/supabase-js` client actually
needs is the project's API endpoint, `https://<ref>.supabase.co`. Passing
the dashboard URL doesn't error immediately — the client happily constructs
request URLs against the wrong host — but every request fails to resolve or
returns HTML instead of JSON.

## 13. Interview Q&A — JWT fundamentals

**1. Why use JWT instead of server-side sessions?**
Statelessness — the server verifies a signature instead of looking up
session state on every request, so there's nothing to keep in memory or a
session store, and no single point of failure if that store goes down. The
tradeoff is losing easy server-side revocation (see Q4).

**2. Is the JWT payload encrypted?**
No — it's base64-encoded, not encrypted, and trivially decodable by anyone
(paste one into jwt.io). The signature guarantees *integrity* (it hasn't
been tampered with), not *confidentiality*. Never put secrets in the
payload.

**3. What actually stops someone from editing the payload and re-sending
it?**
The signature. Editing even one character of the payload changes what
`HMAC-SHA256(header + payload, secret)` produces, so the recomputed
signature on verify no longer matches the one attached to the token, and
`jwt.verify` throws.

**4. How do you log a user out / revoke a JWT before it expires?**
You mostly can't, not purely server-side — that's the core tradeoff of
statelessness. The client can delete its copy (what this app's `logout()`
does), but the token itself stays cryptographically valid until `exp` if
someone else still has a copy. True server-side revocation needs added
state — a denylist of revoked token IDs, or a `tokenVersion` column on the
user checked against the token's payload on every verify — which brings
back exactly the per-request database lookup JWTs were meant to avoid.

**5. Why hash passwords with bcrypt instead of SHA-256?**
Speed, inverted: SHA-256 is *designed* to be fast, which is exactly wrong
for passwords — it lets an attacker with a stolen hash try billions of
guesses per second. bcrypt's cost factor makes each attempt deliberately
slow (see section 6), and it salts automatically, so identical passwords
never produce identical stored hashes.

**6. What's the difference between authentication and authorization, and
where does each happen in this app?**
Authentication is proving *who you are* — `authenticate` verifying the JWT
signature and populating `req.user`. Authorization is *what you're allowed
to do* — the `.eq('user_id', req.user!.id)` filter on every favorites query,
ensuring a valid, authenticated user still can't touch another user's rows.
A request can pass authentication and still fail authorization.

**7. Why does `/api/cities/favorites/:id` return 404 instead of 403 for a
city that belongs to someone else?**
To avoid confirming the resource exists at all. A `403` says "this exists,
and it's not yours" — a `404` says nothing distinguishable from "this
doesn't exist." Leaking existence is a smaller information disclosure than
a password, but it's still unnecessary information to hand an attacker
probing IDs.

**8. Where should a JWT be stored on the client — localStorage, or a
cookie?**
Both have a classic tradeoff. `localStorage` (used here) is vulnerable to
XSS — any script that runs on your page can read it. An `httpOnly` cookie
can't be read by JavaScript at all, closing that hole, but opens up CSRF
instead, and needs `SameSite`/CSRF-token handling to close *that*.
`localStorage` was the pragmatic choice here given this is a simple SPA with
no cookie-based session infrastructure already in place, and the app has no
particularly sensitive data behind the login besides a city list.

**9. What happens if `JWT_SECRET` is different between two server
instances?**
A token signed by instance A fails verification on instance B — the
signatures are computed with different keys, so they simply won't match.
This is why `JWT_SECRET` must be a single shared environment variable
(Render config, not a local default baked into code) if this app ever ran
as more than one instance.

**10. Why `expiresIn: '7d'` instead of, say, 1 hour or no expiry at all?**
No expiry means a leaked token is valid forever — unacceptable. A very
short expiry (an hour) would need a refresh-token flow to avoid constantly
forcing re-logins, which is real added complexity this app doesn't
otherwise need. Seven days is a middle ground: bounded blast radius for a
leaked token, without needing refresh tokens for a low-stakes app where
being logged out occasionally and logging back in is a mild inconvenience,
not a broken experience.

## Verification performed

- `tsc --noEmit` (server) and `tsc -b --noEmit` (client) — clean
- `eslint .` in both packages — clean. Along the way, fixed two pre-existing
  bugs unrelated to auth but that blocked verifying it: `client/eslint.config.js`
  had its `ignores` list nested inside a `files`-scoped block, so flat
  config's earlier, unscoped rule sets (`js.configs.recommended`,
  `tseslint.configs.recommended`) were never actually excluding `dist/` —
  moved to a standalone leading `{ ignores: [...] }` object, which is what
  flat config requires for a true global ignore. Separately, `vitest`'s
  jsdom environment stubs `localStorage` as an empty plain object with no
  working methods at all (confirmed by inspecting its prototype chain —
  `Object`, not `Storage`) — added a minimal in-memory `Storage` polyfill to
  `src/tests/setup.ts` via `vi.stubGlobal`.
- `npm run build` (client) — production build succeeds
- Full Vitest suite — 10/10 passing, including new coverage for the
  `axiosInstance` request interceptor (attaches/omits the `Authorization`
  header based on stored token)
- A real bug caught by actually trying to start the server: `lib/supabase.ts`'s
  `createClient(process.env.SUPABASE_URL!, ...)` ran *before*
  `dotenv.config()` had populated `process.env`, because in ESM, static
  imports are fully evaluated — including their own top-level side effects —
  before the importing module's own body runs, regardless of where the
  `import` line sits textually relative to `dotenv.config()`. Fixed by
  moving `dotenv.config()` into its own `server/env.ts`, imported first
  (`import './env.js'`) so it's guaranteed to run before anything that reads
  `process.env` at module-load time.
- End-to-end against the real, live Supabase project (schema created by hand
  in the SQL editor — see [Database schema](#7-database-schema); this tool
  has no way to run DDL itself) and a locally running server:
  - `curl`-level: signup → login → `GET /me` → wrong password (`401`) →
    duplicate email signup (`409`) → favorites with no token (`401`) → add
    city → duplicate add (`409`) → list → delete → re-delete (`404`) — every
    status code and error message matched what's documented above
  - Cross-user ownership: a second account's city could not be deleted by
    the first account's token — `404`, not `403`, per the [ownership
    checks](#11-security-considerations) design, and confirmed it never
    showed up in the first account's own list either
  - Full browser flow: added a city anonymously (confirmed in
    `localStorage`) → signed up → confirmed the city survived, `localStorage`'s
    `dashboard_cities` key was cleared, and the city was independently
    verifiable in Supabase via a direct authenticated fetch (not just
    present in React state) → logged out (city disappears, as expected once
    it's DB-backed and there's no session) → logged back in → city
    reappeared, sourced from the database
  - Cleaned up afterward: deleted the test accounts directly via the
    Supabase REST API, which cascaded to delete their `favorite_cities` rows
    too — incidentally also verifying `ON DELETE CASCADE` on the schema
    actually works as written, not just as read.
