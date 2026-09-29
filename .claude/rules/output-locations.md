# Where generated docs and tests go

- Markdown documents written while building features (feature notes, change summaries, design write-ups, reports) go in `.temp/updates/`.
- Ad-hoc tests and their results (one-off test scripts, manual verification runs, captured output) go in `.temp/tests/`.
- Don't leave new `.md` files in the repo root or service folders, or scratch test files in `tests/`.

Exceptions:
- Edits to existing project docs (`README.md`, `CLAUDE.md`) stay in place.
- Permanent Jest tests that belong in the suite still go under `tests/` (e.g. `tests/unit/{service}/`), and permanent Playwright UI specs go in `tests/ui/`. Ask if it's unclear whether a test is permanent or ad-hoc.
- Playwright run output (results, traces, screenshots, HTML report) is configured to land in `.temp/tests/playwright/`.

`.temp/` is git-ignored, so nothing there is committed.
