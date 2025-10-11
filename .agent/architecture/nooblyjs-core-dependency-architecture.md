# NooblyJS Service Dependency Architecture

**A Hierarchical Approach to Inter-Service Communication**

## Overview

This document outlines a sophisticated service hierarchy where NooblyJS services can leverage other services to enhance functionality, improve performance, and reduce code duplication. The architecture follows a layered dependency model that prevents circular dependencies while enabling powerful service composition.

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

### **Level 1: Foundation Services** (No Dependencies)
*These services provide core functionality and cannot depend on other NooblyJS services*

```
 ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
 │   Filing    │  │   Caching   │  │  Queueing   │ 
 │  (Storage)  │  │   (Cache)   │  │  (Queues)   │
 └─────────────┘  └─────────────┘  └─────────────┘
```

**Services:**
- **Filing** - File system operations
- **Caching** - Caching system operations
- **Queueing** - Queueing operations

**Characteristics:**
- Self-contained with no internal dependencies
- Provide essential infrastructure capabilities
- Can use external libraries but not other NooblyJS services

---

### **Level 2: Infrastructure Services** (Use Foundation Services)
*Core infrastructure that enhances foundation services*

```
 ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ 
 │ Dataservice │  │   Working   │  │  Measuring  │ 
 │             │  │             │  │             │ 
 └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ 
        │                │                │               
        └────────────────┘──┐─────────────┘─┐────────────────┐
        │                   │               │                │ 
┌───────▼───────┐   ┌───────▼───────┐ ┌─────▼───────┐  ┌─────▼───────┐
│    Logging    │   │    Filing     │ │   Caching   │  │   Caching   │ 
│   (Level 0)   │   │   (Level 1)   │ │  (Level 1)  │  │  (Level 1)  │
└───────────────┘   └───────────────┘ └─────────────┘  └─────────────┘  
```

**Services:**
- **Dataservice** - Uses logging and filing for data operations
- **Working** - Uses logging for job execution tracking
- **Measuring** - Basic metrics collection

**Example Usage:**
```javascript
// Caching service logs cache operations
await cache.set(key, value);
// Internally: logger.debug('Cache SET', { key, ttl });

// DataServe logs data operations and uses filing for persistence
await dataStore.put('users', userData);
// Internally: logger.info('Data stored', { container: 'users' });
//            filing.write('data/users.json', serializedData);
```

---

### **Level 3: Business Logic Services** (Use Infrastructure Services)
*Services that implement business logic using infrastructure capabilities*

```
        ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ 
        │ Scheduling  │  │  Searching  │  │  Workflow   │ 
        │             │  │             │  │             │
        └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
               │                │                │
               └────────────────┼────────────────┘
                                │
         ┌──────────────┐───────┘────────┐────────────┐
         │              │                │            │
   ┌─────▼────┐  ┌──────▼──────┐  ┌────▼──────┐  ┌────▼──────┐
   │ Caching  │  │ Dataservice │  │  Logging  │  │ Working   │
   │ (Level 1)│  │ (Level 1)   │  │ (Level 0) │  │ (Level 1) │
   └──────────┘  └─────────────┘  └───────────┘  └───────────┘
```

**Services:**
- **Workflow** - Uses queueing for step execution, scheduling for timed workflows, logging/measuring
- **Scheduling** - Uses logging, measuring for performance metrics, queueing for job distribution
- **Searching** - Uses caching for search results, dataservice for indexing, logging for queries

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

### **Level 3: Application Services** (Use Business Logic Services)
*High-level services that orchestrate business operations*

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  
│  Notifying  │  │ Authservice │  │  AIService  │  
│             │  │             │  │             │  
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  
       │                │                │
       └────────────────┼────────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
   ┌─────▼────┐  ┌──────▼──────┐  ┌────▼─────┐
   │Queueing  │  │ Scheduling  │  │ Caching  │
   │(Level 2) │  │ (Level 2)   │  │(Level 1) │
   └──────────┘  └─────────────┘  └──────────┘
```

**Services:**

- **Notifying** - Uses queueing for async delivery, scheduling for delayed notifications
- **AuthService** - Uses caching for sessions, dataservice for user storage
- **AIService** - Uses workflow for complex AI pipelines, caching for responses, queueing for async processing

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
   * Define service dependencies
   */
  defineDependencies() {
    // Level 0 services (no dependencies)
    this.serviceDependencies.set('logging', []);
    this.serviceDependencies.set('filing', []);
    

    // Level 1 services
    this.serviceDependencies.set('caching', ['logging']);
    this.serviceDependencies.set('dataservice', ['logging', 'filing']);
    this.serviceDependencies.set('working', ['logging']);
    this.serviceDependencies.set('measuring', ['logging']]);

    // Level 2 services
    this.serviceDependencies.set('queueing', ['logging', 'caching', 'dataservice']);
    this.serviceDependencies.set('scheduling', ['logging', 'measuring', 'queueing']);
    this.serviceDependencies.set('searching', ['logging', 'caching', 'dataservice']);

    // Level 3 services
    this.serviceDependencies.set('workflow', ['logging', 'queueing', 'scheduling', 'measuring']);
    this.serviceDependencies.set('notifying', ['logging', 'queueing', 'scheduling']);
    this.serviceDependencies.set('authservice', ['logging', 'caching', 'dataservice']);

    // Level 4 services
    this.serviceDependencies.set('aiservice', ['logging', 'caching', 'workflow', 'queueing']);
  }

  /**
   * Initialize services in dependency order
   */
  async initializeServices(config) {
    this.defineDependencies();
    const initOrder = this.getInitializationOrder();

    for (const serviceName of initOrder) {
      if (config.services[serviceName]?.enabled) {
        await this.initializeService(serviceName, config.services[serviceName]);
      }
    }
  }

  /**
   * Get service with dependencies injected
   */
  getService(serviceName, providerType = 'memory', options = {}) {
    if (!this.services.has(serviceName)) {
      const dependencies = this.getDependentServices(serviceName);
      const serviceFactory = require(`./src/${serviceName}`);

      const service = serviceFactory(providerType, {
        ...options,
        dependencies
      }, this.eventEmitter);

      this.services.set(serviceName, service);
    }

    return this.services.get(serviceName);
  }

  /**
   * Get dependent services for injection
   */
  getDependentServices(serviceName) {
    const dependencies = {};
    const requiredServices = this.serviceDependencies.get(serviceName) || [];

    for (const depService of requiredServices) {
      if (this.services.has(depService)) {
        dependencies[depService] = this.services.get(depService);
      }
    }

    return dependencies;
  }

  /**
   * Calculate initialization order using topological sort
   */
  getInitializationOrder() {
    const visited = new Set();
    const temp = new Set();
    const order = [];

    const visit = (serviceName) => {
      if (temp.has(serviceName)) {
        throw new Error(`Circular dependency detected involving ${serviceName}`);
      }
      if (!visited.has(serviceName)) {
        temp.add(serviceName);
        const deps = this.serviceDependencies.get(serviceName) || [];
        for (const dep of deps) {
          visit(dep);
        }
        temp.delete(serviceName);
        visited.add(serviceName);
        order.push(serviceName);
      }
    };

    for (const serviceName of this.serviceDependencies.keys()) {
      visit(serviceName);
    }

    return order;
  }
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

## 📋 **Implementation Roadmap**

### **Phase 1: Foundation (Week 1-2)**
1. Implement dependency injection in ServiceRegistry
2. Add topological sorting for initialization order
3. Create enhanced base service pattern

### **Phase 2: Level 1 Enhancement (Week 3-4)**
1. Enhance Caching service with logging
2. Enhance DataServe with logging and filing
3. Enhance Working service with logging

### **Phase 3: Level 2 Enhancement (Week 5-8)**
1. Create EnhancedQueueService with persistence and caching
2. Enhance Scheduling with queueing and metrics
3. Enhance Searching with caching and persistence

### **Phase 4: Level 3 Enhancement (Week 9-12)**
1. Create EnhancedWorkflowService with queueing and scheduling
2. Enhance Notifying with queueing
3. Enhance AuthService with caching and persistence

### **Phase 5: Integration (Week 13-16)**
1. Full integration testing
2. Performance optimization
3. Documentation and examples

---

## 🎯 **Best Practices**

1. **Graceful Degradation**: Services should work even if dependencies are unavailable
2. **Configuration-Driven**: Dependencies should be configurable
3. **Circular Dependency Prevention**: Use dependency injection and careful design
4. **Performance Monitoring**: Track the impact of service dependencies
5. **Fallback Mechanisms**: Provide fallback behavior when dependencies fail

This architecture transforms NooblyJS from a collection of isolated services into a cohesive, enterprise-ready platform where services work together to provide enhanced capabilities while maintaining clean separation of concerns.