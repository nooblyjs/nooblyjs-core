# Production Readiness Review — NooblyJS Core

**Date:** 2026-05-29
**Branch reviewed:** `development` (tree identical to `main`)
**Version:** 1.0.10
**Reviewer:** Engineering review (Claude Code)

---

## Executive Summary

NooblyJS Core is a well-architected, modular service framework with several
production-grade foundations already in place: environment-aware error handling, Kubernetes-style
health probes, structured logging, `perf_hooks` monitoring, graceful-shutdown scaffolding, and
production guards that refuse to boot without `SESSION_SECRET` / API keys.

**However, it is not production-ready today.** The review found a cluster of **critical security
defects** (unauthenticated file read/write/delete, weak password hashing, predictable session
tokens, server-side request forgery) alongside **operational blockers** (failing test suite, no
crash handlers, CI that builds a non-existent Dockerfile and never runs tests). These must be
resolved before any external exposure.

### Readiness Scorecard

| Dimension | Status | Summary |
|---|---|---|
| **Security** | 🔴 Not ready | Unauthenticated filing API, SHA-256+static-salt passwords, `Math.random()` tokens, SSRF, no helmet/rate-limiting |
| **Stability / Error handling** | 🔴 Not ready | No `uncaughtException`/`unhandledRejection` handlers; async routes unwrapped |
| **Testing** | 🔴 Not ready | 135 tests / 16 suites failing; run crashes; no coverage gate; CI runs no tests |
| **Health / Observability** | 🟠 Partial | Probes exist but don't verify dependencies; no log shipping / APM / Prometheus |
| **Dependencies** | 🟠 Partial | 9 npm advisories (1 high); abandoned `ftp`/`stompit`/`pdf-parse` |
| **Deployment / CI** | 🟠 Partial | CI builds missing Dockerfile; no test gate; `files` field omits `public/` |
| **Config / Secrets** | 🟢 Good | `.env`/`.application` gitignored; no committed secrets; prod boot guards |

**Recommendation:** Treat the **P0** items below as launch blockers. **P1** should be closed before
any customer-facing GA. **P2/P3** are hardening and polish.

---

## P0 — Critical (Launch Blockers)

### P0-1. The entire Filing API is unauthenticated
**Evidence:** `src/authservice/middleware/services.js:216`
```js
// comment claims filing "enforces its own per-request auth at the route level"
if (path.startsWith('/filing/api/')) return true;
```
The portal auth guard whitelists `/filing/api/` as public on the promise that the routes enforce
their own auth. They do not — `src/filing/routes/index.js` registers ~40 routes and contains **zero**
auth/token/session/401 checks (verified by grep).

**Reachable without credentials:** `POST /upload/*`, `GET /download/*`, `DELETE /remove/*`,
`GET /browse/*`, `POST /git/commit`, `POST /git/push`, `POST /sync/push|pull`, `POST /settings`.

**Impact:** Anyone with network access can read, overwrite, delete, browse, and git-push the file
store. **Highest blast radius in the codebase.**

**Fix:** Remove the public whitelist, or implement and enforce real per-route auth middleware on every
filing route. Default to deny.

### P0-2. Passwords hashed with unsalted-per-user SHA-256 and a single hardcoded salt
**Evidence:** `src/authservice/providers/authBase.js:1086`
```js
async hashPassword_(password) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(password + 'salt').digest('hex');
}
```
Every user shares the literal salt `'salt'`. Fast, GPU-crackable, rainbow-table-able. No `bcrypt`/
`argon2`/`scrypt` dependency exists (verified). The code comment itself says "in production use bcrypt."

**Impact:** A leak of `users.json` = trivially recovered plaintext passwords.

**Fix:** Switch to `bcrypt` or `argon2` with a per-user salt and cost factor. Migrate existing hashes on
next login.

### P0-3. Session tokens, user IDs, and API keys generated with `Math.random()`
**Evidence:**
- `src/authservice/providers/authBase.js:1076` — session token = `Math.random()...`
- `src/authservice/providers/authBase.js:1067` — user ID = `Math.random()...`
- `src/authservice/middleware/apiKey.js:136` — `generateApiKey` builds the key from `Math.random()`

`Math.random()` is not cryptographically secure and is predictable. Session tokens are the bearer
credential for the admin portal. (Note: `crypto.randomBytes` is already used correctly elsewhere at
`authBase.js:612` and `:744`, so the fix is a one-line swap.)

**Impact:** Predictable/forgeable session tokens → auth bypass / session hijacking.

**Fix:** Use `crypto.randomBytes(...).toString('hex')` for all tokens, IDs, and API keys.

### P0-4. Server-Side Request Forgery (SSRF) in the fetching service
**Evidence:** `src/fetching/routes/index.js:48` takes `req.body.url` (and a base64 variant at `:91`) and
passes it straight to `fetch()` (`src/fetching/providers/fetchingnode.js:159`). No allowlist, no scheme
filter, no internal-IP/metadata blocking (verified by grep — no SSRF guards exist).

**Impact:** Pivot to internal services and steal cloud IAM credentials via `169.254.169.254`.

**Fix:** Enforce a URL allowlist; block private/link-local ranges, `localhost`, and non-`http(s)`
schemes before fetching.

### P0-5. No process-level crash handlers — one async throw kills the server
**Evidence:** No `process.on('uncaughtException')` or `process.on('unhandledRejection')` anywhere in
`src/`, `index.js`, or `app.js`. ~132 async route handlers are unwrapped; only `src/authservice`
defines an `asyncHandler`. An async handler that throws outside its try/catch produces an unhandled
rejection that never reaches the Express error handler.

**Impact:** A single unhandled rejection crashes the single Node process with no controlled logging or
shutdown. (Demonstrated live — the test run itself crashed on a DocumentDB topology error.)

**Fix:** Add `unhandledRejection`/`uncaughtException` handlers (log + graceful exit). Wrap all async
routes in a central `asyncHandler`, or add `express-async-errors`.

### P0-6. Test suite fails and crashes; CI never runs it
**Evidence:** `npm run tests` → **16 suites failed, 135 tests failed**, 1211 passed; the run **crashes**
the Node process. Failures include real regressions with no external deps:
- `caching/cache.test.js` (event-name drift), `authservice`, `aiservice`, `serviceRegistry.test.js`
  (expects `requireApiKey:true`, gets `false`).
- `dataservice.test.js` fails to load — `Cannot find module 'aws-sdk'` (mocked but not a dependency).
- `dataserviceMongoDB`/`DocumentDB` attempt **live DB connections** instead of being guarded/skipped.

`azure-pipelines.yml` has **no test step** — the Jest suite is never executed in CI. No coverage is
measured (no `--coverage` script, no threshold).

**Impact:** No regression safety net; broken behavior ships unnoticed.

**Fix:** Fix the regressions, guard external-dependency tests behind env flags, add a `test`/`coverage`
script with a threshold, and add a test gate to CI.

---

## P1 — High (Close before GA)

### P1-1. Health / readiness probes don't verify dependencies — and are partly no-ops
**Evidence:** `src/middleware/healthCheck.js:139` — `checkService()` only reads in-memory maps and never
pings Redis/Mongo/cache (the comment admits it). The maps are **never populated** —
`recordServiceError`/`recordServiceSuccess` have zero external callers (verified). Operator-precedence
bug at `:149`: `return this.errorCounts.get(serviceName) || 0 < 3` always returns `true`. `markReady()`
is called synchronously at `app.js:169` before any connectivity check.

**Impact:** `/health/ready` returns 200 even when Redis/Mongo are down → traffic routed to a broken pod.

**Fix:** Implement real dependency pings in readiness; wire up the success/error recorders; fix the
precedence bug; call `markReady()` only after dependencies verify.

### P1-2. Routes leak raw internal error messages to clients
**Evidence:** 104 occurrences of `res.status(500).json({ error: err.message })` across
`src/*/routes/index.js` (e.g. `src/caching/routes/index.js:54`, `src/filing/routes/index.js:74`). These
bypass the environment-aware central handler (`src/middleware/errorHandler.js`, which correctly hides
stacks/messages in production).

**Impact:** DB/FS error strings and internal paths reach clients in production.

**Fix:** Remove per-route 500 responses; delegate to the central handler via `next(err)`.

### P1-3. No brute-force protection on login
**Evidence:** `src/authservice/routes/index.js:66` — `POST /api/login` has no rate limiting, lockout, or
delay. No `express-rate-limit` in the project (verified). Combined with P0-2's fast hashing, online and
offline brute force are both cheap.

**Fix:** Add rate limiting + account lockout/backoff on auth endpoints.

### P1-4. Path traversal in Git/S3/FTP filing providers
**Evidence:** `src/filing/providers/filingGit.js` — `read`/`create`/`update`/`delete`/`list` all do
`path.join(this.localPath, filePath)` with user input and **no** boundary check; `../../etc/passwd`
escapes the repo. The local provider's check (`filingLocal.js:59`) uses `startsWith(baseDir)` which is
prefix-bypassable (`/srv/data` matches `/srv/data-secrets`). Directly reachable because of P0-1.

**Fix:** Resolve and assert containment against `baseDir + path.sep` in **all** providers; reject `..`.

### P1-5. API key over-scoped, non-constant-time compared, and accepted in query string
**Evidence:** `src/authservice/middleware/services.js:62` — a valid API key grants full admin-portal
access (god mode, no user identity/audit). Comparison uses `Array.includes` (`apiKey.js:98`,
`services.js:65`) — non-constant-time, timing-attackable. Key is accepted via `?api_key=`
(`apiKey.js:60`), which leaks into logs/history/Referer.

**Fix:** Scope keys; compare with `crypto.timingSafeEqual`; accept only via header, never query string.

### P1-6. Node engine declared `>=12.11.0` but code requires 18+
**Evidence:** `package.json:26` says `>=12.11.0`, but the code uses `??` (Node 14+) in ~10 files,
`multer@2` needs Node ≥16.20.1, CLAUDE.md says ≥18, and CI builds on Node 20. `??` is a hard syntax
error on Node 12.

**Impact:** Installing/running on the declared minimum crashes immediately.

**Fix:** Set `"engines": { "node": ">=18" }`.

---

## P2 — Medium (Hardening)

- **No HTTP security middleware.** No `helmet`, no CORS config, no rate limiting anywhere (verified).
  Responses ship without CSP/HSTS/X-Frame-Options/X-Content-Type-Options. *Fix: add `helmet`, configure CORS.*
- **No request body / upload limits.** `bodyParser.json()` has no `limit` (`app.js:31`); `multer()` in
  `src/filing/routes/index.js:17` has no `limits`/`fileFilter`. DoS via large uploads, reachable
  unauthenticated (P0-1). *Fix: set body limit and multer size/type limits.*
- **Secrets written to logs in plaintext.** `src/authservice/providers/authFile.js:202` logs the
  generated default-admin password at WARN and emits it on the event bus. *Fix: never log credentials.*
- **`eval()` of server-provided string.** `src/notifying/views/index.html:984` —
  `eval('(' + callbackFunctionStr + ')')` on data from the notifying API → potential stored-XSS/exec in
  the admin browser. *Fix: remove eval; use a safe dispatch map.*
- **Incomplete graceful shutdown.** `index.js:735` matches close methods by name (misses queue
  consumers / schedulers), has no timeout, and uses `console.error`. `app.js:199` has no force-exit
  fallback. *Fix: add per-service teardown registration + shutdown timeout.*
- **Event-listener leak risk.** 69 `.on(`/`.once(` vs 15 removals in server code; CLAUDE.md warns
  listeners aren't auto-removed. *Fix: remove listeners on teardown / multi-instance disposal.*
- **No input validation library.** Routes consume `req.params`/`body`/`query` directly with no schema or
  pagination caps. *Fix: add `zod`/`joi`/`ajv` validation at route boundaries.*
- **Vulnerable / abandoned dependencies.** `npm audit`: 9 advisories (1 high `tmp` path-traversal, 7
  moderate incl. `qs`/`body-parser` on the core request path, `uuid` via GCP storage). Abandoned: `ftp`
  (2011-era → `basic-ftp`), `stompit` (pulls vulnerable `qs`), `pdf-parse@1.1.4` (latest 2.4.5),
  `@google-cloud/storage` 2 majors behind. *Fix: `npm audit fix`, replace/bump abandoned packages.*
- **`app-noauth.js` disables all auth and is trivially runnable** from repo root on port 11000
  (`app-noauth.js:48`). *Fix: gate behind an explicit env flag or move out of the deployable root.*

---

## P3 — Nice to Have (Polish & Governance)

- **CI gaps:** the Docker stage builds a **non-existent `Dockerfile`** (`azure-pipelines.yml:116`) so
  `main` builds fail; add a real Dockerfile or remove the stage. Add a lint gate (no ESLint configured)
  and wire up `knip` (already a devDep, unused) for dead-code detection.
- **`package.json` `files` omits `public/`** (`:16`) — an `npm publish` ships a broken UI. Add `public`.
- **Observability:** no log shipping (file-only, ephemeral in containers), no APM, no Prometheus
  `/metrics`. Add a log shipper and OpenMetrics endpoint for multi-replica deployments.
- **Horizontal scaling:** single process, no clustering/PM2; default memory providers (cache/session/
  queue) make multi-replica state inconsistent. Document the Redis-backed provider requirement for scale-out.
- **Governance / docs:** no `LICENSE` file (declares `ISC` but ships no license text),
  no `SECURITY.md`, no `CONTRIBUTING.md`, no `.env.example`. `repository.url` has a leading
  space (`package.json:31`).
- **CLAUDE.md doc drift:** documents many non-existent npm scripts (`docker:*`, `dev:web`,
  `analyze-tokens`, `test-load`) and `scripts/` files. Align docs with reality.
- **Auto-approved invitations:** `authBase.js:752` sets new invitations to `approved` immediately;
  if the public request/redeem endpoints are exposed this weakens the registration gate (limited impact —
  new users get only `role:'user'`, which can't reach the admin portal).

---

## Verified Positives (do not regress)

- `SESSION_SECRET` and API keys are **fatally enforced in production** (`app.js:41`, `:91`).
- Central error handler correctly gates stack traces behind `NODE_ENV` (`src/middleware/errorHandler.js`).
- `.env` and `.application/` are gitignored; **no secrets committed** to the repo.
- MongoDB queries are parameterized and regex-escaped (`MongoBaseProvider.js:247`) — no NoSQL injection found.
- No `child_process` in request-reachable code — no command injection found.
- Kubernetes-style health endpoints, `perf_hooks` monitoring, and SonarQube + Veracode CI scanning exist.

---

## Suggested Remediation Roadmap

| Phase | Scope | Items |
|---|---|---|
| **Phase 1 — Security blockers** | ~1 sprint | P0-1, P0-2, P0-3, P0-4 |
| **Phase 2 — Stability blockers** | ~1 sprint | P0-5, P0-6, P1-1 |
| **Phase 3 — Pre-GA hardening** | ~1–2 sprints | P1-2 … P1-6, all P2 |
| **Phase 4 — Polish & governance** | ongoing | P3 |

> **Methodology:** findings were produced by three parallel evidence-based code reviews (security,
> stability/testing, dependencies/ops) and the most severe security claims were independently verified
> against source. Line references reflect the `development` branch at review time.
