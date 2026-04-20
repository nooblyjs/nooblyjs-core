# Workflow Service (`src/workflow/`)

**Dependency level:** 3 – Application
**Dependencies:** `logging`, `queueing`, `scheduling`, `measuring`, `working`

Orchestrates multi-step workflows by executing a sequence of activity scripts via the working service. Each step receives the original input data plus all accumulated outputs from previous steps.

---

## Factory (`src/workflow/index.js`)

```javascript
const workflow = registry.workflow('memory');
```

### `createWorkflowService(type, options, eventEmitter)` → `WorkflowService`

| `type` value | Provider |
|---|---|
| `'memory'` (default) | `WorkflowService` (in-process) |
| `'api'` | `WorkflowApi` (delegates to remote workflow API) |

**After creating:**
1. Creates `WorkflowAnalytics` singleton.
2. Injects `logger`, `queueing`, `scheduling`, `measuring`, `working` dependencies.
3. Registers REST routes and dashboard view.
4. Exposes `getSettings` / `saveSettings`.

---

## WorkflowService Class

### Constructor

```javascript
new WorkflowService(eventEmitter, workingService)
```

- `this.workflows` – `Map<string, string[]>` – legacy map of workflow name → step file paths.
- `this.definitionContainer` – `WorkflowDefinitionContainer` – structured definition storage.
- `this.executionContainer` – `WorkflowExecutionContainer` – execution history (max 1000 per workflow).
- `this.workingService_` – the working service instance.

### Settings

| Setting | Type | Default |
|---|---|---|
| `maxSteps` | number | `50` |
| `timeoutPerStep` | number | `60000` (ms) |
| `parallelExecution` | boolean | `false` |

---

### Methods

#### `async defineWorkflow(workflowName, steps, metadata)` → `definition`

Registers a workflow.

**Parameters:**
- `workflowName` – non-empty string (throws if invalid).
- `steps` – non-empty array of **file paths** to activity scripts (throws if invalid).
- `metadata` – optional metadata object.

**What it does:**
1. Stores steps in both `this.workflows` (legacy) and `this.definitionContainer.define()`.
2. Emits `workflow:defined` with `{ workflowName, steps, definition }`.
3. Returns the definition object.

```javascript
await workflow.defineWorkflow('order-processing', [
  '/activities/validate-order.js',
  '/activities/charge-payment.js',
  '/activities/send-confirmation.js'
]);
```

#### `async runWorkflow(workflowName, data, statusCallback)` → `void`

Executes a previously defined workflow step-by-step.

**Parameters:**
- `workflowName` – must exist in `this.workflows`.
- `data` – initial input data object.
- `statusCallback` – function called at each lifecycle event (optional, defaults to no-op).

**Execution algorithm:**

```
1. Validate workflowName exists and workingService_ is available.
2. Generate unique workflowId: "name-timestamp-random"
3. Emit 'workflow:start'
4. For each step (i = 0..steps.length-1):
   a. Build currentAccumulatedData = { ...originalData, steps: [...accumulatedSteps] }
   b. Call statusCallback({ status: 'step_start', stepName, stepNumber, data })
   c. Emit 'workflow:step:start'
   d. Await workingService_.start(stepPath, currentAccumulatedData, callback)
      - Wrapped in Promise, resolves on 'completed', rejects on 'error'
   e. Normalize stepOutput to object (primitives wrapped in { value: result })
   f. Push to accumulatedSteps: { stepNumber, stepName, stepPath, data: stepOutput }
   g. Call statusCallback({ status: 'step_end', stepOutput, data: newAccumulatedData })
   h. Emit 'workflow:step:end'
   i. On step error:
      - Call statusCallback({ status: 'step_error', error })
      - Emit 'workflow:step:error' and 'workflow:error'
      - Re-throw to abort remaining steps
5. Build finalAccumulatedData = { ...originalData, steps: accumulatedSteps }
6. Record in executionContainer with status 'completed'
7. Call statusCallback({ status: 'workflow_complete', finalData, steps })
8. Emit 'workflow:complete'
On outer catch:
   - Record in executionContainer with status 'error'
   - Re-throw
```

**Data structure passed to each step:**
```javascript
{
  // All original input keys preserved
  orderId: 123,
  amount: 50,
  // Accumulated previous step outputs
  steps: [
    {
      stepNumber: 1,
      stepName: 'validate-order',
      stepPath: '/activities/validate-order.js',
      data: { valid: true, items: [...] }
    }
  ]
}
```

**statusCallback signatures:**

| `status` | Additional fields |
|---|---|
| `'step_start'` | `stepName`, `stepPath`, `stepNumber`, `data` |
| `'step_end'` | `stepName`, `stepPath`, `stepNumber`, `data`, `stepOutput` |
| `'step_error'` | `stepName`, `stepPath`, `stepNumber`, `error`, `partialData` |
| `'workflow_complete'` | `workflowName`, `finalData`, `steps` |

#### `async getSettings()` / `async saveSettings(settings)`

Standard settings get/save.

---

## WorkflowDefinitionContainer (`src/workflow/containers/WorkflowDefinitionContainer.js`)

Stores workflow definitions with metadata. Provides:
- `define(name, steps, metadata)` – stores a new definition.
- `get(name)` – retrieves a definition.
- `list()` – returns all definitions.
- `delete(name)` – removes a definition.

---

## WorkflowExecutionContainer (`src/workflow/containers/WorkflowExecutionContainer.js`)

Stores execution history per workflow. Provides:
- `record(workflowName, execution)` – stores an execution record.
- `getExecutions(workflowName)` – returns executions for a workflow.
- `getAllExecutions()` – returns all executions.
- Enforces `maxExecutionsPerWorkflow` (default 1000) by evicting oldest entries.

Each execution record:
```javascript
{
  executionId: string,
  inputData: Object,
  outputData: Object,
  status: 'completed' | 'error',
  startedAt: ISO string,
  endedAt: ISO string,
  duration: number (ms),
  error: string | null,
  stepExecutions: Array<{
    stepName, stepPath, inputData, outputData,
    status, startedAt, endedAt, duration, error
  }>
}
```

---

## Events

| Event | Payload |
|---|---|
| `workflow:defined` | `{ workflowName, steps, definition }` |
| `workflow:start` | `{ workflowName, workflowId, initialData }` |
| `workflow:step:start` | `{ workflowName, stepName, stepPath, stepNumber, data }` |
| `workflow:step:end` | `{ workflowName, stepName, stepPath, stepNumber, data, stepOutput }` |
| `workflow:step:error` | `{ workflowName, stepName, stepPath, stepNumber, error, partialData }` |
| `workflow:complete` | `{ workflowName, workflowId, finalData, steps }` |
| `workflow:error` | `{ workflowName, workflowId, error, partialData }` |

---

## Routes

Mounted at `/services/workflow/api/`:

| Method | Path | Description |
|---|---|---|
| `GET` | `/services/workflow/api/status` | Service status |
| `GET` | `/services/workflow/api/workflows` | List defined workflows |
| `GET` | `/services/workflow/api/workflow/:name` | Get workflow definition |
| `POST` | `/services/workflow/api/define` | Define a new workflow |
| `POST` | `/services/workflow/api/run` | Execute a workflow |
| `GET` | `/services/workflow/api/executions` | All execution history |
| `GET` | `/services/workflow/api/executions/:name` | Executions for a workflow |
| `POST` | `/services/workflow/api/settings` | Update settings |

---

## Client-Side Script (`src/workflow/scripts/js/index.js`)

Browser-loadable class for interacting with the workflow API.

---

## Built-in Activity (`src/workflow/activities/workflow-run-workflow.js`)

An activity that launches another workflow from within a workflow step (workflow-of-workflows pattern).

---

## Usage

```javascript
// 1. Define the workflow
await workflow.defineWorkflow('checkout', [
  '/path/to/activities/validate-cart.js',
  '/path/to/activities/process-payment.js',
  '/path/to/activities/send-receipt.js'
]);

// 2. Run it
await workflow.runWorkflow(
  'checkout',
  { cartId: 'abc', userId: 42 },
  (event) => {
    if (event.status === 'workflow_complete') {
      console.log('Final data:', event.finalData);
      console.log('Steps completed:', event.finalData.steps.length);
    }
    if (event.status === 'step_error') {
      console.error('Step failed:', event.error);
    }
  }
);
```

---

## Example Activity Script

```javascript
// /activities/validate-cart.js
module.exports = async function(data) {
  // data contains original input + steps array from prior steps
  const { cartId, userId, steps } = data;

  // Validate the cart
  const cart = await fetchCart(cartId);
  if (!cart || cart.items.length === 0) {
    throw new Error('Cart is empty or not found');
  }

  // Return output for this step
  return {
    valid: true,
    cartTotal: cart.items.reduce((sum, i) => sum + i.price, 0),
    itemCount: cart.items.length
  };
};
```
