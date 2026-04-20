# UIService (`src/uiservice/`)

**Dependency level:** 0 – Foundation (no dependencies)

The UIService centralizes shared client-side assets (CSS, JavaScript) used across all service dashboards. It serves static files from its own directory so that service views can import common stylesheets and scripts from a single location.

---

## Factory (`src/uiservice/index.js`)

```javascript
const ui = registry.uiservice('default');
```

### Factory Function

```javascript
module.exports = function(type, options, eventEmitter) {
  if (options['express-app']) {
    const app = options['express-app'];
    app.use('/services/uiservice/', express.static(path.join(__dirname)));
  }
};
```

Very simple: if an Express app is provided, mounts the `src/uiservice/` directory as static files at `/services/uiservice/`.

No provider variations (type is ignored). Returns `undefined` (no service instance).

---

## Served Assets

### `/services/uiservice/js/index.js`

Main client-side JavaScript bundle for the service dashboard. Provides:
- Tab navigation management.
- API request utilities.
- Common UI components.

### `/services/uiservice/js/navigation.js`

Sidebar navigation component. Manages:
- Left navigation panel.
- Active tab highlighting.
- Search filter input for navigation items.

---

## How Service Views Use UIService

Each service's `views/index.html` references the shared assets:

```html
<!-- Import shared navigation JS -->
<script src="/services/uiservice/js/navigation.js"></script>
<script src="/services/uiservice/js/index.js"></script>
```

This pattern avoids duplicating UI code across 15+ service dashboards.

---

## Dashboard URL Pattern

All service UIs are served at:
- `GET /services/<serviceName>/` – service dashboard HTML
- `GET /services/<serviceName>/api/status` – JSON status endpoint

The services registry landing page at `GET /services/` provides links to all registered service dashboards.

---

## Views Architecture (`src/views/`)

The top-level `src/views/` directory contains the services registry landing page (`index.html`) and the global navigation JavaScript (`src/views/js/navigation.js`).

### `src/views/modules/monitoring.js`

The system monitoring module. Provides:

#### `getMetrics()` → `Object`

Returns current Node.js process metrics:
- `memory` – heap used, heap total, RSS, external.
- `cpu` – user and system CPU usage.
- `uptime` – process uptime in seconds.
- `platform` – OS platform.
- `nodeVersion` – Node.js version.

#### `getCurrentSnapshot()` → `Object`

Returns a snapshot of current system state including metrics plus:
- `timestamp` – ISO string.
- `services` – (if available) list of registered services.

These are exposed via the ServiceRegistry monitoring routes:
- `GET /services/api/monitoring/metrics`
- `GET /services/api/monitoring/snapshot`
