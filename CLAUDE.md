# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NooblyJS Core is a modular Node.js backend framework: a set of services (logging, caching, queueing, data, workflow, AI, auth, …) each with pluggable providers, created and wired together by a singleton `ServiceRegistry` exported from `index.js`. Each service also mounts a REST API and a dashboard UI under `/services/{serviceName}/`.

## Commands

- `npm run dev` — dev server with nodemon (watches `./src`, runs `app.js`, port `11000` or `$PORT`)
- `npm run dev:noauth` — same, using `app-noauth.js` (no login required; handy for UI work)
- `npm start` — `node ./app.js`
- `npm test` (alias `npm run tests`) — all Jest tests
- `npm test -- tests/unit/caching/cache.test.js` — a single file; `npm test -- -t "name"` for a single test
- `npm run test:ui` — Playwright UI tests in `tests/ui/` (desktop + mobile Chromium); `npm run test:ui -- --project=chromium tests/ui/smoke.spec.js` for one file/project, `npm run test:ui:headed` to watch, `npm run test:ui:report` to open the HTML report
- `npm run kill` / `npm run kill-test` — free port 11000 / 3101 when a server hangs
- `npm run certs` / `npm run certs:force` — generate self-signed TLS certs for local HTTPS
- `npm run build` — `scripts/build.js`

There is no linter. Jest runs with `forceExit` and `detectOpenHandles`; tests must clean up timers/handles in `afterEach`/`afterAll`.

Skipped by default: MongoDB/DocumentDB suites (need `RUN_MONGODB_TESTS=1` / `RUN_DOCUMENTDB_TESTS=1` and a live DB), TensorFlow (needs optional `@tensorflow/tfjs-node`), SimpleDB (needs optional `aws-sdk` v2). Files named `*.disabled.js` / `*.disable.js` (Redis, Memcached, S3, filing, API-key integration) are not picked up by Jest.

UI tests (`playwright.config.js`): Playwright starts `app-noauth.js` itself on port `11100` (`UI_TEST_PORT`) with `ALLOW_NOAUTH=1` — `app-noauth.js` refuses to start without that flag. Set `UI_TEST_BASE_URL` to test an already-running server instead. Results, traces, screenshots and the HTML report go to `.temp/tests/playwright/`. Jest ignores `tests/ui/` and `.temp/` (`testPathIgnorePatterns`), so Playwright specs must stay in `tests/ui/`. After `npm install` on a new machine, run `npx playwright install --with-deps chromium`. Note the AI dashboard is at `/services/ai`, not `/services/aiservice`.

`tests/app/{service}/app-*.js` are standalone apps showing one service with a specific provider — run directly with `node`.

## Architecture

### ServiceRegistry (`index.js`)

- `initialize(expressApp, eventEmitter, globalOptions)` must be called first. It sets up API-key middleware (`security.apiKeyAuth`: `apiKeys`, `requireApiKey`, `excludePaths`) and services login (`security.servicesAuth.requireLogin`, default true — `/services/*` needs an authenticated `admin` session), plus the monitoring endpoints `/services/api/monitoring/{metrics,snapshot}`.
- `getService(serviceName, providerType, options)` is the core: it resolves dependencies recursively, injects them as `options.dependencies`, and caches instances keyed by service + provider + `options.instanceName` (default `'default'`). Convenience factories wrap it: `logger()`, `cache()`, `queue()`, `dataService()`, `filing()`, `settings()`, `workflow()`, `aiservice()`, etc.
- Injected dependencies use `getDefaultProviderType()` (built-in defaults: mostly `memory`; `filing`→`local`, `authservice`/`settings`→`file`, `aiservice`→`claude`, `fetching`→`node`), not the provider of the service being created. To inject e.g. a Redis queue everywhere, call `setDefaultProvider('queueing', 'redis', options)` **before** creating anything that depends on it — resolved dependencies are cached.
- `shutdown()`, `reset()`, `resetService()` exist for teardown in tests.

The dependency graph is hard-coded in `initializeServiceDependencies()` (the source of truth — update it when adding a service):

| Level | Service → dependencies |
|---|---|
| 0 | `logging` |
| 1 | `caching`, `queueing`, `notifying`, `appservice`, `fetching`, `settings` → logging |
| 2 | `dataservice` → logging, queueing · `working`, `measuring` → logging, queueing, caching |
| 3 | `scheduling` → logging, working · `searching` → logging · `workflow` → logging, queueing, scheduling, measuring, working · `filing` → logging, queueing, dataservice |
| 4 | `authservice` → logging, caching, dataservice · `aiservice` → logging, caching, workflow, queueing |

### Service layout

Each `src/{service}/index.js` is a factory `(providerType, options, eventEmitter)` that `switch`es on provider type, instantiates from `providers/` (`provider/` in aiservice and partly measuring), then registers `routes/index.js` (Express, with a Swagger doc under `routes/swagger/`) and `views/` (dashboard). Most services include a `modules/analytics.js` and an `*Api.js` provider that proxies to a remote instance of the same service. Check the factory's `case` labels for valid provider names — e.g. fetching is `node`/`axios`, measuring/notifying/working use `default`, settings is `file`/`encrypted`, filing adds `gcp`/`api`/`sync`, queueing adds `activemq`, aiservice includes `gemini`/`openai-kv`/`tensorflow`, authservice includes `azure`/`secure-email`.

Other shared code: `src/appservice/baseClasses/` (base classes for custom app services), `src/middleware/` (error handler, health checks), `src/shared/utils/` (`createServer`, `safeError`, `trustSystemCa`), `src/views/` (the top-level services dashboard and `modules/monitoring.js`), `public/` (static site).

### Services with notable internals

**Settings** — grouped key/value settings in an AES-256-GCM encrypted JSON file; master secret from `options.secret`, `SETTINGS_SECRET` or `SESSION_SECRET`. Embeddable UI: `/services/settings/scripts/js/index.js` → `new SettingsUIManager({ containerId }).initialize()` (options: `groups`, `readOnly`, `allowGroupManagement`, `allowReveal`, `apiBaseUrl`, `fetchOptions`, `onChange`, `onError`).

**Workflow** — the memory provider keeps definitions, stars, schedules and execution history in memory (`containers/`) and schedules its own runs (`modules/workflowScheduler.js`, reusing scheduling's `cronExpression`). It never touches the filesystem: the host app persists by listening for `workflow:state:changed` and saving `workflow.exportState()`, and restores with the `state` option or `importState(snapshot)`. On import, running runs become interrupted failures and overdue enabled schedules are caught up once (`scheduleCatchUp`, `catchUpGraceMs`, `catchUpStaggerMs`). History is capped per workflow (`maxExecutionsPerWorkflow`, default 1000). Workflows are identified by name. Manager REST API in `routes/manager.js` (`/services/workflow/api/{workflows,runs,schedules,cron/preview,state}`); legacy `definitions`/`executions` endpoints are unchanged. UI: `WorkflowManagerUI` in `scripts/js/index.js` (screens `workflows`, `schedules`, `executions`; options `apiBaseUrl`, `fetchOptions`, `screens`, `initialScreen`, `readOnly`, `pollInterval`, `storageKey`, `onNavigate`, `onError`).

**Scheduling** — `providers/scheduling.js` supports `pause`/`resume` (paused cron minutes are not replayed), `update(name, changes)` (can switch cron ↔ interval, keeps callback and history), `listRuns`/`getRun` (last 50 runs per task, including fires skipped at the concurrency cap), `getStats`, and `start(..., { paused, runImmediately, description, group })`. `providers/cronExpression.js` `nextMatch()` is shared with workflow. Manager routes in `routes/manager.js` (`/services/scheduling/api/{tasks,runs,cron/preview}`). UI: `ScheduleManagerUI` in `scripts/js/index.js` (screens `schedules`, `runs`; same options as `WorkflowManagerUI`).

The workflow, scheduling and settings client UIs inject their own namespaced styles (`njsc-` for scheduling, so it can coexist with the workflow manager on one page), use the host's `--kr-*` colour tokens, have no framework dependency, and must work at phone width.

**Searching** — client library `src/searching/scripts/js/index.js` supports remote (`new searchService({ provider: 'remote' })`) or in-browser search; the UI tab emits `searchUIResults` / `searchUIResultSelected` custom events.

## Conventions

- Server-side logging goes through the injected logger with optional chaining and structured metadata: `this.logger?.info(\`[${this.constructor.name}] ...\`, { ... })`. The migration off `console.*` is incomplete (some cloud providers, `*Api.js` providers, `createServer.js`, `errorHandler.js` still use it); browser scripts under `src/*/scripts/` and `src/*/views/` use `console` by design.
- `const`/`let`, `async/await`, and JSDoc (`@param`, `@return`, `@throws`, `@example`) on public methods and route factories, matching existing files.
- Services emit events on the shared EventEmitter for major operations; tests verify with `jest.spyOn(eventEmitter, 'emit')` and inject mock dependencies via `options.dependencies`.
- Commits use conventional format scoped by service, e.g. `fix(dataservice): ...`, `feat(workflow): ...`.

## Configuration

`.env` (not tracked): `PORT`, `API_KEYS` or `KNOWLEDGEREPOSITORY_API_KEYS` (comma-separated; in development one is generated and logged if none are set), `SESSION_SECRET`, `SETTINGS_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`. Runtime data and logs go to `./.application/` (created automatically). `app.js` wires every service with file-based providers and is the reference for service setup.
