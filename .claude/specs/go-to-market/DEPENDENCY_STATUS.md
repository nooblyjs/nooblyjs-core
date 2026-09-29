# Dependency Vulnerability Status (P2-8)

> **Update 2026-09-29:** `npm audit` reports **0 vulnerabilities** in both the production and full trees. The `qs` (via `stompit`) and `uuid` (via `@google-cloud/storage`) advisories below no longer apply. `multer` was upgraded to 2.4.0 (DoS on aborted uploads), `smol-toml` (dev-only, via `knip`) was fixed with `npm audit fix`, and `nodemon`, `rimraf`, `supertest` and `ioredis-mock` moved to `devDependencies`. CI now fails on any high/critical production advisory. The abandoned-package notes (`ftp`, `stompit`, `pdf-parse`) still apply.

**Date:** 2026-05-29
**Branch:** `development`

## Summary

`npm audit fix` (non-breaking) was applied. The **HIGH-severity** `tmp`
path-traversal advisory (GHSA-ph9p-34f9-6g65) and the `uuid` v3/v5/v6 advisory
in the directly-resolvable tree are **resolved**.

| | Before | After |
|---|--------|-------|
| High | 1 | **0** |
| Moderate | 7 | 4 |
| Low | 1 | 1 |
| **Total** | **9** | **5** |

`npm audit --omit=dev` reports **0 high**.

## Remaining advisories (all moderate/low, all transitive)

The 5 remaining advisories cannot be fixed without a **breaking** major change to
an abandoned or pinned upstream package. They are deferred deliberately and
tracked here.

### 1. `qs` (moderate) — via `stompit`
- **Path:** `stompit` → `qs <= 6.14.1`
- **Advisories:** GHSA-w7fw-mjwx-w883, GHSA-6rw7-vpxm-498p, GHSA-q8mj-m7cp-5q26
  (`qs` DoS via array/bracket parsing).
- **Fix offered:** `npm audit fix --force` would install `stompit@0.26.0` — a
  **downgrade and breaking change** to the ActiveMQ/STOMP queue provider.
- **Decision:** **Deferred.** `stompit` is effectively unmaintained (last release
  2022). The advisory is a DoS in query-string parsing; `stompit` is a STOMP
  client and does not parse untrusted HTTP query strings, so exposure is low.
- **Recommended follow-up:** replace `stompit` with a maintained STOMP/AMQP
  client, or drop the ActiveMQ provider if unused. Requires updating
  `src/queueing/providers/*` and live ActiveMQ testing.

### 2. `uuid` (moderate) — via `@google-cloud/storage`
- **Path:** `@google-cloud/storage@5.x` → `@google-cloud/common` → `teeny-request`
  → `uuid < 11.1.1` (GHSA-w5hq-g745-h8pq, missing buffer bounds check in v3/v5/v6).
- **Fix offered:** only by bumping `@google-cloud/storage` from `^5.18.3` to `7.x`
  — a **two-major breaking change**.
- **Decision:** **Deferred.** The vulnerable code path (v3/v5/v6 with a provided
  buffer) is not exercised by this codebase. Requires the storage major bump and
  GCP filing-provider regression testing.
- **Recommended follow-up:** schedule the `@google-cloud/storage` 5→7 upgrade and
  re-test `src/filing/providers/filingGCP.js` / `filingS3.js`.

## Abandoned packages (no current advisory, replace proactively)

- **`ftp@^0.3.10`** — last published ~2011. Unmaintained. Recommended replacement:
  **`basic-ftp`**. Requires rewriting `src/filing/providers/filingFtp.js`
  (callback API → promise API) and live FTP testing.
- **`pdf-parse@^1.1.4`** — installed at 1.1.4 while latest is 2.x. Evaluate a bump.

## How to reproduce

```bash
npm audit               # full tree
npm audit --omit=dev    # production dependencies only (0 high)
```
