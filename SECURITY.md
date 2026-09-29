# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report vulnerabilities privately through GitHub:
**[Report a vulnerability](https://github.com/nooblyjs/nooblyjs-core/security/advisories/new)**
(the repository's *Security → Advisories* tab).

Include the affected version or commit, steps to reproduce, and the impact you
observed. We aim to acknowledge reports within 5 working days and will keep you
updated until a fix is released.

## Supported versions

Security fixes are made on the latest release line only.

## Deployment checklist

A production deployment should at minimum:

- set `NODE_ENV=production`, a random `SESSION_SECRET` and `NOOBLYJS_API_KEYS`
  (the app refuses to start without them);
- terminate TLS, and set `TRUST_PROXY` when behind a load balancer;
- use `SESSION_REDIS_URL` when running more than one instance;
- never expose `app-noauth.js` (it refuses to start in production);
- keep `npm audit --omit=dev --audit-level=high` clean (enforced in CI).

See `.env.example` for every supported setting.
