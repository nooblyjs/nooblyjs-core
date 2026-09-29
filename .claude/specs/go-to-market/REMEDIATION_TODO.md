# Production Readiness — Remediation TODO

**Source:** [PRODUCTION_READINESS_REVIEW.md](./PRODUCTION_READINESS_REVIEW.md)
**Scope:** All P0 (critical), P1 (high), and P2 (medium) items.
**Branch:** `development`
**Created:** 2026-05-29

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
| P0-6 | Fix failing tests + CI test gate | Critical | L | [ ] |
| P1-1 | Real dependency health/readiness probes | High | M | [x] |
| P1-2 | Stop leaking raw error messages | High | M | [ ] |
| P1-3 | Brute-force protection on login | High | S | [x] |
| P1-4 | Path-traversal containment (all filing providers) | High | M | [x] |
| P1-5 | API key scoping + timing-safe compare + header-only | High | S | [x] |
| P1-6 | Correct Node engine declaration | High | XS | [x] |
| P2-1 | Add helmet + CORS | Medium | S | [x] |
| P2-2 | Body + upload size/type limits | Medium | S | [x] |
| P2-3 | Stop logging secrets | Medium | XS | [x] |
| P2-4 | Remove `eval()` in notifying UI | Medium | S | [x] |
| P2-5 | Complete graceful shutdown | Medium | M | [x] |
| P2-6 | Fix event-listener leaks | Medium | M | [ ] |
| P2-7 | Input validation at route boundaries | Medium | L | [ ] |
| P2-8 | Resolve dependency vulnerabilities | Medium | M | [x] |
| P2-9 | Gate `app-noauth.js` | Medium | XS | [x] |

_Effort: XS (<1h) · S (≤½ day) · M (1–2 days) · L (multi-day)._

---

## Phase 1 — Security Blockers (P0)

### [ ] P0-1 — Authenticate the Filing API
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

### [ ] P0-2 — Strong password hashing
- **Files:** `src/authservice/providers/authBase.js:1086` (`hashPassword_`), `:1099` (`verifyPassword_`), `package.json`
- **What to do:**
  - Add `bcrypt` (or `argon2`) to dependencies.
  - Replace SHA-256+`'salt'` with `bcrypt.hash(password, 12)`; `verifyPassword_` uses `bcrypt.compare`.
  - Support transparent migration: on successful login against a legacy SHA-256 hash, re-hash with bcrypt
    and persist (detect by hash format/length).
- **AC:** New users stored as bcrypt hashes (`$2b$...`); legacy users can still log in and are upgraded on
  next login; unit test covers hash, verify, and legacy-migration paths.

### [ ] P0-3 — Cryptographically secure tokens, IDs, and API keys
- **Files:** `src/authservice/providers/authBase.js:1067` (`generateId_`), `:1076` (`generateSessionToken_`),
  `src/authservice/middleware/apiKey.js:136` (`generateApiKey`)
- **What to do:** Replace every `Math.random()` generator with
  `crypto.randomBytes(32).toString('hex')` (follow the existing correct usage at `authBase.js:612`/`:744`).
- **AC:** No `Math.random()` remains in `src/authservice`; tokens are ≥256 bits of entropy; tests assert
  uniqueness/length and that two generated tokens differ.

### [ ] P0-4 — SSRF protection in the fetching service
- **Files:** `src/fetching/routes/index.js:48` & `:91`, `src/fetching/providers/fetchingnode.js:159`,
  `src/fetching/providers/fetchingaxios.js`
- **What to do:**
  - Add a `validateOutboundUrl(url)` guard (shared module) that: allows only `http:`/`https:`; resolves
    the hostname and **rejects** private/link-local/loopback ranges (`127.0.0.0/8`, `10/8`, `172.16/12`,
    `192.168/16`, `169.254/16`, `::1`, `fc00::/7`) and the cloud metadata IP `169.254.169.254`.
  - Apply it in both providers before `fetch()`, and (optionally) support a configurable allowlist.
- **AC:** Requests to `http://169.254.169.254/...`, `http://localhost`, and `file://` are rejected;
  public URLs still work; unit tests cover each blocked range.

### [ ] P0-5 — Process crash handlers + async route wrapper
- **Files:** `app.js`, `app-noauth.js`, new `src/middleware/asyncHandler.js`, all `src/*/routes/index.js`
- **What to do:**
  - Add `process.on('unhandledRejection', ...)` and `process.on('uncaughtException', ...)` that log via
    the logging service and trigger graceful shutdown (do not silently swallow).
  - Create a reusable `asyncHandler(fn)` wrapper (or add `express-async-errors`) and wrap every async route
    handler so thrown errors reach the central error handler.
- **AC:** A deliberately-throwing async route returns a clean 500 via the central handler (process stays
  up); an unhandled rejection is logged and shuts down gracefully rather than crashing uncontrolled.

### [ ] P0-6 — Fix failing tests and add a CI test gate
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

### [ ] P1-1 — Real dependency health/readiness probes
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

### [ ] P1-2 — Stop leaking raw error messages from routes
- **Files:** all `src/*/routes/index.js` (104 occurrences of `res.status(500).json({ error: err.message })`,
  e.g. `src/caching/routes/index.js:54`, `src/filing/routes/index.js:74`), `src/middleware/errorHandler.js`
- **What to do:** Replace per-route 500 responses with `next(err)` so the environment-aware central
  handler formats them (hides stack/message in production).
- **AC:** In `NODE_ENV=production`, a forced 500 returns a generic message (no internal paths/DB text);
  grep shows no remaining `res.status(500).json({ error: err.message })`.

### [ ] P1-3 — Brute-force protection on login
- **Files:** `src/authservice/routes/index.js:66` (`POST /api/login`), `package.json`
- **What to do:** Add `express-rate-limit` (or equivalent) to auth endpoints; add per-account
  lockout/backoff after N failed attempts.
- **AC:** Repeated failed logins are throttled/locked; test asserts 429/lockout after the threshold.

### [ ] P1-4 — Path-traversal containment in all filing providers
- **Files:** `src/filing/providers/filingGit.js` (read/create/update/delete/list),
  `src/filing/providers/filingLocal.js:59`, S3/FTP providers
- **What to do:**
  - Add a shared `resolveWithin(baseDir, userPath)` that resolves and asserts the result starts with
    `baseDir + path.sep` (fixes the prefix-bypass: `/srv/data` vs `/srv/data-secrets`), rejecting `..`.
  - Apply in **every** provider before any fs/git/object operation.
- **AC:** `../../etc/passwd` and `..%2f` style inputs are rejected across local/git/s3/ftp; tests cover each.

### [ ] P1-5 — API key scoping, timing-safe compare, header-only
- **Files:** `src/authservice/middleware/services.js:62` & `:65` & `:254`,
  `src/authservice/middleware/apiKey.js:60` & `:98`
- **What to do:**
  - Replace `Array.includes` comparisons with `crypto.timingSafeEqual` over hashed keys.
  - Stop accepting `?api_key=` from the query string — require the `Authorization`/`x-api-key` header.
  - Introduce key scopes/roles instead of granting full admin-portal access to any valid key.
- **AC:** Keys in query string are ignored; comparison is constant-time; a non-admin-scoped key cannot
  reach admin actions; tests cover scope enforcement.

### [ ] P1-6 — Correct Node engine declaration
- **Files:** `package.json:26`
- **What to do:** Change `"engines": { "node": ">=12.11.0" }` to `">=18"` (matches CI Node 20, `??`/`?.`
  usage, and `multer@2`).
- **AC:** `package.json` declares `>=18`; CI Node version satisfies it; README/CLAUDE.md aligned.

---

## Phase 3 — Hardening (P2)

### [ ] P2-1 — Add helmet + CORS
- **Files:** `app.js`, `app-noauth.js`, `package.json`
- **What to do:** Add `helmet` with sensible CSP/HSTS/X-Frame-Options and a configured `cors` policy
  (explicit origins, not `*`).
- **AC:** Responses include security headers; CORS only permits configured origins.

### [ ] P2-2 — Body and upload size/type limits
- **Files:** `app.js:31`, `app-noauth.js:23`, `src/filing/routes/index.js:17` (`multer()`)
- **What to do:** Set `bodyParser.json({ limit: '1mb' })` (tune as needed); configure `multer({ limits:
  { fileSize }, fileFilter })`; enforce `maxFileSize` from `filingLocal.js` settings on write.
- **AC:** Oversized bodies/uploads return 413; disallowed file types rejected; test covers limit.

### [ ] P2-3 — Stop logging secrets
- **Files:** `src/authservice/providers/authFile.js:177` & `:202`
- **What to do:** Remove the generated admin password from the WARN log and event payload; log only that a
  default admin was created (no credential). Optionally redact `req.query` in the error handler.
- **AC:** No credential value appears in logs or emitted events; grep confirms.

### [ ] P2-4 — Remove `eval()` in the notifying UI
- **Files:** `src/notifying/views/index.html:984`
- **What to do:** Replace `eval('(' + callbackFunctionStr + ')')` with a safe named-handler dispatch map;
  never execute server-provided strings.
- **AC:** No `eval(`/`new Function(` over server data in the views; callbacks still work via the dispatch map.

### [ ] P2-5 — Complete graceful shutdown
- **Files:** `index.js:735` (`shutdown`), `app.js:199` (`gracefulShutdown`)
- **What to do:** Maintain an explicit teardown registry per service (queue consumers, scheduler intervals,
  DB/redis clients); add a shutdown timeout with force-exit fallback; log via the logging service (not
  `console.error`).
- **AC:** SIGTERM closes all connections within the timeout; a hung teardown still force-exits; verified by
  a shutdown integration test.

### [ ] P2-6 — Fix event-listener leaks
- **Files:** services registering listeners (69 `.on(`/`.once(` vs 15 removals across `src/`)
- **What to do:** Pair each long-lived `.on()` with `.off()` on teardown/instance disposal; audit
  multi-instance creation paths; expose a `dispose()` per service that removes its listeners.
- **AC:** Repeated create/dispose cycles show no growth in listener counts; `process.on('warning')` shows
  no `MaxListenersExceeded`.

### [ ] P2-7 — Input validation at route boundaries
- **Files:** all `src/*/routes/index.js`, `package.json`
- **What to do:** Add a schema validator (`zod`/`joi`/`ajv`); validate `params`/`body`/`query` per route;
  add pagination caps (max page size) on list/search endpoints.
- **AC:** Invalid input returns 400 with a safe message; unbounded list queries are capped; representative
  tests per service.

### [ ] P2-8 — Resolve dependency vulnerabilities
- **Files:** `package.json`, `package-lock.json`
- **What to do:** Run `npm audit fix` (clears the `tmp` HIGH); replace abandoned `ftp` with `basic-ftp`;
  evaluate replacing/upgrading `stompit` (pulls vulnerable `qs`) and `pdf-parse@1.1.4` → 2.x; plan
  `@google-cloud/storage` 5.x → 7.x bump (clears `uuid` advisories).
- **AC:** `npm audit --omit=dev` reports 0 high; remaining moderates documented with justification; app
  tests pass after upgrades.

### [ ] P2-9 — Gate `app-noauth.js`
- **Files:** `app-noauth.js:48`
- **What to do:** Require an explicit env flag (e.g. `ALLOW_NOAUTH=1`) to boot, **or** move the file out of
  the deployable root into `tests/`/`examples/`; refuse to start if `NODE_ENV=production`.
- **AC:** Running `node app-noauth.js` without the flag (or in production) exits with an error; documented
  as test-only.

---

## Definition of Done (overall)

- [ ] All P0 tasks complete and verified (security blockers closed).
- [ ] All P1 tasks complete (pre-GA stability/hardening).
- [ ] All P2 tasks complete (defense-in-depth).
- [ ] `npm test` green in CI with a coverage threshold enforced.
- [ ] `npm audit --omit=dev` reports 0 high-severity advisories.
- [ ] A re-run of the production-readiness review shows Security and Stability at 🟢.
