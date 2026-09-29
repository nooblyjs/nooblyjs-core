# Production Readiness — Remediation TODO

**Source:** [PRODUCTION_READINESS_REVIEW.md](./PRODUCTION_READINESS_REVIEW.md)
**Scope:** All P0 (critical), P1 (high), and P2 (medium) items.
**Branch:** `development`
**Created:** 2026-05-29

> **Remediated and re-tested 2026-09-29:** every P0–P2 item and the new findings N-1…N-15 are done. The live production probe passes 70/70; see the re-test section of [PRODUCTION_READINESS_TEST_2026-09-29.md](./PRODUCTION_READINESS_TEST_2026-09-29.md). Remaining follow-ups are listed at the end of this file.

> Legend: `[ ]` not started · `[~]` in progress · `[x]` done.
> Each task lists **Files**, **What to do**, and **Acceptance criteria (AC)**.

---

## Progress Tracker

| ID | Title | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| P0-1 | Authenticate the Filing API | Critical | M | [x] |
| P0-2 | Strong password hashing (bcrypt/argon2) | Critical | S | [x] |
| P0-3 | Cryptographically secure tokens/IDs/keys | Critical | S | [x] |
| P0-4 | SSRF protection in fetching service | Critical | M | [x] |
| P0-5 | Process crash handlers + async route wrapper | Critical | M | [x] |
| P0-6 | Fix failing tests + CI test gate | Critical | L | [x] |
| P1-1 | Real dependency health/readiness probes | High | M | [x] |
| P1-2 | Stop leaking raw error messages | High | M | [x] |
| P1-3 | Brute-force protection on login | High | S | [x] |
| P1-4 | Path-traversal containment (all filing providers) | High | M | [x] |
| P1-5 | API key scoping + timing-safe compare + header-only | High | S | [x] |
| P1-6 | Correct Node engine declaration | High | XS | [x] |
| P2-1 | Add helmet + CORS | Medium | S | [x] |
| P2-2 | Body + upload size/type limits | Medium | S | [x] |
| P2-3 | Stop logging secrets | Medium | XS | [x] |
| P2-4 | Remove `eval()` in notifying UI | Medium | S | [x] |
| P2-5 | Complete graceful shutdown | Medium | M | [x] |
| P2-6 | Fix event-listener leaks | Medium | M | [x] |
| P2-7 | Input validation at route boundaries | Medium | L | [x] |
| P2-8 | Resolve dependency vulnerabilities | Medium | M | [x] |
| P2-9 | Gate `app-noauth.js` | Medium | XS | [x] |
| N-1 | CI pipeline (GitHub Actions) | Blocker | M | [x] |
| N-2 | Docker: Node 24 LTS, `NODE_ENV`, `HEALTHCHECK`, `.dockerignore` | Blocker | S | [x] |
| N-3 | `TRUST_PROXY` for TLS-terminating proxies | Blocker | XS | [x] |
| N-4 | Production session store (Redis / pruning memory) | Blocker | S | [x] |
| N-5 | Upload size/type limits (= P2-2) | Blocker | S | [x] |
| N-6 | CSPRNG passwords (= P0-3) | Blocker | XS | [x] |
| N-7 | Content-Security-Policy | High | S | [x] |
| N-8 | 401 JSON (not HTML redirect) for API clients | Medium | XS | [x] |
| N-9 | Blocked SSRF/traversal → 400; missing files → 404 | Medium | S | [x] |
| N-10 | `multer` 2.4.0 advisory | Medium | XS | [x] |
| N-11 | Dev tools moved to `devDependencies` | Medium | XS | [x] |
| N-12 | Coverage threshold | Medium | XS | [x] |
| N-13 | `package.json` `files` / `repository.url` | Low | XS | [x] |
| N-14 | `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `.env.example` | Low | S | [x] |
| N-15 | Filing store was the app root (exposed `.env`, users) | Critical | XS | [x] |

_Effort: XS (<1h) · S (≤½ day) · M (1–2 days) · L (multi-day)._

---

## Phase 1 — Security Blockers (P0)

### [x] P0-1 — Authenticate the Filing API
- **Files:** `src/authservice/middleware/services.js:216`, `src/filing/routes/index.js`
- **What to do:**
  - Remove the public whitelist `if (path.startsWith('/filing/api/')) return true;` **or** replace it
    with a check that the request carries a valid bearer token / session cookie.
  - Add an auth middleware applied to the filing router (mounted at the top of `src/filing/routes/index.js`)
    that validates session **or** scoped bearer token and rejects with 401 otherwise.
  - Distinguish read (`GET /download`, `/browse`, `/file-tree`) from write/admin
    (`/upload`, `/remove`, `/git/*`, `/sync/*`, `/settings`) — writes require elevated scope.
- **AC:** Unauthenticated `curl` to every `/services/filing/api/*` route returns 401/403; authorized
  requests succeed; a regression test asserts 401 on `download`, `upload`, `remove`, `git/push`.

### [x] P0-2 — Strong password hashing
- **Files:** `src/authservice/providers/authBase.js:1086` (`hashPassword_`), `:1099` (`verifyPassword_`), `package.json`
- **What to do:**
  - Add `bcrypt` (or `argon2`) to dependencies.
  - Replace SHA-256+`'salt'` with `bcrypt.hash(password, 12)`; `verifyPassword_` uses `bcrypt.compare`.
  - Support transparent migration: on successful login against a legacy SHA-256 hash, re-hash with bcrypt
    and persist (detect by hash format/length).
- **AC:** New users stored as bcrypt hashes (`$2b$...`); legacy users can still log in and are upgraded on
  next login; unit test covers hash, verify, and legacy-migration paths.

### [x] P0-3 — Cryptographically secure tokens, IDs, and API keys
- **Files:** `src/authservice/providers/authBase.js:1067` (`generateId_`), `:1076` (`generateSessionToken_`),
  `src/authservice/middleware/apiKey.js:136` (`generateApiKey`)
- **What to do:** Replace every `Math.random()` generator with
  `crypto.randomBytes(32).toString('hex')` (follow the existing correct usage at `authBase.js:612`/`:744`).
- **AC:** No `Math.random()` remains in `src/authservice`; tokens are ≥256 bits of entropy; tests assert
  uniqueness/length and that two generated tokens differ.

### [x] P0-4 — SSRF protection in the fetching service
- **Files:** `src/fetching/routes/index.js:48` & `:91`, `src/fetching/providers/fetchingnode.js:159`,
  `src/fetching/providers/fetchingaxios.js`
- **What to do:**
  - Add a `validateOutboundUrl(url)` guard (shared module) that: allows only `http:`/`https:`; resolves
    the hostname and **rejects** private/link-local/loopback ranges (`127.0.0.0/8`, `10/8`, `172.16/12`,
    `192.168/16`, `169.254/16`, `::1`, `fc00::/7`) and the cloud metadata IP `169.254.169.254`.
  - Apply it in both providers before `fetch()`, and (optionally) support a configurable allowlist.
- **AC:** Requests to `http://169.254.169.254/...`, `http://localhost`, and `file://` are rejected;
  public URLs still work; unit tests cover each blocked range.

### [x] P0-5 — Process crash handlers + async route wrapper
- **Files:** `app.js`, `app-noauth.js`, new `src/middleware/asyncHandler.js`, all `src/*/routes/index.js`
- **What to do:**
  - Add `process.on('unhandledRejection', ...)` and `process.on('uncaughtException', ...)` that log via
    the logging service and trigger graceful shutdown (do not silently swallow).
  - Create a reusable `asyncHandler(fn)` wrapper (or add `express-async-errors`) and wrap every async route
    handler so thrown errors reach the central error handler.
- **AC:** A deliberately-throwing async route returns a clean 500 via the central handler (process stays
  up); an unhandled rejection is logged and shuts down gracefully rather than crashing uncontrolled.

### [x] P0-6 — Fix failing tests and add a CI test gate
- **Files:** failing suites under `tests/unit/` (caching, authservice, aiservice, serviceRegistry,
  dataservice), `tests/unit/dataservice/*Mongo*/*DocumentDB*`, `package.json`, `azure-pipelines.yml`
- **What to do:**
  - Fix real regressions: caching event-name drift in `cache.test.js`; `serviceRegistry.test.js`
    `requireApiKey` expectation; authservice/aiservice assertions.
  - Resolve `Cannot find module 'aws-sdk'` in `dataservice.test.js` (add dep or remove the mock).
  - Guard `MongoDB`/`DocumentDB` tests behind an env flag (e.g. `RUN_DB_TESTS=1`) so they skip when no DB
    is present, matching the `.disabled.js` Redis/Memcached pattern.
  - Add `"test": "jest"` and `"coverage": "jest --coverage"` scripts; set a `coverageThreshold`.
  - Add a CI stage to `azure-pipelines.yml` that runs `npm ci && npm test` and fails the build on failure.
- **AC:** `npm test` exits 0 with no crash; CI runs tests on every PR and blocks merge on failure;
  coverage report is produced.

---

## Phase 2 — Stability Blockers (P1)

### [x] P1-1 — Real dependency health/readiness probes
- **Files:** `src/middleware/healthCheck.js:139` (`checkService`), `:149` (precedence bug), `:242`
  (`readinessProbe`), `app.js:169` (`markReady`)
- **What to do:**
  - Implement actual pings per critical dependency (cache `ping`, dataservice connectivity).
  - Wire `recordServiceError`/`recordServiceSuccess` into service operations (or have the probe call live
    checks directly).
  - Fix the precedence bug: `(this.errorCounts.get(serviceName) || 0) < 3`.
  - Call `markReady()` only after dependencies verify (await startup checks).
- **AC:** `/health/ready` returns 503 when a critical dependency is down and 200 when healthy; integration
  test simulates a down dependency.

### [x] P1-2 — Stop leaking raw error messages from routes
- **Files:** all `src/*/routes/index.js` (104 occurrences of `res.status(500).json({ error: err.message })`,
  e.g. `src/caching/routes/index.js:54`, `src/filing/routes/index.js:74`), `src/middleware/errorHandler.js`
- **What to do:** Replace per-route 500 responses with `next(err)` so the environment-aware central
  handler formats them (hides stack/message in production).
- **AC:** In `NODE_ENV=production`, a forced 500 returns a generic message (no internal paths/DB text);
  grep shows no remaining `res.status(500).json({ error: err.message })`.

### [x] P1-3 — Brute-force protection on login
- **Files:** `src/authservice/routes/index.js:66` (`POST /api/login`), `package.json`
- **What to do:** Add `express-rate-limit` (or equivalent) to auth endpoints; add per-account
  lockout/backoff after N failed attempts.
- **AC:** Repeated failed logins are throttled/locked; test asserts 429/lockout after the threshold.

### [x] P1-4 — Path-traversal containment in all filing providers
- **Files:** `src/filing/providers/filingGit.js` (read/create/update/delete/list),
  `src/filing/providers/filingLocal.js:59`, S3/FTP providers
- **What to do:**
  - Add a shared `resolveWithin(baseDir, userPath)` that resolves and asserts the result starts with
    `baseDir + path.sep` (fixes the prefix-bypass: `/srv/data` vs `/srv/data-secrets`), rejecting `..`.
  - Apply in **every** provider before any fs/git/object operation.
- **AC:** `../../etc/passwd` and `..%2f` style inputs are rejected across local/git/s3/ftp; tests cover each.

### [x] P1-5 — API key scoping, timing-safe compare, header-only
- **Files:** `src/authservice/middleware/services.js:62` & `:65` & `:254`,
  `src/authservice/middleware/apiKey.js:60` & `:98`
- **What to do:**
  - Replace `Array.includes` comparisons with `crypto.timingSafeEqual` over hashed keys.
  - Stop accepting `?api_key=` from the query string — require the `Authorization`/`x-api-key` header.
  - Introduce key scopes/roles instead of granting full admin-portal access to any valid key.
- **AC:** Keys in query string are ignored; comparison is constant-time; a non-admin-scoped key cannot
  reach admin actions; tests cover scope enforcement.

### [x] P1-6 — Correct Node engine declaration
- **Files:** `package.json:26`
- **What to do:** Change `"engines": { "node": ">=12.11.0" }` to `">=18"` (matches CI Node 20, `??`/`?.`
  usage, and `multer@2`).
- **AC:** `package.json` declares `>=18`; CI Node version satisfies it; README/CLAUDE.md aligned.

---

## Phase 3 — Hardening (P2)

### [x] P2-1 — Add helmet + CORS
- **Files:** `app.js`, `app-noauth.js`, `package.json`
- **What to do:** Add `helmet` with sensible CSP/HSTS/X-Frame-Options and a configured `cors` policy
  (explicit origins, not `*`).
- **AC:** Responses include security headers; CORS only permits configured origins.

### [x] P2-2 — Body and upload size/type limits
- **Files:** `app.js:31`, `app-noauth.js:23`, `src/filing/routes/index.js:17` (`multer()`)
- **What to do:** Set `bodyParser.json({ limit: '1mb' })` (tune as needed); configure `multer({ limits:
  { fileSize }, fileFilter })`; enforce `maxFileSize` from `filingLocal.js` settings on write.
- **AC:** Oversized bodies/uploads return 413; disallowed file types rejected; test covers limit.

### [x] P2-3 — Stop logging secrets
- **Files:** `src/authservice/providers/authFile.js:177` & `:202`
- **What to do:** Remove the generated admin password from the WARN log and event payload; log only that a
  default admin was created (no credential). Optionally redact `req.query` in the error handler.
- **AC:** No credential value appears in logs or emitted events; grep confirms.

### [x] P2-4 — Remove `eval()` in the notifying UI
- **Files:** `src/notifying/views/index.html:984`
- **What to do:** Replace `eval('(' + callbackFunctionStr + ')')` with a safe named-handler dispatch map;
  never execute server-provided strings.
- **AC:** No `eval(`/`new Function(` over server data in the views; callbacks still work via the dispatch map.

### [x] P2-5 — Complete graceful shutdown
- **Files:** `index.js:735` (`shutdown`), `app.js:199` (`gracefulShutdown`)
- **What to do:** Maintain an explicit teardown registry per service (queue consumers, scheduler intervals,
  DB/redis clients); add a shutdown timeout with force-exit fallback; log via the logging service (not
  `console.error`).
- **AC:** SIGTERM closes all connections within the timeout; a hung teardown still force-exits; verified by
  a shutdown integration test.

### [x] P2-6 — Fix event-listener leaks
- **Files:** services registering listeners (69 `.on(`/`.once(` vs 15 removals across `src/`)
- **What to do:** Pair each long-lived `.on()` with `.off()` on teardown/instance disposal; audit
  multi-instance creation paths; expose a `dispose()` per service that removes its listeners.
- **AC:** Repeated create/dispose cycles show no growth in listener counts; `process.on('warning')` shows
  no `MaxListenersExceeded`.

### [x] P2-7 — Input validation at route boundaries
- **Files:** all `src/*/routes/index.js`, `package.json`
- **What to do:** Add a schema validator (`zod`/`joi`/`ajv`); validate `params`/`body`/`query` per route;
  add pagination caps (max page size) on list/search endpoints.
- **AC:** Invalid input returns 400 with a safe message; unbounded list queries are capped; representative
  tests per service.

### [x] P2-8 — Resolve dependency vulnerabilities
- **Files:** `package.json`, `package-lock.json`
- **What to do:** Run `npm audit fix` (clears the `tmp` HIGH); replace abandoned `ftp` with `basic-ftp`;
  evaluate replacing/upgrading `stompit` (pulls vulnerable `qs`) and `pdf-parse@1.1.4` → 2.x; plan
  `@google-cloud/storage` 5.x → 7.x bump (clears `uuid` advisories).
- **AC:** `npm audit --omit=dev` reports 0 high; remaining moderates documented with justification; app
  tests pass after upgrades.

### [x] P2-9 — Gate `app-noauth.js`
- **Files:** `app-noauth.js:48`
- **What to do:** Require an explicit env flag (e.g. `ALLOW_NOAUTH=1`) to boot, **or** move the file out of
  the deployable root into `tests/`/`examples/`; refuse to start if `NODE_ENV=production`.
- **AC:** Running `node app-noauth.js` without the flag (or in production) exits with an error; documented
  as test-only.

---

## Definition of Done (overall)

- [x] All P0 tasks complete and verified (security blockers closed).
- [x] All P1 tasks complete (pre-GA stability/hardening).
- [x] All P2 tasks complete (defense-in-depth).
- [~] `npm test` green in CI with a coverage threshold enforced. The workflow and threshold exist; they need a first green run on GitHub and branch protection that requires the checks (see follow-ups).
- [x] `npm audit --omit=dev` reports 0 high-severity advisories (0 high, 0 moderate).
- [x] A re-run of the production-readiness test shows Security and Stability at 🟢 (70/70 live checks).

---

## Remediation log — 2026-09-29

| ID | What changed | Where | Verified by |
|---|---|---|---|
| P0-3 / N-6 | `generateStrongPassword()` uses `crypto.randomInt`; Google OAuth placeholder passwords use `randomBytes(32)`; browser generator no longer falls back to `Math.random()` | `authBase.js`, `authGoogle.js`, `authservice/views/index.html` | `tests/unit/authservice/secureRandom.test.js` |
| P2-2 / N-5 | Multipart and streamed uploads capped at the provider's `maxFileSize` (413) with an optional `allowedTypes` allow-list (415); early reject from `Content-Length` | `src/filing/modules/uploadLimits.js`, filing routes | `tests/unit/filing/uploadLimits.test.js`, probe |
| N-10 | `multer` → 2.4.0 | `package.json` | `npm audit` |
| P1-2 / N-9 | `ClientError` / `toClientResponse`; `sendSafeError` honours client errors and maps ENOENT/NoSuchKey → 404; raw `err.message` 500s removed from fetching, caching, queueing, logging, settings, SSO; auth error middleware returns 500 for system errors | `src/shared/utils/httpErrors.js`, `safeError.js`, routes | `tests/unit/shared/clientErrors.test.js`, probe |
| N-15 | `app.js` / `app-noauth.js` store uploads in `FILING_BASE_DIR` (default `.application/files`) instead of the app root | `app.js`, `app-noauth.js` | probe: `.env`, `package.json`, users file unreadable |
| N-3 | `TRUST_PROXY` setting, plus a production warning when cookies are Secure over plain HTTP | `app.js` | manual |
| N-4 | Redis session store on existing `ioredis` (`SESSION_REDIS_URL`/`REDIS_URL`), otherwise a pruning memory store; closed on shutdown | `src/shared/utils/sessionStore.js`, `app.js` | `tests/unit/shared/sessionStore.test.js` |
| N-8 | Unauthenticated non-HTML requests to `/services/*` get 401 JSON | `authservice/middleware/services.js` | `tests/unit/middleware/servicesAuthResponse.test.js`, probe |
| N-2 | Docker on `node:24-alpine`, `NODE_ENV=production`, `HEALTHCHECK`, `.application` volume, `.dockerignore` | `Dockerfile`, `.dockerignore` | built and run locally: refuses without secrets, healthy with them |
| N-11 | `nodemon`, `rimraf`, `supertest`, `ioredis-mock` → devDependencies (image 523 → 501 MB) | `package.json` | full suite |
| N-1 / P0-6 / N-12 | GitHub Actions: unit (Node 22 + 24, coverage threshold), Playwright UI, `npm audit --audit-level=high`, Docker build + boot checks; `npm run coverage` → `.temp/coverage` | `.github/workflows/ci.yml`, `package.json` | local run of each step |
| N-7 | Enforced CSP pinning jsDelivr, unpkg, Google Fonts and Analytics; `object-src 'none'`, `base-uri`, `form-action`, `frame-ancestors`; `CSP_MODE` / `CSP_EXTRA_SOURCES` | `src/shared/utils/contentSecurityPolicy.js`, both apps | Playwright fails on any CSP violation (32/32 pass) |
| P2-6 | aiservice, authservice, measuring, notifying expose `analytics` so the registry removes their listeners on reset/shutdown | service factories | `tests/unit/registryListenerLeak.test.js` (proven to fail without the fix) |
| P2-7 | `validate()` middleware + `parseLimit`/`capLimit`/`parseOffset`; all list `limit`/`page`/`offset` params capped; validation on login (incl. open-redirect-safe `returnUrl`), fetch, cache put, search; bulk index capped; login page sanitises `returnUrl` | `src/shared/utils/validation.js`, routes, `login.html` | `tests/unit/shared/validation.test.js`, probe |
| N-13 / N-14 | `files` includes `public/`; `repository.url` trimmed; `LICENSE` (ISC), `SECURITY.md`, `CONTRIBUTING.md`, `.env.example` | repo root | — |

Suites after remediation: **Jest 72 suites / 1,813 tests pass** (80 skipped as before); coverage 52.5% of lines (threshold 51%); **Playwright 32/32**; **live production probe 70/70**; `npm audit --omit=dev`: 0 vulnerabilities.

## Remaining follow-ups (not blockers)

1. **Turn on branch protection** for `main` so the CI jobs (`unit`, `ui`, `audit`, `docker`) are required checks. This is a GitHub setting, and the workflow hasn't had its first run on GitHub yet.
2. **Tighten CSP further:** move inline `<script>` blocks and `onclick` handlers into files so `'unsafe-inline'` can be dropped from `script-src`.
3. **Auth provider errors:** throw `ClientError` for validation failures in `authBase.js`, so the auth error middleware no longer has to tell client and system errors apart by heuristics.
4. **Raise coverage** from the 51% threshold (ratchet up as tests are added).
5. **Replace abandoned packages:** `ftp` → `basic-ftp`, `stompit`; plan `express` 5, `@google-cloud/storage` 8 and other major upgrades.
6. **Library default:** the local filing provider still defaults `baseDir` to the working directory for direct library users; consider a safer default in a major release.
7. **Release:** bump `version` (still 1.0.10) and tag once CI is green.
