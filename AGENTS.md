# Repository Guidelines

## Project Structure & Module Organization
Core services live in `src/` by domain (caching, logging, workflow, etc.), each bundling providers, routes, and optional views. `app.js` boots the Express demo host; `index.js` exposes the service registry for consumers. Shared assets sit in `public/` and `src/views/`, while long-form docs belong in `docs/`. Tests reside in `tests/`: `unit/` for isolated modules, `api/` for REST coverage, `activities/` for flows, and `load/` for performance experiments.

## Build, Test, and Development Commands
- `npm start` — run the sample server on port 3001.
- `npm run dev:web` — nodemon watch on `src/` and `app.js` for live reload.
- `npm test` — execute all Jest suites with open-handle checks.
- `npm run test-load` — run load scripts in `tests-load/`.
- `npm run kill` — free port 3001 if a stray process lingers.

## Coding Style & Naming Conventions
The codebase uses CommonJS (`require` / `module.exports`) targeting Node.js ≥ 12.11.0. Formatting relies on Prettier with single quotes and 2-space indents; run `npx prettier --write src tests` before opening a PR. Keep folder names lowercase, export classes in PascalCase, and use camelCase for helpers. Attach concise JSDoc to public APIs, mirroring existing service factories. Place configuration constants in `data/` or service-specific `config.js` files.

## Testing Guidelines
Jest drives all suites; name specs `*.test.js` to ensure discovery. Co-locate mocks under `tests/unit/mocks/` and reuse common fixtures before adding new ones. Run `npm test` before each push; add `npm run test-load` when touching queueing, scheduling, or other throughput-bound modules. Update README snippets in the relevant `tests/` subfolder if fixtures or scripts change.

## Commit & Pull Request Guidelines
Adopt imperative, sentence-case commit subjects (`Add Redis metrics to queueing`). Reference affected services in the body when extra context helps. PRs should include a brief summary, linked issues, verification commands, and screenshots or curl transcripts for API or UI changes. Tag maintainers for the impacted service and call out configuration updates or schema migrations explicitly.

## Environment & Configuration
Secrets load via `dotenv`; keep `.env` local and out of Git. Store provider defaults under `data/` and document additions in `docs/configuration.md`. When introducing dependencies or environment variables, update the Dockerfile and sample `.env` to keep deployments reproducible.
