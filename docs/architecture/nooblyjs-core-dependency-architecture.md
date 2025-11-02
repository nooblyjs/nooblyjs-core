# NooblyJS Service Dependency Architecture

**A Hierarchical Approach to Inter-Service Communication**

## Overview

This document outlines the complete service dependency architecture for **nooblyjs-core v1.0.14+**. The architecture implements a sophisticated 5-level service hierarchy (Levels 0-4) where services leverage other services through automatic dependency injection. This layered approach prevents circular dependencies while enabling powerful service composition.

### Key Architectural Features

- **13 Services** organized across 5 dependency levels (0-4)
- **Automatic Dependency Injection** via ServiceRegistry singleton
- **Topological Sorting** for correct initialization order
- **Circular Dependency Prevention** with graph validation
- **Singleton Pattern** - One instance per `service:provider` combination
- **Recursive Dependency Resolution** - Dependencies are auto-created
- **Multiple Provider Support** - Memory, Redis, S3, API, and more
- **RESTful APIs** - Auto-generated at `/services/{service}/api/*`
- **Event-Driven Architecture** - Global EventEmitter for communication

### Architecture Summary

```
Level 4: Integration Services    (aiservice, authservice)
            ↓
Level 3: Application Services    (workflow, searching, scheduling, filing)
            ↓
Level 2: Business Logic Services (working, measuring, dataservice)
            ↓
Level 1: Infrastructure Services (caching, queueing, notifying)
            ↓
Level 0: Foundation Services     (logging)
```

This architecture transforms nooblyjs-core from a collection of isolated services into a cohesive, enterprise-ready platform where services work together seamlessly while maintaining clean separation of concerns.

---

## 🏗️ **Service Hierarchy Levels**

### **Level 0: Foundation Services** (No Dependencies)
*These services provide core functionality and cannot depend on other NooblyJS services*

```
  ┌─────────────┐ 
  │   Logging   │  
  │   (Base)    │  
  └─────────────┘  
```

**Services:**
- **Logging** - Fundamental logging capabilities

### **Level 1: Infrastructure Services** (Depend on Logging)
*Core infrastructure that uses logging for operations tracking and provides event-driven capabilities*

```
 ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
 │   Caching    │  │  Queueing   │  │  Notifying   │
 │  (Cache)     │  │  (Queues)   │  │  (EventBus)  │
 └──────┬───────┘  └──────┬──────┘  └──────┬───────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                   ┌─────▼─────┐
                   │  Logging  │
                   │ (Level 0) │
                   └───────────┘
```

**Services:**
- **Caching** - Caching system operations (depends on: logging)
- **Queueing** - Queueing operations (depends on: logging)
- **Notifying** - Pub/sub event bus for inter-service communication (depends on: logging)

**Characteristics:**
- Use logging for operation tracking and debugging
- Provide essential infrastructure capabilities
- Can use external libraries and logging service
- Notifying service enables event-driven patterns throughout higher-level services

---

### **Level 2: Business Logic Services** (Use Infrastructure Services)
*Services that build on infrastructure capabilities*

```
          ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
          │ Dataservice │  │   Working   │  │  Measuring  │
          │             │  │             │  │             │
          └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
                 │                │                │
        ┌────────┴──────┐    ┌────┴────┬──────────┴──────┐
        │               │    │         │                 │
┌───────▼───────┐ ┌─────▼─────┐ ┌─────▼─────┐  ┌────────▼────────┐
│    Logging    │ │  Queueing │ │  Logging  │  │  Logging        │
│   (Level 0)   │ │ (Level 1) │ │ (Level 0) │  │  (Level 0)      │
└───────────────┘ └───────────┘ └───────────┘  └─────────────────┘
                                ┌─────▼─────┐  ┌────────▼────────┐
                                │  Queueing │  │    Queueing     │
                                │ (Level 1) │  │   (Level 1)     │
                                └───────────┘  └─────────────────┘
                                ┌─────▼─────┐  ┌────────▼────────┐
                                │  Caching  │  │    Caching      │
                                │ (Level 1) │  │   (Level 1)     │
                                └───────────┘  └─────────────────┘
```

**Services:**
- **Dataservice** - Uses logging and queueing for data persistence (depends on: logging, queueing)
- **Working** - Uses logging, queueing, caching for job execution (depends on: logging, queueing, caching)
- **Measuring** - Metrics collection with logging, queueing, caching (depends on: logging, queueing, caching)

**Example Usage:**
```javascript
// Dataservice logs operations and uses filing for persistence
await dataStore.put('users', userData);
// Internally: logger.info('Data stored', { container: 'users' });
//            filing.write('data/users.json', serializedData);

// Working service uses queueing and caching for job management
await working.execute(scriptPath, args);
// Internally: logger.info('Job started', { scriptPath });
//            queueing.enqueue({ type: 'job', script: scriptPath });
//            caching.set(`job:${jobId}:status`, 'running');
```

---

### **Level 3: Application Services** (Use Business Logic Services)
*Services that orchestrate complex operations using business logic*

```
        ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
        │ Scheduling  │  │  Searching  │  │  Workflow   │  │   Filing    │
        │             │  │             │  │             │  │  (Storage)  │
        └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
               │                │                │                │
     ┌─────────┴──┐    ┌────────┴────────┬───────┴────────┬─────────┬───────────┐
     │            │    │                 │                │         │           │
┌────▼────┐ ┌────▼────┐ ┌──────▼──────┐ ┌────▼────┐ ┌────▼────┐ ┌──▼──────┐ ┌──▼──────┐
│ Logging │ │ Working │ │ Logging     │ │ Caching │ │Datasrvc │ │ Logging │ │ Logging │
│(Level 0)│ │(Level 2)│ │ (Level 0)   │ │(Level 1)│ │(Level 2)│ │(Level 0)│ │(Level 0)│
└─────────┘ └─────────┘ └─────────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
                         ┌──────▼──────┐ ┌────▼────┐ ┌────▼────┐
                         │  Queueing   │ │ Working │ │Queueing │
                         │  (Level 1)  │ │(Level 2)│ │(Level 1)│
                         └─────────────┘ └─────────┘ └─────────┘
                                         ┌────▼────────┐
                                         │ Scheduling  │
                                         │  (Level 3)  │
                                         └─────────────┘

```

**Services:**
- **Scheduling** - Task scheduling with logging and working (depends on: logging, working)
- **Searching** - Full-text search with logging, caching, dataservice, queueing, working, scheduling (depends on: logging, caching, dataservice, queueing, working, scheduling)
- **Workflow** - Multi-step workflows with logging, queueing, scheduling, measuring, working (depends on: logging, queueing, scheduling, measuring, working)
- **Filing** - File system operations with logging, queueing, and dataservice for metadata (depends on: logging, queueing, dataservice)

**Example Usage:**
```javascript
// Queueing service with enhanced capabilities
class EnhancedQueue {
  constructor(options, eventEmitter, services) {
    this.cache = services.cache;
    this.dataStore = services.dataService;
    this.logger = services.logger;
  }

  async enqueue(item) {
    // Cache queue size for performance
    const queueSize = await this.cache.get('queue:size') || 0;

    // Persist to datastore for durability
    const id = await this.dataStore.add('queue_items', {
      item,
      enqueuedAt: new Date(),
      status: 'pending'
    });

    // Update cached size
    await this.cache.set('queue:size', queueSize + 1);

    // Log operation
    this.logger.info('Item enqueued', { id, queueSize: queueSize + 1 });

    return id;
  }
}
```

---

### **Level 4: Integration Services** (Use Application Services)
*High-level services that provide user-facing functionality*

```
┌──────────────┐  ┌─────────────┐
│ Authservice  │  │  AIService  │
│              │  │             │
└──────┬───────┘  └──────┬──────┘
       │                 │
   ┌───┴────┬────┐   ┌───┴────┬──────┬───────────┬─────────┐
   │        │    │   │        │      │           │         │
┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌───▼────┐ ┌───▼────┐ ┌──▼──┐
│ Log │ │Cache│ │Data │ │ Log │ │ Cache  │ │Workflow│ │Queue│
│(L0) │ │(L1) │ │(L2) │ │(L0) │ │  (L1)  │ │  (L3)  │ │(L1) │
└─────┘ └─────┘ └─────┘ └─────┘ └────────┘ └────────┘ └─────┘
```

**Services:**

- **Authservice** - Authentication/authorization with logging, caching, dataservice (depends on: logging, caching, dataservice)
- **AIService** - LLM integration with logging, caching, workflow, queueing (depends on: logging, caching, workflow, queueing)

---

## 🔧 **Implementation Architecture**

### **1. Service Registry with Dependency Injection**

```javascript
class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.serviceDependencies = new Map();
    this.initialized = false;
  }

  /**
   * Initialize service dependencies (called once during initialization)
   */
  initializeServiceDependencies() {
    if (this.dependenciesInitialized) {
      return;
    }

    // Level 0 services (Foundation - No dependencies)
    this.serviceDependencies.set('logging', []);

    // Level 1 services (Infrastructure - Use foundation services)
    this.serviceDependencies.set('caching', ['logging']);
    this.serviceDependencies.set('queueing', ['logging']);
    this.serviceDependencies.set('notifying', ['logging']);

    // Level 2 services (Business Logic - Use infrastructure services)
    this.serviceDependencies.set('dataservice', ['logging', 'queueing']);
    this.serviceDependencies.set('working', ['logging', 'queueing', 'caching']);
    this.serviceDependencies.set('measuring', ['logging', 'queueing', 'caching']);

    // Level 3 services (Application - Use business logic services)
    this.serviceDependencies.set('scheduling', ['logging', 'working']);
    this.serviceDependencies.set('searching', ['logging', 'caching', 'dataservice', 'queueing', 'working', 'scheduling']);
    this.serviceDependencies.set('workflow', ['logging', 'queueing', 'scheduling', 'measuring', 'working']);
    this.serviceDependencies.set('filing', ['logging', 'queueing', 'dataservice']);

    // Level 4 services (Integration - Use application services)
    this.serviceDependencies.set('authservice', ['logging', 'caching', 'dataservice']);
    this.serviceDependencies.set('aiservice', ['logging', 'caching', 'workflow', 'queueing']);

    this.dependenciesInitialized = true;
  }

  /**
   * Initialize the service registry with Express app and event emitter
   */
  initialize(app, eventEmitter = null, options = {}) {
    if (this.initialized) {
      throw new Error('ServiceRegistry already initialized');
    }

    this.app = app;
    this.eventEmitter = eventEmitter || new EventEmitter();
    this.globalOptions = options;

    // Initialize dependency map
    this.initializeServiceDependencies();

    // Validate no circular dependencies
    this.validateDependencies();

    this.initialized = true;
  }

  /**
   * Get service with dependencies injected (Singleton Pattern)
   * Services are cached using key: serviceName:providerType
   */
  getService(serviceName, providerType = null, explicitOptions = {}) {
    if (!this.initialized) {
      throw new Error('ServiceRegistry must be initialized before getting services');
    }

    // Determine provider type
    const actualProviderType = providerType || this.getDefaultProviderType(serviceName);

    // Singleton key: serviceName:providerType
    const serviceKey = `${serviceName}:${actualProviderType}`;

    // Return cached instance if exists
    if (this.services.has(serviceKey)) {
      return this.services.get(serviceKey);
    }

    // Resolve dependencies recursively
    const dependencies = this.resolveDependencies(serviceName, actualProviderType);

    // Load service factory
    const serviceFactory = require(`./src/${serviceName}`);

    // Merge options
    const serviceOptions = {
      ...this.globalOptions,
      ...explicitOptions,
      dependencies,
      'express-app': this.app
    };

    // Create service instance
    const service = serviceFactory(actualProviderType, serviceOptions, this.eventEmitter);

    // Cache the instance
    this.services.set(serviceKey, service);

    return service;
  }

  /**
   * Resolve dependencies for a service (recursive)
   */
  resolveDependencies(serviceName, requestedProviderType = 'memory') {
    const dependencies = {};
    const requiredDependencies = this.serviceDependencies.get(serviceName) || [];

    for (const depServiceName of requiredDependencies) {
      const depProviderType = this.getDefaultProviderType(depServiceName);
      const depServiceKey = `${depServiceName}:${depProviderType}`;

      if (this.services.has(depServiceKey)) {
        dependencies[depServiceName] = this.services.get(depServiceKey);
      } else {
        // Recursively create dependency
        dependencies[depServiceName] = this.getService(depServiceName, depProviderType);
      }
    }

    return dependencies;
  }

  /**
   * Get default provider type for a service
   */
  getDefaultProviderType(serviceName) {
    const defaults = {
      logging: 'memory',
      caching: 'memory',
      filing: 'local',
      dataservice: 'memory',
      queueing: 'memory',
      working: 'memory',
      measuring: 'memory',
      scheduling: 'memory',
      searching: 'memory',
      workflow: 'memory',
      notifying: 'memory',
      authservice: 'memory',
      aiservice: 'claude'
    };

    return defaults[serviceName] || 'memory';
  }

  /**
   * Validate dependencies for circular references
   */
  validateDependencies() {
    const visited = new Set();
    const visiting = new Set();

    const visit = (serviceName) => {
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving service: ${serviceName}`);
      }

      if (visited.has(serviceName)) {
        return;
      }

      visiting.add(serviceName);

      const deps = this.serviceDependencies.get(serviceName) || [];
      for (const dep of deps) {
        if (!this.serviceDependencies.has(dep)) {
          throw new Error(`Service '${serviceName}' depends on unknown service '${dep}'`);
        }
        visit(dep);
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
    };

    for (const serviceName of this.serviceDependencies.keys()) {
      visit(serviceName);
    }
  }

  /**
   * Calculate service initialization order using topological sort
   */
  getServiceInitializationOrder() {
    const visited = new Set();
    const visiting = new Set();
    const order = [];

    const visit = (serviceName) => {
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving service: ${serviceName}`);
      }

      if (visited.has(serviceName)) {
        return;
      }

      visiting.add(serviceName);

      const deps = this.serviceDependencies.get(serviceName) || [];
      for (const dep of deps) {
        visit(dep);
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      order.push(serviceName);
    };

    for (const serviceName of this.serviceDependencies.keys()) {
      visit(serviceName);
    }

    return order;
  }

  /**
   * Convenience methods for getting services
   * Example: serviceRegistry.caching('redis') returns a caching service with redis provider
   */
  caching(providerType = null, options = {}) {
    return this.getService('caching', providerType, options);
  }

  filing(providerType = null, options = {}) {
    return this.getService('filing', providerType, options);
  }

  // ... similar methods for all 13 services
}
```

### **2. Enhanced Service Factory Pattern**

```javascript
// Enhanced service factory with dependency injection
function createEnhancedService(serviceName) {
  return function(providerType, options, eventEmitter) {
    const { dependencies = {}, ...serviceOptions } = options;

    // Create service instance
    const ServiceClass = require(`./providers/${serviceName}`);
    const service = new ServiceClass(serviceOptions, eventEmitter);

    // Inject dependencies
    service.dependencies = dependencies;

    // Add dependency-aware methods
    if (dependencies.logger) {
      service.log = (level, message, meta) => dependencies.logger[level](message, meta);
    }

    if (dependencies.cache) {
      service.cache = dependencies.cache;
    }

    if (dependencies.dataService) {
      service.dataStore = dependencies.dataService;
    }

    return service;
  };
}
```

### **3. Service Configuration**

```javascript
// config/services.js
module.exports = {
  services: {
    // Level 0 services
    logging: {
      enabled: true,
      provider: 'console',
      options: { level: 'info' }
    },

    filing: {
      enabled: true,
      provider: 'local',
      options: { basePath: './data' }
    },

    measuring: {
      enabled: true,
      provider: 'memory',
      options: { retentionPeriod: 3600 }
    },

    // Level 1 services
    caching: {
      enabled: true,
      provider: 'redis',
      options: {
        host: 'localhost',
        port: 6379,
        // Dependencies will be auto-injected
        useDependencies: ['logging']
      }
    },

    // Level 2 services
    queueing: {
      enabled: true,
      provider: 'redis',
      options: {
        host: 'localhost',
        port: 6379,
        // Enhanced with persistence and caching
        useDependencies: ['logging', 'caching', 'dataservice'],
        features: {
          persistence: true,
          caching: true,
          deadLetterQueue: true
        }
      }
    }
  }
};
```

---

## 📈 **Enhanced Service Capabilities**

### **Enhanced Queueing Service**

```javascript
class EnhancedQueueService {
  constructor(options, eventEmitter) {
    this.options = options;
    this.eventEmitter = eventEmitter;
    this.dependencies = {};
  }

  // Dependency injection setter
  setDependencies(dependencies) {
    this.dependencies = dependencies;
    this.logger = dependencies.logging;
    this.cache = dependencies.caching;
    this.dataStore = dependencies.dataservice;
  }

  async enqueue(item, options = {}) {
    const startTime = Date.now();

    try {
      // 1. Generate unique job ID
      const jobId = this.generateJobId();

      // 2. Store job in persistent storage
      if (this.dataStore && this.options.features?.persistence) {
        await this.dataStore.add('queue_jobs', {
          id: jobId,
          item,
          status: 'pending',
          enqueuedAt: new Date(),
          priority: options.priority || 0,
          attempts: 0,
          maxAttempts: options.maxAttempts || 3
        });
      }

      // 3. Cache job for quick access
      if (this.cache) {
        await this.cache.set(`job:${jobId}`, item, 3600); // 1 hour TTL

        // Update queue metrics in cache
        const queueSize = await this.cache.get('queue:size') || 0;
        await this.cache.set('queue:size', queueSize + 1);
      }

      // 4. Add to processing queue
      await this.addToProcessingQueue(jobId, item, options);

      // 5. Log operation
      if (this.logger) {
        this.logger.info('Job enqueued', {
          jobId,
          priority: options.priority,
          queueSize: (await this.cache?.get('queue:size')) || 'unknown'
        });
      }

      // 6. Emit event
      this.eventEmitter.emit('queue:enqueue', { jobId, item });

      // 7. Record metrics
      if (this.dependencies.measuring) {
        const duration = Date.now() - startTime;
        this.dependencies.measuring.add('queue.enqueue.duration', duration);
        this.dependencies.measuring.add('queue.enqueue.count', 1);
      }

      return jobId;

    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to enqueue job', { error: error.message, item });
      }
      throw error;
    }
  }

  async dequeue() {
    // Enhanced dequeue with caching, logging, and metrics
    const startTime = Date.now();

    try {
      // 1. Get job from processing queue
      const job = await this.getFromProcessingQueue();

      if (!job) return null;

      // 2. Get full job data from cache or storage
      let jobData = null;
      if (this.cache) {
        jobData = await this.cache.get(`job:${job.id}`);
      }

      if (!jobData && this.dataStore) {
        const storedJob = await this.dataStore.getByUuid('queue_jobs', job.id);
        jobData = storedJob?.item;
      }

      // 3. Update job status
      if (this.dataStore) {
        await this.updateJobStatus(job.id, 'processing');
      }

      // 4. Update cache metrics
      if (this.cache) {
        const queueSize = await this.cache.get('queue:size') || 0;
        await this.cache.set('queue:size', Math.max(0, queueSize - 1));
      }

      // 5. Log operation
      if (this.logger) {
        this.logger.info('Job dequeued', { jobId: job.id });
      }

      // 6. Record metrics
      if (this.dependencies.measuring) {
        const duration = Date.now() - startTime;
        this.dependencies.measuring.add('queue.dequeue.duration', duration);
        this.dependencies.measuring.add('queue.dequeue.count', 1);
      }

      return { id: job.id, data: jobData };

    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to dequeue job', { error: error.message });
      }
      throw error;
    }
  }

  // Dead letter queue functionality
  async moveToDeadLetterQueue(jobId, error) {
    if (this.dependencies.dataservice) {
      await this.dependencies.dataservice.add('dead_letter_queue', {
        originalJobId: jobId,
        error: error.message,
        movedAt: new Date()
      });

      if (this.logger) {
        this.logger.warn('Job moved to dead letter queue', { jobId, error: error.message });
      }
    }
  }
}
```

### **Enhanced Workflow Service**

```javascript
class EnhancedWorkflowService {
  constructor(eventEmitter) {
    this.workflows = new Map();
    this.eventEmitter = eventEmitter;
    this.dependencies = {};
  }

  async executeWorkflow(workflowName, data, options = {}) {
    const workflowId = this.generateWorkflowId();

    try {
      // 1. Queue workflow for execution if queueing is available
      if (this.dependencies.queueing && options.async) {
        await this.dependencies.queueing.enqueue({
          type: 'workflow',
          workflowName,
          data,
          workflowId
        }, { priority: options.priority });

        return { workflowId, status: 'queued' };
      }

      // 2. Schedule workflow if scheduling is available
      if (this.dependencies.scheduling && options.schedule) {
        await this.dependencies.scheduling.start(
          `workflow-${workflowId}`,
          this.createWorkflowScript(workflowName, data),
          options.schedule
        );

        return { workflowId, status: 'scheduled' };
      }

      // 3. Execute workflow immediately
      return await this.executeWorkflowSteps(workflowName, data, workflowId);

    } catch (error) {
      if (this.dependencies.logging) {
        this.dependencies.logging.error('Workflow execution failed', {
          workflowId,
          workflowName,
          error: error.message
        });
      }
      throw error;
    }
  }

  async executeWorkflowSteps(workflowName, data, workflowId) {
    const steps = this.workflows.get(workflowName);
    let currentData = data;

    for (let i = 0; i < steps.length; i++) {
      const stepStart = Date.now();

      try {
        // Execute step
        currentData = await this.executeStep(steps[i], currentData, workflowId);

        // Record metrics
        if (this.dependencies.measuring) {
          const duration = Date.now() - stepStart;
          this.dependencies.measuring.add('workflow.step.duration', duration);
          this.dependencies.measuring.add('workflow.step.success', 1);
        }

        // Log progress
        if (this.dependencies.logging) {
          this.dependencies.logging.info('Workflow step completed', {
            workflowId,
            step: i + 1,
            totalSteps: steps.length
          });
        }

      } catch (error) {
        // Record failure metrics
        if (this.dependencies.measuring) {
          this.dependencies.measuring.add('workflow.step.failure', 1);
        }

        throw error;
      }
    }

    return { workflowId, status: 'completed', result: currentData };
  }
}
```

---

## 🚀 **Benefits of Service Dependency Architecture**

### **1. Enhanced Performance**
- **Caching**: Services can cache frequently accessed data
- **Async Processing**: Services can queue heavy operations
- **Metrics**: Performance monitoring across all service interactions

### **2. Improved Reliability**
- **Persistence**: Critical operations are persisted
- **Logging**: Comprehensive audit trails
- **Dead Letter Queues**: Failed operations are preserved for retry

### **3. Better Observability**
- **Distributed Logging**: All operations are logged with correlation IDs
- **Metrics Collection**: Performance and usage metrics across services
- **Event Tracing**: Full visibility into service interactions

### **4. Reduced Development Time**
- **Reusable Patterns**: Common patterns like caching, logging, queuing
- **Consistent APIs**: Standardized interfaces across enhanced services
- **Built-in Features**: Persistence, retry logic, monitoring out-of-the-box

---

## 📊 **Complete Service Dependency Table**

| Level | Service      | Dependencies                                                      | Provider Support            |
|-------|--------------|-------------------------------------------------------------------|-----------------------------|
| 0     | logging      | none                                                              | memory, file, api           |
| 1     | caching      | logging                                                           | memory, redis, memcached, file, api |
| 1     | queueing     | logging                                                           | memory, api                 |
| 1     | notifying    | logging                                                           | memory, api                 |
| 2     | dataservice  | logging, queueing                                                 | memory, simpledb, file, api |
| 2     | working      | logging, queueing, caching                                        | memory, api                 |
| 2     | measuring    | logging, queueing, caching                                        | memory, api                 |
| 3     | scheduling   | logging, working                                                  | memory, api                 |
| 3     | searching    | logging, caching, dataservice, queueing, working, scheduling      | memory, api                 |
| 3     | workflow     | logging, queueing, scheduling, measuring, working                 | memory, api                 |
| 3     | filing       | logging, queueing, dataservice                                    | local, ftp, s3, api         |
| 4     | authservice  | logging, caching, dataservice                                     | memory, api                 |
| 4     | aiservice    | logging, caching, workflow, queueing                              | claude, chatgpt, ollama, api|

## 📋 **Current Implementation Status**

### **✅ Completed (v1.0.14+)**
1. **ServiceRegistry with Dependency Injection** - Fully implemented
   - Singleton pattern with `serviceName:providerType` keys
   - Automatic dependency resolution with recursive creation
   - Topological sort for initialization order
   - Circular dependency validation
   - 13 services across 5 dependency levels (0-4)

2. **All Services Enhanced with Dependencies**
   - All services support dependency injection
   - Logging integrated across all services
   - Caching, queueing, and filing used where appropriate
   - Working, measuring, scheduling, workflow orchestration working

3. **Provider Architecture**
   - Memory providers for all services
   - Redis and Memcached for caching
   - S3 and FTP for filing
   - SimpleDB and file-based storage for dataservice
   - Claude, ChatGPT, Ollama for AI service
   - API provider for distributed/enterprise deployments

4. **RESTful API Layer**
   - Auto-generated routes at `/services/{service}/api/*`
   - Status endpoints for all services
   - CRUD operations following RESTful conventions

5. **Security & Authentication**
   - API key authentication
   - Session-based authentication with Passport
   - RBAC (Role-Based Access Control)
   - OAuth 2.0 integration (Google, GitHub)
   - Password hashing and validation

### **🚀 Future Enhancements (Roadmap)**

#### **v1.1.x - Performance Optimization**
1. Connection pooling for Redis/Memcached
2. Lazy loading of service dependencies
3. Service health checks and auto-recovery
4. Metrics dashboard for all services

#### **v1.2.x - Advanced Features**
1. Distributed tracing across services
2. Service mesh architecture
3. Advanced queueing features (priority, delay, retry)
4. Multi-region support for filing service

#### **v2.0+ - Enterprise Features**
1. Service versioning and backward compatibility
2. Blue-green deployment support
3. A/B testing framework
4. Advanced analytics and reporting

---

## 🎯 **Best Practices**

### 1. Service Initialization
- **Always initialize ServiceRegistry before getting services**
  ```javascript
  serviceRegistry.initialize(app, eventEmitter, options);
  const cache = serviceRegistry.caching('redis'); // Correct
  ```
- **Never get services before initialization** - Will throw error
- **Use singleton pattern** - Call `serviceRegistry.caching('redis')` multiple times returns same instance

### 2. Dependency Management
- **Trust automatic dependency injection** - Don't manually wire dependencies
- **Use default providers for dependencies** - ServiceRegistry automatically selects memory/local providers
- **Avoid circular dependencies** - Architecture validates at startup
- **Respect dependency levels** - Lower-level services cannot depend on higher-level ones

### 3. Provider Selection
- **Development**: Use `memory` providers for fast local development
- **Production**: Use `redis`, `s3`, `api` providers for scalability
- **Testing**: Use `memory` providers for isolated, fast tests
- **Distributed**: Use `api` provider to connect to remote service instances

### 4. Error Handling
- **Graceful degradation** - Services should work even if optional dependencies fail
- **Log all errors** - All services have access to logging dependency
- **Use event emitter** - Emit events for critical failures
- **Validate dependencies** - Use `validateDependencies()` to catch issues early

### 5. Performance Optimization
- **Cache frequently accessed data** - Use caching service dependencies
- **Queue heavy operations** - Use queueing service for async processing
- **Monitor metrics** - Use measuring service to track performance
- **Use appropriate providers** - Memory for speed, Redis for distributed caching

### 6. Testing
- **Test with memory providers** - Fast, isolated unit tests
- **Test dependency injection** - Verify dependencies are correctly injected
- **Test initialization order** - Verify topological sort works correctly
- **Integration tests** - Test with real providers (Redis, S3)

### 7. Production Deployment
- **Set environment variables** - Configure providers via env vars
- **Monitor service health** - Use `/services/{service}/api/status` endpoints
- **Scale horizontally** - Use Redis/API providers for stateless scaling
- **Implement circuit breakers** - Prevent cascade failures

---

## 📚 **Additional Resources**

- **Usage Guide**: `/docs/nooblyjs-core-usage-guide.md` - Comprehensive human-readable guide
- **Quick Reference**: `/docs/nooblyjs-core-usage-guide-concise.md` - AI-optimized quick reference
- **Requirements**: `/docs/nooblyjs-core-requirements-document.md` - Product requirements
- **Main Documentation**: `CLAUDE.md` - Project overview and commands
- **README**: `README.md` - Getting started and API reference

---

## 🔚 **Conclusion**

The nooblyjs-core dependency architecture provides a robust, scalable foundation for building enterprise Node.js applications. By leveraging automatic dependency injection, topological sorting, and a clear 5-level hierarchy, developers can build complex systems with confidence that dependencies are correctly managed and circular references are prevented.

**Key Takeaways:**
- 13 services across 5 levels (0-4)
- Automatic dependency injection via ServiceRegistry
- Singleton pattern prevents duplicate instances
- Topological sort ensures correct initialization
- Multiple providers for flexibility (memory, redis, s3, api)
- RESTful APIs auto-generated for all services
- Production-ready with security, authentication, and monitoring