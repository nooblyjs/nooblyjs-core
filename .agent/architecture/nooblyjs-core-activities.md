# Activities Folder

This folder contains worker activity scripts that can be executed by the NooblyJS Working service.

## Overview

Activities are background tasks that run in separate worker threads. They are automatically discovered and resolved by the working service - you only need to reference them by filename!

## Usage

### Simple Activity Reference

```javascript
// No need for path.resolve() or absolute paths!
await worker.start('exampleTask.js', { myData: 'value' });
```

The working service automatically:
- Resolves `exampleTask.js` to `./activities/exampleTask.js`
- Verifies the file exists (using filing service)
- Executes it in a worker thread

### Activity Structure

Each activity must export a `run` function:

```javascript
const { parentPort } = require('worker_threads');

async function run(data) {
  // Your processing logic here
  console.log('Processing data:', data);

  // Simulate async work
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    success: true,
    processedData: data,
    timestamp: new Date().toISOString()
  };
}

module.exports = { run };
```

## Configuration

### Default Activities Folder

By default, the working service looks for activities in `./activities` relative to your project root.

### Custom Activities Folder

You can configure a custom activities folder:

```javascript
const working = serviceRegistry.working('default', {
  activitiesFolder: '/custom/path/to/activities',
  dependencies: { queueing, filing }
});
```

Or use the alternative option name:

```javascript
const working = serviceRegistry.working('default', {
  'noobly-core-activities': './my-activities',
  dependencies: { queueing, filing }
});
```

## Activity Examples

### Example: Email Sender

```javascript
// activities/sendEmail.js
const { parentPort } = require('worker_threads');

async function run(data) {
  const { to, subject, body } = data;

  // Simulate sending email
  console.log(`Sending email to ${to}`);
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    success: true,
    messageId: `msg-${Date.now()}`,
    recipient: to
  };
}

module.exports = { run };
```

Usage:
```javascript
await worker.start('sendEmail.js', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Thanks for signing up'
});
```

### Example: Data Processing

```javascript
// activities/processData.js
const { parentPort } = require('worker_threads');

async function run(data) {
  const { userId, action, records } = data;

  console.log(`Processing ${records.length} records for user ${userId}`);

  const processed = records.map(record => ({
    ...record,
    processed: true,
    processedAt: new Date().toISOString()
  }));

  return {
    success: true,
    userId,
    action,
    processedCount: processed.length,
    results: processed
  };
}

module.exports = { run };
```

### Example: Image Processing

```javascript
// activities/processImage.js
const { parentPort } = require('worker_threads');

async function run(data) {
  const { imageId, operations } = data;

  console.log(`Processing image ${imageId} with operations:`, operations);

  // Simulate image processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    success: true,
    imageId,
    operations,
    outputPath: `/processed/${imageId}.jpg`,
    completedAt: new Date().toISOString()
  };
}

module.exports = { run };
```

## Best Practices

1. **Keep activities focused**: Each activity should do one thing well
2. **Handle errors**: Wrap your logic in try-catch blocks
3. **Return meaningful results**: Include success status and relevant data
4. **Log progress**: Use console.log for debugging (visible in worker logs)
5. **Avoid blocking operations**: Use async/await for I/O operations
6. **Test activities**: Create unit tests for activity logic

## Queue Integration

The working service automatically manages activity execution through queues:

- **Incoming Queue** (`noobly-core-working-incoming`): Tasks waiting to be processed
- **Complete Queue** (`noobly-core-working-complete`): Successfully completed tasks
- **Error Queue** (`noobly-core-working-error`): Failed tasks

You can monitor these queues:

```javascript
const status = await worker.getStatus();
console.log('Queue sizes:', status.queues);
// { incoming: 5, complete: 23, error: 2 }
```

## Troubleshooting

### Activity Not Found

If you get "Activity script not found" error:
- Check the filename matches exactly
- Verify the file is in the activities folder
- Make sure filing service is initialized

### Activity Fails to Execute

- Check the activity exports a `run` function
- Verify the activity doesn't have syntax errors
- Check worker logs for error details

## See Also

- [Working Service Documentation](../docs/nooblyjs-core-usage-guide.md#working-service)
- [Queue Service Documentation](../docs/nooblyjs-core-usage-guide.md#queueing-service)
