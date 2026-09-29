# Production Readiness Test — NooblyJS Core

**Date:** 2026-09-29
**Commit tested:** `5bc73bd` (Major upgrade) + uncommitted working tree
**Package version:** 1.0.10
**Previous review:** [PRODUCTION_READINESS_REVIEW.md](./PRODUCTION_READINESS_REVIEW.md) (2026-05-29) · tracker: [REMEDIATION_TODO.md](./REMEDIATION_TODO.md)
**Tester:** Claude Code

> **Update, same day:** all blockers and findings below were remediated and the test was re-run: **70/70 live checks pass**. See [Re-test after remediation](#re-test-after-remediation) at the end and the log in [REMEDIATION_TODO.md](./REMEDIATION_TODO.md).

---

## Verdict

**Not production-ready yet, but close.** Most of the May review's security and stability fixes are in the code and held up in testing against a live server: login, API keys, blocking of internal-network fetches, lockout, crash handling and graceful shutdown all work. The server handled 38,000+ requests under load with **zero errors** and no memory leak.

**Five blockers remain.** Four of them are deployment problems rather than code defects.

| # | Blocker | Why it blocks |
|---|---|---|
| B1 | **No CI pipeline at all** — `azure-pipelines.yml` is gone and there is no `.github/` | Nothing runs the 1,767 tests or 32 UI checks before a release |
| B2 | **Docker image is built on Node 20, which reached end-of-life on 2026-04-30**, and it doesn't set `NODE_ENV=production` | No security patches; the container starts in development mode, so the production safeguards are off |
| B3 | **Sessions behind a load balancer:** no `trust proxy`, and the default in-memory session store | Behind an HTTPS load balancer the secure session cookie is never set, so admin login breaks. Sessions are lost on restart and not shared between replicas |
| B4 | **File uploads have no size limit and are buffered in memory** (`multer()` has no `limits`) | A 15 MB upload was accepted despite the 10 MB `maxFileSize` setting. One large upload can exhaust server memory |
| B5 | **`generateStrongPassword()` uses `Math.random()`** (its doc comment says it's cryptographically secure) | This function generates passwords for the `/auth/password/generate` endpoint and for new Azure OAuth users, and `Math.random()` output is predictable. Google OAuth users also get `Math.random().toString(36)` passwords |

### Scorecard

| Dimension | May 2026 | Now | Summary |
|---|---|---|---|
| Security | 🔴 | 🟠 | Auth, SSRF, lockout, hashing, API keys fixed and verified live. Remaining: B5, no CSP, unbounded uploads |
| Stability / error handling | 🔴 | 🟢 | Crash handlers, async wrapper, clean errors with no stack traces; SIGTERM exit in 105 ms |
| Testing | 🔴 | 🟠 | 1,767 unit tests + 32 UI checks pass; coverage 56% lines with no threshold; **no CI (B1)** |
| Performance | — | 🟢 | ~1,500–2,200 req/s single process; p95 52–108 ms; no leak over 24k-request soak |
| Health / observability | 🟠 | 🟢 | All probes 200; `/health/detailed` protected; readiness reports dependencies |
| Dependencies | 🟠 | 🟠 | Production deps: 0 high, 1 moderate (`multer`, fix available). Dev tools shipped as prod deps; abandoned `ftp`/`stompit` still present |
| Deployment | 🟠 | 🔴 | B1, B2, B3 |
| Config / secrets | 🟢 | 🟢 | Refuses to boot in production without `SESSION_SECRET` / API keys; `app-noauth.js` refuses production |

---

## How it was tested

1. **Code verification** of every May P0–P2 item against the current source (`grep`/read).
2. **Automated suites:** `npm test` with coverage, and `npm run test:ui` (Playwright, desktop + mobile).
3. **Live test:** `app.js` started with `NODE_ENV=production`, a random 256-bit `SESSION_SECRET` and API key, on port 11200. It ran from a sandbox copy so real `.application/` data was untouched. A probe script checked startup safeguards, health, security headers, CORS, auth, SSRF, input limits, error leakage, path traversal and brute force. It then ran load and soak tests and a SIGTERM shutdown.
4. **Dependency audit:** `npm audit` (production and full tree) and `npm outdated`.

Environment: GitHub Codespace, Node v24.21.0 locally (the Docker image uses Node 20), single process.
Raw evidence (scripts, logs, JSON results, coverage) is in `.temp/tests/production-readiness/`.

---

## Results

### 1. Automated suites

| Suite | Result |
|---|---|
| Jest unit/integration | **65 suites passed**, 4 skipped · **1,767 passed**, 80 skipped, 0 failed (was 135 failing in May) |
| Coverage | Statements 56.0% · Branches 48.3% · Functions 54.9% · Lines 56.5% — **no threshold enforced** |
| Playwright UI smoke | **32/32 passed**: 16 pages at desktop and phone size, no JavaScript errors |

### 2. Startup safeguards (production mode)

| Check | Result |
|---|---|
| Boot without `SESSION_SECRET` | ✅ Refuses: `FATAL ERROR: SESSION_SECRET is not set in production.` |
| Boot without API keys | ✅ Refuses: `FATAL ERROR: No API keys configured for production.` |
| `app-noauth.js` with `NODE_ENV=production` | ✅ Refuses to start |
| Default admin credential | ✅ Written to a restricted file, not logged |

### 3. Health probes

`/health`, `/health/live`, `/health/ready`, `/health/startup` → **200** ✅ · `/health/detailed` → login redirect without credentials, 200 with API key ✅

### 4. Security headers and CORS

| Header | `/health`, `/services/`, API |
|---|---|
| `X-Content-Type-Options: nosniff` | ✅ |
| `X-Frame-Options: SAMEORIGIN` | ✅ |
| `Strict-Transport-Security: max-age=31536000; includeSubDomains` | ✅ |
| `X-Powered-By` removed | ✅ |
| `Content-Security-Policy` | ❌ **absent**: disabled in `app.js` (`helmet({ contentSecurityPolicy: false })`) because the dashboards use inline scripts/styles |
| CORS from `https://evil.example` | ✅ No `Access-Control-Allow-Origin` returned |

### 5. Authentication and authorisation

| Check | Result |
|---|---|
| 12 protected endpoints across caching, logging, dataservice, workflow, scheduling, settings, filing, fetching, authservice, monitoring, called with no credentials | ✅ All rejected (filing → 401; others → 302 to login) |
| Wrong API key | ✅ Rejected (302) |
| API key in `?api_key=` query string | ✅ Ignored (302) |
| Valid key in `x-api-key` header / as `Bearer` | ✅ 200 / 200 |
| Admin dashboard `/services/` without login | ✅ 302 → login page |
| Per-IP login rate limit (10 per 15 min) | ✅ 11th attempt → 429 |
| Per-account lockout (5 failures) | ✅ 6th attempt → 429; **correct password also refused while locked**; a different account from the same IP is unaffected |

⚠️ **API clients get HTML redirects, not 401s.** Unauthenticated JSON requests to `/services/*/api/*` (everything except filing) receive `302 → /services/authservice/views/login.html`. `redirectToInvalid` already returns JSON for non-HTML requests; `redirectToLogin` (`src/authservice/middleware/services.js`) should do the same.

### 6. SSRF protection (fetching service)

All 8 attacks were **blocked** ✅: cloud metadata `169.254.169.254`, `localhost`, `127.0.0.1:22`, `10.0.0.1`, `[::1]`, `file:///etc/passwd`, hex IP `0x7f000001`, decimal IP `2130706433`.
⚠️ Blocked requests return **500** rather than **400**, so a client error is reported, and alerted on, as a server fault.

### 7. Input limits, error handling, path traversal

| Check | Result |
|---|---|
| 2 MB JSON body | ✅ 413; generic message and request ID, no stack trace |
| Malformed JSON | ✅ 400; no stack trace |
| Unknown API route | ✅ 404; no stack trace |
| **15 MB file upload** (`maxFileSize` = 10 MB) | ❌ **Accepted (200)**, see B4 |
| 4 path-traversal variants on `/filing/api/download/` (`..%2f`, `%2e%2e/`, `....//`, `..%5c`) | ✅ `/etc/passwd` never returned. ⚠️ Three return **500** instead of 400/404 |

### 8. Performance (single process, c = concurrent connections)

| Scenario | Requests | Throughput | p50 | p95 | p99 | Errors |
|---|---|---|---|---|---|---|
| `/health` (c=50) | 5,000 | 1,504 req/s | 28.7 ms | 70.0 ms | 96.7 ms | 0 |
| Authenticated API read (c=50) | 3,000 | 2,139 req/s | 19.6 ms | 52.3 ms | 68.5 ms | 0 |
| Cache status (c=100) | 3,000 | 2,183 req/s | 34.8 ms | 107.8 ms | 170.5 ms | 0 |
| **Soak:** 6 rounds × 4,000 mixed requests (c=50) | 24,000 | — | — | — | — | **0** |

**Memory (RSS):** 108 MB at start → 266 MB after load → 289–314 MB during the soak → **134 MB** after garbage collection (round 5) → 207 MB at the end. It drops back under load, so **no leak was found**.

### 9. Graceful shutdown

SIGTERM → workers stopped, logs flushed, **exit code 0 in 105 ms** ✅

### 10. Dependencies

| Scope | High | Moderate | Detail |
|---|---|---|---|
| Production (`--omit=dev`) | **0** | 1 | `multer` 2.3.0: DoS via orphaned disk writes on aborted uploads; **fixed in 2.4.0** (non-breaking) |
| Full tree | 1 | 1 | + `smol-toml` (high, dev-only: DoS on malformed TOML); fix available |

The `stompit`→`qs` and `@google-cloud/storage`→`uuid` advisories tracked in [DEPENDENCY_STATUS.md](./DEPENDENCY_STATUS.md) **no longer appear**.

Other dependency findings:
- **Dev tools shipped as production dependencies:** `nodemon`, `rimraf`, `supertest`, `ioredis-mock` are in `dependencies`, so `npm ci --omit=dev` (the Dockerfile) installs them into the image.
- **Abandoned packages still present:** `ftp@0.3.10` (2011) and `stompit`.
- **Major versions behind:** `express` 4→5, `@google-cloud/storage` 5→8, `openai` 5→7, `@anthropic-ai/sdk` 0.60→0.129, `mongodb` 6→7, `pdf-parse` 1→2, `uuid` 11→14. Full list in `.temp/tests/production-readiness/npm-outdated.txt`.

---

## Status of the May 2026 findings

| ID | Item | Tracker | Verified 2026-09-29 |
|---|---|---|---|
| P0-1 | Authenticate Filing API | [x] | ✅ All filing routes return 401 without credentials |
| P0-2 | bcrypt password hashing | [x] | ✅ `bcryptjs`, with legacy hashes upgraded on login |
| P0-3 | Cryptographically secure tokens/IDs/keys | [x] | ⚠️ **Partial**: tokens fixed, but `generateStrongPassword()` and Google OAuth passwords still use `Math.random()` (B5) |
| P0-4 | SSRF protection | [x] | ✅ 8/8 attacks blocked (status code 500 should be 400) |
| P0-5 | Crash handlers + async wrapper | [x] | ✅ Present; errors return generic messages |
| P0-6 | Fix tests + **CI test gate** | [ ] | ⚠️ Tests fixed (0 failing). **CI gate missing: no pipeline exists** (B1); no coverage threshold |
| P1-1 | Real readiness probes | [x] | ✅ Readiness reports dependencies; precedence bug fixed |
| P1-2 | Stop leaking raw error messages | [ ] | ⚠️ Nearly done: 1 raw `err.message` left (`src/scheduling/routes/index.js:108`, a 409 response); 125 uses of `sendSafeError` |
| P1-3 | Brute-force protection | [x] | ✅ Per-IP 429 and per-account lockout verified live |
| P1-4 | Path-traversal containment | [x] | ✅ `resolveWithin` in local/git/sync; traversal attempts fail (500 should be 400) |
| P1-5 | API key hardening | [x] | ✅ Constant-time comparison; query-string keys ignored |
| P1-6 | Node engine `>=18` | [x] | ✅ (but see B2: the image runs an end-of-life Node) |
| P2-1 | helmet + CORS | [x] | ⚠️ Headers and CORS verified; **CSP disabled** |
| P2-2 | Body + upload limits | [x] | ⚠️ **Partial**: JSON 413 works; **uploads unlimited** (B4) |
| P2-3 | Stop logging secrets | [x] | ✅ Admin password written to a file, not logged |
| P2-4 | Remove `eval()` in notifying UI | [x] | ✅ No `eval`/`new Function` in views |
| P2-5 | Graceful shutdown | [x] | ✅ 105 ms clean exit, with a forced-exit timer |
| P2-6 | Event-listener leaks | [ ] | ⚠️ Open: 58 `.on/.once` vs 19 removals in server code (soak showed no growth in normal use) |
| P2-7 | Input validation library | [ ] | ❌ Open: no `zod`/`joi`/`ajv` |
| P2-8 | Dependency vulnerabilities | [x] | ✅ 0 high in production; new moderate `multer` advisory has a non-breaking fix |
| P2-9 | Gate `app-noauth.js` | [x] | ✅ Refuses without `ALLOW_NOAUTH=1` and in production |

---

## New findings (not in the May review)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| N-1 | 🔴 Blocker | No CI pipeline (`azure-pipelines.yml` deleted, no `.github/workflows`) | Add CI running `npm ci`, `npm test`, `npx playwright install --with-deps chromium`, `npm run test:ui`, `npm audit --omit=dev --audit-level=high`; block merges on failure |
| N-2 | 🔴 Blocker | Dockerfile: `node:20-alpine` is end-of-life; no `ENV NODE_ENV=production`; no `HEALTHCHECK`; no `.dockerignore` | Use `node:22-alpine` (or 24); add `ENV NODE_ENV=production` and `HEALTHCHECK CMD wget -qO- http://localhost:11000/health/live \|\| exit 1`; restore `.dockerignore` |
| N-3 | 🔴 Blocker | No `app.set('trust proxy', …)`; `cookie.secure` is true in production, so behind a TLS-terminating proxy the session cookie is never sent | Add a `TRUST_PROXY` env setting, e.g. `app.set('trust proxy', process.env.TRUST_PROXY \|\| 1)` |
| N-4 | 🔴 Blocker | Session store is the default in-memory store (`connect.session() MemoryStore is not designed for a production environment` in the logs): leaks memory, is lost on restart, and isn't shared between replicas | Use `connect-redis` (Redis is already a dependency) or another shared store |
| N-5 | 🔴 Blocker | `multer()` has no `limits` and uses memory storage, so upload size is unlimited and held in RAM (B4) | `multer({ limits: { fileSize: settings.maxFileSize } })` or disk storage; return 413 |
| N-6 | 🔴 Blocker | `Math.random()` in `generateStrongPassword()` (`authBase.js`) and Google OAuth user passwords (`authGoogle.js:179`) (B5) | Use `crypto.randomInt()` in the generator; use `crypto.randomBytes(32)` for OAuth placeholder passwords |
| N-7 | 🟠 High | Content-Security-Policy disabled | Enable CSP with nonces/hashes for the dashboards, or a report-only policy first |
| N-8 | 🟡 Medium | Unauthenticated API calls get 302 → HTML login instead of 401 JSON | Make `redirectToLogin` return 401 JSON for non-HTML `Accept` headers, as `redirectToInvalid` already does |
| N-9 | 🟡 Medium | Blocked SSRF and traversal requests return 500 | Throw typed validation errors and map them to 400 |
| N-10 | 🟡 Medium | `multer` 2.3.0 moderate advisory | `npm i multer@^2.4.0` |
| N-11 | 🟡 Medium | Dev tools (`nodemon`, `rimraf`, `supertest`, `ioredis-mock`) in `dependencies` | Move them to `devDependencies` |
| N-12 | 🟡 Medium | Coverage 56% with no threshold | Add `coverageThreshold` at the current level and raise it over time |
| N-13 | 🔵 Low | `package.json`: version still 1.0.10; `files` omits `public/`; `repository.url` has a leading space | Fix before `npm publish` |
| N-14 | 🔵 Low | No `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `.env.example` (carried over from May P3) | Add them |

---

## Recommended path to launch

| Step | Items | Effort |
|---|---|---|
| 1. Deployment blockers | N-2, N-3, N-4 | ~1 day |
| 2. Security blockers | N-5, N-6, N-10 | ~½ day |
| 3. Release gate | N-1, N-12 (and close P0-6) | ~1 day |
| 4. Pre-GA hardening | N-7, N-8, N-9, N-11, P1-2, P2-6, P2-7 | 1–2 sprints |
| 5. Polish | N-13, N-14, major-version upgrades | ongoing |

**Re-test criteria:** after steps 1–3, this test should pass with all 62 probe checks green (after updating the probe to expect 400/401 where noted), CI running on every PR, and the container behind an HTTPS proxy completing an admin login.

---

## Reproducing this test

The probe, soak script and raw results are in `.temp/tests/production-readiness/` (git-ignored):

```bash
# 1. Start production server from a sandbox copy (keeps real .application/ untouched)
NODE_ENV=production SESSION_SECRET=<random> API_KEYS=<random> PORT=11200 node app.js
# 2. Black-box probe (62 checks + load)
BASE=http://localhost:11200 API_KEY=<key> node .temp/tests/production-readiness/probe.js
# 3. Soak with memory sampling
BASE=http://localhost:11200 API_KEY=<key> PID=<server pid> node .temp/tests/production-readiness/soak.js
# 4. Suites and audit
npm test -- --coverage && npm run test:ui && npm audit --omit=dev
```

Note: the probe ends with a brute-force check that locks `admin@localhost` for 15 minutes.

---

## Re-test after remediation

**Date:** 2026-09-29 (same day) · **Verdict: ready for production**, subject to the operational follow-ups below.

Same method as above: `app.js` with `NODE_ENV=production` from a sandbox copy, this time with a decoy `.env` in the app root. The probe was tightened to expect the corrected behaviour (400 for blocked requests, 401 JSON for API clients, 413 for oversized uploads, CSP present) and gained checks for the new findings.

### Scorecard after remediation

| Dimension | Before | After | Evidence |
|---|---|---|---|
| Security | 🟠 | 🟢 | 70/70 probe checks: auth, SSRF (400), traversal (400/404), uploads (413), open redirect (400), app root unreadable via filing, enforced CSP |
| Stability / error handling | 🟢 | 🟢 | No 5xx under load; 5xx bodies generic; missing files → 404 |
| Testing | 🟠 | 🟢 | 1,813 Jest tests pass (+46 new); coverage threshold enforced; 32/32 UI checks with CSP-violation detection; CI workflow added |
| Performance | 🟢 | 🟢 | See below |
| Dependencies | 🟠 | 🟢 | `npm audit`: **0 vulnerabilities** (production and dev); dev tools out of the production install |
| Deployment | 🔴 | 🟢 | Node 24 LTS image with `NODE_ENV`, `HEALTHCHECK`, non-root user; `TRUST_PROXY`; Redis-capable session store |
| Config / secrets | 🟢 | 🟢 | Unchanged safeguards, plus `.env.example` and `SECURITY.md` |

### Blockers

| # | Status | Verified |
|---|---|---|
| B1 No CI | ✅ `.github/workflows/ci.yml`: unit (Node 22/24 + coverage), UI, audit, Docker | Each step run locally; needs a first run on GitHub and branch protection |
| B2 Node 20 / no `NODE_ENV` | ✅ `node:24-alpine`, `NODE_ENV=production`, `HEALTHCHECK` | Image built; refuses to start without secrets; `healthy` with them; runs as `appuser` |
| B3 Proxy / sessions | ✅ `TRUST_PROXY`; Redis session store via `SESSION_REDIS_URL`; pruning memory fallback with a production warning | Unit tests (ioredis-mock); startup warnings seen in logs |
| B4 Unlimited uploads | ✅ 413 over `maxFileSize` (multipart, streamed, named instances); 415 for disallowed types | Unit tests; probe 15 MB upload → 413 |
| B5 `Math.random()` passwords | ✅ `crypto.randomInt` / `randomBytes` | Unit test asserts `Math.random` is never called; source scan clean |
| **N-15 (found during remediation)** | ✅ Filing store moved out of the app root (`FILING_BASE_DIR`, default `.application/files`) | Probe: `.env`, `package.json`, `app.js` and the users file all return 404 via the filing API |

### Performance and resilience (re-test)

| Scenario | Requests | Throughput | p50 | p95 | p99 | Errors |
|---|---|---|---|---|---|---|
| `/health` (c=50) | 5,000 | 1,772 req/s | 23.4 ms | 50.9 ms | 92.3 ms | 0 |
| Authenticated API read (c=50) | 3,000 | 2,423 req/s | 17.8 ms | 39.7 ms | 46.0 ms | 0 |
| Cache status (c=100) | 3,000 | 2,045 req/s | 34.7 ms | 134.8 ms | 195.9 ms | 0 |
| Soak: 6 × 4,000 mixed (c=50) | 24,000 | — | — | — | — | 0 |

- **Memory:** flat through the soak at 303–305 MB RSS (no growth between rounds).
- **Startup:** healthy **1.7 s** after launch. `/health` returns 503 `starting` until then, so load balancers should use a start period (the Docker `HEALTHCHECK` allows 30 s).
- **Shutdown:** SIGTERM → exit 0 in **103 ms**.

### Operational follow-ups

1. Enable branch protection on `main` requiring the four CI jobs.
2. In production set `TRUST_PROXY` (behind a load balancer) and `SESSION_REDIS_URL` (for more than one replica). The app warns at startup when they're missing.
3. Mount a volume at `/usr/src/app/.application` so users, settings and uploaded files survive container restarts.
4. Hardening backlog (not blockers): drop `'unsafe-inline'` from the CSP by moving inline scripts into files; make auth-provider validation errors `ClientError`s; raise coverage; replace `ftp`/`stompit`; `express` 5 and other major upgrades. Tracked in [REMEDIATION_TODO.md](./REMEDIATION_TODO.md).
