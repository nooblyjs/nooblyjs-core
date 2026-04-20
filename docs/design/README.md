# Noobly JS Core – Detailed Code Reference

This folder contains detailed documentation of every service, class, and method in the `src/` directory, generated from direct code analysis.

## Index

| Document | Description |
|---|---|
| [service-registry.md](./service-registry.md) | `index.js` – ServiceRegistry singleton, dependency graph, factory methods |
| [base-classes.md](./base-classes.md) | `src/appservice/baseClasses/` – appBase, appServiceBase, appRouteBase, appWorkerBase, appDataBase |
| [logging.md](./logging.md) | `src/logging/` – Console, file, and API logging providers |
| [caching.md](./caching.md) | `src/caching/` – In-memory, Redis, Memcached, file, API, and cloud cache providers |
| [queueing.md](./queueing.md) | `src/queueing/` – In-memory, Redis, RabbitMQ, cloud queue providers |
| [dataservice.md](./dataservice.md) | `src/dataservice/` – Memory, file, MongoDB, DocumentDB, SimpleDB providers |
| [working.md](./working.md) | `src/working/` – Worker thread manager and task execution engine |
| [scheduling.md](./scheduling.md) | `src/scheduling/` – Interval and CRON-based task scheduler |
| [workflow.md](./workflow.md) | `src/workflow/` – Multi-step workflow orchestration |
| [filing.md](./filing.md) | `src/filing/` – Local, FTP, S3, Git, GCP, sync file providers |
| [authservice.md](./authservice.md) | `src/authservice/` – Passport, Google OAuth, file, memory, secure-email auth |
| [aiservice.md](./aiservice.md) | `src/aiservice/` – Claude, OpenAI, Ollama AI providers |
| [searching.md](./searching.md) | `src/searching/` – In-memory, file, and API full-text search |
| [fetching.md](./fetching.md) | `src/fetching/` – Node.js native and Axios HTTP fetching providers |
| [measuring.md](./measuring.md) | `src/measuring/` – Performance metrics collection |
| [notifying.md](./notifying.md) | `src/notifying/` – Topic-based pub/sub notification service |
| [uiservice.md](./uiservice.md) | `src/uiservice/` – Shared client-side assets service |

## Architecture at a Glance

```
Level 0 – Foundation
  └─ logging

Level 1 – Infrastructure
  ├─ caching          (depends on: logging)
  ├─ queueing         (depends on: logging)
  ├─ notifying        (depends on: logging)
  ├─ appservice       (depends on: logging)
  └─ fetching         (depends on: logging)

Level 2 – Business Logic
  ├─ dataservice      (depends on: logging, queueing)
  ├─ working          (depends on: logging, queueing, caching)
  └─ measuring        (depends on: logging, queueing, caching)

Level 3 – Application
  ├─ scheduling       (depends on: logging, working)
  ├─ searching        (depends on: logging, caching, dataservice, queueing, working, scheduling)
  ├─ workflow         (depends on: logging, queueing, scheduling, measuring, working)
  └─ filing           (depends on: logging, queueing, dataservice)

Level 4 – Integration
  ├─ authservice      (depends on: logging, caching, dataservice)
  └─ aiservice        (depends on: logging, caching, workflow, queueing)
```

## Event System

All services communicate through a shared `EventEmitter`. Events follow the pattern `service:action` or `service:action:instanceName`. Key events:

| Event | Emitted By | Payload |
|---|---|---|
| `service:created` | ServiceRegistry | `{ serviceName, providerType, instanceName, dependencyNames }` |
| `api-auth-setup` | ServiceRegistry | `{ keyCount, requireApiKey, excludePaths }` |
| `dependencies:initialized` | ServiceRegistry | `{ dependencies }` |
| `log:info:<instance>` | logging | `{ message }` |
| `cache:put:<instance>` | caching | `{ key, value, instance }` |
| `cache:get:<instance>` | caching | `{ key, value, instance }` |
| `worker:queued` | working | `{ taskId, scriptPath, queueLength }` |
| `worker:start` | working | `{ taskId, scriptPath, activeWorkers }` |
| `worker:status` | working | `{ taskId, status, data }` |
| `worker:error` | working | `{ taskId, error }` |
| `scheduler:started` | scheduling | `{ taskName, scriptPath, intervalSeconds }` |
| `scheduler:stopped` | scheduling | `{ taskName }` |
| `scheduler:taskExecuted` | scheduling | `{ taskName, status, data }` |
| `workflow:defined` | workflow | `{ workflowName, steps, definition }` |
| `workflow:start` | workflow | `{ workflowName, workflowId, initialData }` |
| `workflow:step:start` | workflow | `{ workflowName, stepName, stepNumber }` |
| `workflow:step:end` | workflow | `{ workflowName, stepName, stepOutput }` |
| `workflow:step:error` | workflow | `{ workflowName, stepName, error }` |
| `workflow:complete` | workflow | `{ workflowName, workflowId, finalData }` |
| `workflow:error` | workflow | `{ workflowName, workflowId, error }` |
