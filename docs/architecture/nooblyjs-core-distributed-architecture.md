# NooblyJS Core Distributed Architecture with ZooKeeper

**Running NooblyJS Core as a Distributed Cluster**

## Overview

This document outlines a comprehensive clustering architecture for running NooblyJS Core across multiple nodes using Apache ZooKeeper for coordination, service discovery, and distributed consensus. This enables horizontal scaling, high availability, and fault tolerance while maintaining the elegance of the single-node architecture.

---

## 🏢 Why ZooKeeper for NooblyJS Core?

### The Problem with Single-Node Architecture

```javascript
// ❌ Single Node - Single Point of Failure
┌─────────────────────────┐
│   NooblyJS Core Node    │
│                         │
│  ┌─────────────────┐   │
│  │ ServiceRegistry │   │
│  │                 │   │
│  │ • caching       │   │
│  │ • workflow      │   │
│  │ • scheduling    │   │
│  │ • dataservice   │   │
│  └─────────────────┘   │
│                         │
│  If this node fails ➜ Complete outage
└─────────────────────────┘
```

### The Solution: Distributed Cluster with ZooKeeper

ZooKeeper provides the coordination layer needed to run NooblyJS Core across multiple nodes:

1. **Service Discovery** - Nodes automatically find each other
2. **Leader Election** - Coordinate critical services (scheduling, workflow)
3. **Distributed Locking** - Prevent race conditions
4. **Health Monitoring** - Detect and recover from failures
5. **Configuration Management** - Update configs across cluster without restart
6. **Metadata Storage** - Centralized state management

---

## 🏗️ Cluster Architecture

### High-Level Topology

```
┌──────────────────────────────────────────────────────────────┐
│             Load Balancer / API Gateway                       │
│        (Nginx, HAProxy, or Cloud LB)                          │
└────────┬──────────────┬──────────────┬───────────────────────┘
         │              │              │
    ┌────▼────┐    ┌────▼────┐   ┌────▼────┐
    │ Node 1  │    │ Node 2  │   │ Node 3  │
    │:3001    │    │:3002    │   │:3003    │
    └────┬────┘    └────┬────┘   └────┬────┘
         │              │              │
    ┌────▼──────────────▼──────────────▼────┐
    │   Distributed Service Registry        │
    │   (via ZooKeeper)                     │
    │                                       │
    │  ✓ Service discovery                 │
    │  ✓ Service instance tracking         │
    │  ✓ Load balancing metadata           │
    │  ✓ Health status                     │
    └────┬──────────────┬──────────────────┘
         │              │
    ┌────▼────┐    ┌────▼──────────┐
    │ZooKeeper│    │ Shared Data   │
    │Ensemble │    │ Services      │
    │(3-5     │    │               │
    │ nodes)  │    │ • Redis       │
    │         │    │ • MongoDB     │
    │ • Leader│    │ • PostgreSQL  │
    │ Election│    │ • S3/Storage  │
    │ • Locks │    │               │
    │ • Config│    └───────────────┘
    │ • Watch │
    │ • Health│
    └─────────┘
```

### ZooKeeper Ensemble Layout

```
/nooblyjs-core/
├── nodes/
│   ├── node-1:3001/
│   │   ├── metadata
│   │   │   ├── id: "node-1"
│   │   │   ├── host: "10.0.1.10"
│   │   │   ├── port: 3001
│   │   │   ├── services: ["caching", "logging", "filing", "auth"]
│   │   │   ├── capacity: 0.65
│   │   │   └── last_heartbeat: 1699123456789
│   │   └── (ephemeral - disappears if node crashes)
│   │
│   ├── node-2:3002/
│   │   └── metadata (similar)
│   │
│   └── node-3:3003/
│       └── metadata (similar)
│
├── services/
│   ├── caching/
│   │   ├── instances/
│   │   │   ├── default → redis://redis-1:6379
│   │   │   ├── cache-2 → redis://redis-2:6379
│   │   │   └── cache-3 → redis://redis-3:6379
│   │   ├── leader/
│   │   │   └── candidate-0000000001 (node-1 elected leader)
│   │   └── health: "healthy"
│   │
│   ├── workflow/
│   │   ├── queue/
│   │   │   ├── pending/task-001
│   │   │   ├── pending/task-002
│   │   │   └── ...
│   │   ├── leader/
│   │   │   └── candidate-0000000002 (node-2 elected leader)
│   │   └── health: "healthy"
│   │
│   ├── scheduling/
│   │   ├── active_jobs/
│   │   │   ├── job-001 (every hour)
│   │   │   ├── job-002 (daily)
│   │   │   └── ...
│   │   ├── leader/
│   │   │   └── candidate-0000000003 (node-3 elected leader)
│   │   └── health: "healthy"
│   │
│   └── dataservice/
│       ├── leader/
│       │   └── candidate-0000000001 (node-1 elected leader)
│       └── health: "healthy"
│
├── locks/
│   ├── caching-initialization
│   ├── workflow-critical-section
│   ├── dataservice-migration
│   └── config-reload
│
└── config/
    ├── global
    │   ├── api_keys: ["key-1", "key-2", ...]
    │   ├── security_rules: {...}
    │   ├── feature_flags: {...}
    │   └── service_limits: {...}
    │
    └── services/
        ├── caching: {mode: "distributed", replication: 3}
        ├── workflow: {mode: "leader-based", timeout: 30000}
        ├── scheduling: {mode: "leader-based", timeout: 30000}
        └── dataservice: {mode: "replicated", consistency: "strong"}
```

---

## 🔄 Node Lifecycle & Registration

### Node Startup Flow

```
1. Node Start
   ↓
2. Connect to ZooKeeper (zk-1:2181, zk-2:2181, zk-3:2181)
   ↓
3. Register Ephemeral Node
   Create: /nooblyjs-core/nodes/node-1:3001
   (Disappears automatically if connection lost)
   ↓
4. Initialize Local Services
   • Start caching service
   • Start logging service
   • Start filing service
   • etc.
   ↓
5. Announce Services to ZooKeeper
   For each service:
     Create: /nooblyjs-core/nodes/node-1:3001/services/{serviceName}
   ↓
6. Start Leader Elections
   For critical services (workflow, scheduling, dataservice):
     Register as candidate: /nooblyjs-core/services/{serviceName}/leader/candidate-{seq}
   ↓
7. Watch for Cluster Changes
   Watch: /nooblyjs-core/nodes (topology changes)
   Watch: /nooblyjs-core/config (config updates)
   Watch: /nooblyjs-core/services/{serviceName}/leader (leadership changes)
   ↓
8. Start Health Heartbeat
   Every 5 seconds: Update /nooblyjs-core/nodes/node-1:3001/metadata
   ↓
9. Ready to Accept Requests ✓
```

### Code Example: Node Registration

```javascript
class ClusterNode {
  constructor(nodeId, port, zkServers) {
    this.nodeId = nodeId;
    this.port = port;
    this.zk = new ZooKeeperClient(zkServers);
    this.services = new Map();
  }

  async initialize() {
    // 1. Connect to ZooKeeper
    await this.zk.connect();
    console.log('✓ Connected to ZooKeeper');

    // 2. Register node (ephemeral)
    await this.registerNode();
    console.log(`✓ Node registered: ${this.nodeId}`);

    // 3. Initialize local services
    await this.initializeServices();
    console.log('✓ Services initialized');

    // 4. Announce services
    await this.announceServices();
    console.log('✓ Services announced to cluster');

    // 5. Start leader elections
    await this.startLeaderElections();
    console.log('✓ Leader elections started');

    // 6. Watch cluster changes
    this.watchClusterChanges();
    console.log('✓ Watching cluster changes');

    // 7. Start health monitoring
    this.startHealthMonitoring();
    console.log('✓ Health monitoring started');
  }

  async registerNode() {
    const nodePath = `/nooblyjs-core/nodes/${this.nodeId}`;

    const metadata = {
      id: this.nodeId,
      host: os.hostname(),
      port: this.port,
      startTime: Date.now(),
      status: 'healthy',
      services: Array.from(this.services.keys()),
      capacity: this.getNodeCapacity(),
      last_heartbeat: Date.now()
    };

    // Create ephemeral node (auto-deleted if connection lost)
    await this.zk.create(nodePath, JSON.stringify(metadata), {
      ephemeral: true
    });
  }

  startHealthMonitoring() {
    setInterval(async () => {
      try {
        const nodePath = `/nooblyjs-core/nodes/${this.nodeId}`;
        const metadata = {
          ...this.getCurrentMetadata(),
          last_heartbeat: Date.now(),
          capacity: this.getNodeCapacity()
        };

        await this.zk.setData(nodePath, JSON.stringify(metadata));
      } catch (error) {
        console.error('Heartbeat failed:', error);
        // ZooKeeper will detect disconnection and clean up
      }
    }, 5000); // Every 5 seconds
  }

  watchClusterChanges() {
    this.zk.watch('/nooblyjs-core/nodes', async (event) => {
      console.log('Cluster topology changed');

      // Rebalance services if needed
      await this.rebalanceServices();

      // Update internal registry
      await this.updateServiceRegistry();
    });
  }
}
```

---

## 🎯 Service Discovery & Routing

### How Nodes Discover Each Other

```javascript
class DistributedServiceRegistry extends ServiceRegistry {
  constructor(zkConnection, nodeId) {
    super();
    this.zk = zkConnection;
    this.nodeId = nodeId;
  }

  /**
   * Get service with cluster awareness
   * Routes to appropriate node based on service configuration
   */
  async getService(serviceName, providerType = null, options = {}) {
    // 1. Check service configuration
    const config = await this.getServiceConfig(serviceName);

    // 2. Determine routing strategy
    switch (config.mode) {
      case 'local':
        // Stateless service - create locally
        return super.getService(serviceName, providerType, options);

      case 'leader-based':
        // Critical service - route to elected leader
        const leader = await this.getServiceLeader(serviceName);
        return this.getRemoteServiceProxy(serviceName, leader);

      case 'distributed':
        // Load-balanced across nodes
        const availableNodes = await this.findNodesWithService(serviceName);
        const bestNode = this.selectBestNode(availableNodes);
        return this.getRemoteServiceProxy(serviceName, bestNode);

      case 'local-first':
        // Try local first, fall back to remote
        if (this.hasLocalService(serviceName)) {
          return super.getService(serviceName, providerType, options);
        }
        const remoteNode = await this.findAnyNodeWithService(serviceName);
        return this.getRemoteServiceProxy(serviceName, remoteNode);
    }
  }

  /**
   * Find all nodes offering a service
   */
  async findNodesWithService(serviceName) {
    const nodesPath = '/nooblyjs-core/nodes';
    const nodeIds = await this.zk.getChildren(nodesPath);

    const availableNodes = [];
    for (const nodeId of nodeIds) {
      try {
        const nodeData = await this.zk.getData(`${nodesPath}/${nodeId}`);
        const metadata = JSON.parse(nodeData.toString());

        if (metadata.services.includes(serviceName) &&
            metadata.status === 'healthy') {
          availableNodes.push(metadata);
        }
      } catch (error) {
        // Node data unavailable, skip
      }
    }

    return availableNodes;
  }

  /**
   * Get elected leader for a service
   */
  async getServiceLeader(serviceName) {
    const leaderPath = `/nooblyjs-core/services/${serviceName}/leader`;
    const candidates = await this.zk.getChildren(leaderPath);

    if (candidates.length === 0) {
      throw new Error(`No leader elected for ${serviceName}`);
    }

    // First candidate (lowest sequence number) is leader
    const leaderCandidate = candidates.sort()[0];
    const leaderData = await this.zk.getData(`${leaderPath}/${leaderCandidate}`);
    return JSON.parse(leaderData.toString());
  }

  /**
   * Select best node (lowest capacity/load)
   */
  selectBestNode(nodes) {
    if (nodes.length === 0) return null;

    return nodes.reduce((best, node) => {
      if (!best) return node;
      return node.capacity < best.capacity ? node : best;
    });
  }

  /**
   * Create proxy for remote service
   */
  getRemoteServiceProxy(serviceName, nodeMetadata) {
    return {
      _isRemote: true,
      nodeId: nodeMetadata.id,
      host: nodeMetadata.host,
      port: nodeMetadata.port,

      // Intercept method calls and route to remote node
      async call(method, ...args) {
        const url = `http://${this.host}:${this.port}/services/${serviceName}/api/${method}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ args })
        });
        return response.json();
      }
    };
  }
}
```

---

## 🗳️ Leader Election for Critical Services

### Why Leader Election?

Some services should run only on one node to prevent conflicts:

```
┌─────────────────────────────────────────────────┐
│ Services That Need Leader Election              │
├─────────────────────────────────────────────────┤
│                                                 │
│ ✓ Scheduling                                   │
│   → Only one scheduler should run jobs         │
│   → Prevents duplicate scheduled executions    │
│                                                 │
│ ✓ Workflow                                      │
│   → Only one workflow engine processes queue   │
│   → Prevents duplicate task processing         │
│                                                 │
│ ✓ DataService (with special config)           │
│   → Primary for writes (replication handle by DB)
│   → Ensures consistency                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Leader Election Algorithm

```javascript
class LeaderElection {
  constructor(zk, serviceName) {
    this.zk = zk;
    this.serviceName = serviceName;
    this.leaderPath = `/nooblyjs-core/services/${serviceName}/leader`;
    this.isLeader = false;
    this.candidatePath = null;
  }

  /**
   * Start participating in leader election
   */
  async startElection() {
    console.log(`Starting leader election for ${this.serviceName}`);

    // Register as candidate with sequential node
    const candidatePath = await this.zk.create(
      `${this.leaderPath}/candidate-`,
      JSON.stringify({
        nodeId: process.env.NODE_ID,
        timestamp: Date.now(),
        priority: this.calculatePriority()
      }),
      { ephemeral: true, sequential: true }
    );

    this.candidatePath = candidatePath;

    // Monitor for leadership
    await this.monitorLeadership();
  }

  /**
   * Monitor leadership status
   */
  async monitorLeadership() {
    while (true) {
      try {
        // Get all candidates
        const candidates = await this.zk.getChildren(this.leaderPath);
        const sortedCandidates = candidates.sort(); // Sequence order

        // Check if we're the leader
        const myCandidate = this.candidatePath.split('/').pop();
        const isLeader = sortedCandidates[0] === myCandidate;

        if (isLeader && !this.isLeader) {
          // We became leader
          this.isLeader = true;
          console.log(
            `✓ LEADER ELECTED: ${process.env.NODE_ID} is now leader of ${this.serviceName}`
          );
          await this.executeLeaderDuties();
        } else if (!isLeader && this.isLeader) {
          // We lost leadership
          this.isLeader = false;
          console.log(
            `✗ Leadership lost: ${process.env.NODE_ID} is no longer leader of ${this.serviceName}`
          );
          await this.stopLeaderDuties();
        }

        // Watch for next candidate's deletion (signals leadership change)
        const nextCandidateIndex = sortedCandidates.indexOf(myCandidate);
        if (nextCandidateIndex > 0) {
          // Watch the candidate before us
          const nodeBefore = sortedCandidates[nextCandidateIndex - 1];
          await new Promise((resolve) => {
            this.zk.exists(`${this.leaderPath}/${nodeBefore}`, () => {
              resolve();
            });
          });
        } else {
          // We're first, watch if we disappear
          await new Promise((resolve) => {
            this.zk.exists(this.candidatePath, () => {
              resolve();
            });
          });
        }
      } catch (error) {
        console.error('Leader election error:', error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Execute leader-specific duties
   */
  async executeLeaderDuties() {
    switch (this.serviceName) {
      case 'scheduling':
        // Start processing scheduled jobs
        await this.startScheduledJobProcessor();
        break;

      case 'workflow':
        // Start processing workflow queue
        await this.startWorkflowQueueProcessor();
        break;

      case 'dataservice':
        // Manage replication and consistency
        await this.manageDataReplication();
        break;
    }
  }

  /**
   * Stop leader-specific duties
   */
  async stopLeaderDuties() {
    // Gracefully stop background tasks
    await this.stopBackgroundTasks();
  }
}
```

---

## 🔒 Distributed Locking

### Use Cases for Distributed Locks

```javascript
// 1. Database Migrations
async function migrateDatabase() {
  const lock = new DistributedLock(zk, '/nooblyjs-core/locks/db-migration');
  try {
    await lock.acquire();
    // Only one node can migrate at a time
    console.log('Starting database migration...');
    await dataservice.migrate();
  } finally {
    await lock.release();
  }
}

// 2. Critical Configuration Updates
async function updateSecurityConfig() {
  const lock = new DistributedLock(zk, '/nooblyjs-core/locks/security-config');
  try {
    await lock.acquire();
    // Update security rules atomically
    await updateAllSecurityRules();
  } finally {
    await lock.release();
  }
}

// 3. Resource Initialization
async function initializeSharedResource() {
  const lock = new DistributedLock(zk, '/nooblyjs-core/locks/resource-init');
  try {
    await lock.acquire();
    // Check if already initialized by another node
    const initialized = await checkIfInitialized();
    if (!initialized) {
      console.log('Initializing shared resource...');
      await initializeResource();
    }
  } finally {
    await lock.release();
  }
}
```

### Distributed Lock Implementation

```javascript
class DistributedLock {
  constructor(zk, lockPath) {
    this.zk = zk;
    this.lockPath = lockPath;
    this.lockNode = null;
  }

  /**
   * Acquire the lock (blocking)
   */
  async acquire() {
    // Create sequential ephemeral node
    const path = await this.zk.create(
      `${this.lockPath}/lock-`,
      Buffer.from(os.hostname()),
      { ephemeral: true, sequential: true }
    );

    this.lockNode = path;
    console.log(`Lock created: ${path}`);

    // Wait until we're first in sequence (fair locking)
    while (!await this.isLockOwner()) {
      await this.waitForPredecessor();
    }

    console.log(`✓ Lock acquired: ${this.lockNode}`);
  }

  /**
   * Check if we own the lock
   */
  async isLockOwner() {
    const children = await this.zk.getChildren(this.lockPath);
    const sortedChildren = children.sort();
    const myName = this.lockNode.split('/').pop();
    return myName === sortedChildren[0];
  }

  /**
   * Wait for predecessor to be deleted
   */
  async waitForPredecessor() {
    const children = await this.zk.getChildren(this.lockPath);
    const sortedChildren = children.sort();
    const myName = this.lockNode.split('/').pop();
    const myIndex = sortedChildren.indexOf(myName);

    if (myIndex === 0) {
      return; // We're first
    }

    // Watch predecessor
    const predecessorName = sortedChildren[myIndex - 1];
    return new Promise((resolve) => {
      this.zk.exists(`${this.lockPath}/${predecessorName}`, () => {
        resolve();
      });
    });
  }

  /**
   * Release the lock
   */
  async release() {
    if (this.lockNode) {
      await this.zk.delete(this.lockNode);
      console.log(`✓ Lock released: ${this.lockNode}`);
    }
  }
}
```

---

## 💔 Failure Detection & Recovery

### How Node Failures Are Detected

```
Timeline of Node Failure:
┌────────────────┐
│ Node 2 Running │
│ Normal Ops     │
└────────┬────────┘
         │
         ├─ Heartbeat sent ✓
         │
         ├─ Heartbeat sent ✓
         │
         └─ CRASH (network partition, server down, etc)
            Last heartbeat: now() - 6 seconds ago

Cluster Detection:
         │
         ├─ ZooKeeper detects connection loss
         ├─ Ephemeral node /nooblyjs-core/nodes/node-2 auto-deleted
         ├─ All watches on node-2 fired
         └─ Other nodes detect topology change

Recovery:
         │
         ├─ Services running on node-2 marked unavailable
         ├─ Leader elections triggered for affected services
         ├─ New leaders elected from remaining nodes
         ├─ Pending tasks re-queued
         └─ Cluster continues operating ✓
```

### Failure Detection Code

```javascript
class FailureDetector {
  constructor(zk) {
    this.zk = zk;
    this.healthCheckInterval = 5000; // Every 5 seconds
    this.heartbeatTimeout = 30000;   // 30 seconds without heartbeat = dead
  }

  async startMonitoring() {
    setInterval(async () => {
      await this.checkClusterHealth();
    }, this.healthCheckInterval);
  }

  async checkClusterHealth() {
    const nodesPath = '/nooblyjs-core/nodes';

    try {
      const nodeIds = await this.zk.getChildren(nodesPath);

      for (const nodeId of nodeIds) {
        const nodeData = await this.zk.getData(`${nodesPath}/${nodeId}`);
        const metadata = JSON.parse(nodeData.toString());

        // Check last heartbeat
        const timeSinceHeartbeat = Date.now() - metadata.last_heartbeat;

        if (timeSinceHeartbeat > this.heartbeatTimeout) {
          console.warn(`Node ${nodeId} appears to be dead`);
          await this.handleNodeFailure(nodeId, metadata);
        }
      }
    } catch (error) {
      console.error('Health check error:', error);
    }
  }

  async handleNodeFailure(nodeId, metadata) {
    console.error(`Handling failure of node ${nodeId}`);

    // 1. Services are automatically unavailable (ZooKeeper deleted the node)
    console.log('Services on failed node marked unavailable');

    // 2. Re-elect leaders for affected services
    for (const service of metadata.services) {
      const electionPath = `/nooblyjs-core/services/${service}/leader`;
      const candidates = await this.zk.getChildren(electionPath);

      if (candidates.length === 0) {
        console.log(`No candidates for ${service}, triggering new election`);
        // New candidates will be created automatically
      } else {
        console.log(`New leader for ${service}: ${candidates[0]}`);
      }
    }

    // 3. Rebalance any queued tasks
    await this.rebalanceFailedNodeTasks(nodeId, metadata);

    // 4. Alert operations
    this.alertOps(`Node ${nodeId} failure detected and recovery initiated`);
  }

  async rebalanceFailedNodeTasks(nodeId, metadata) {
    // Move pending tasks from failed node back to queue
    const workflowQueue = `/nooblyjs-core/services/workflow/queue`;

    try {
      const tasks = await this.zk.getChildren(workflowQueue);

      for (const task of tasks) {
        const taskData = await this.zk.getData(`${workflowQueue}/${task}`);
        const taskMetadata = JSON.parse(taskData.toString());

        // If task is assigned to failed node, reassign it
        if (taskMetadata.assignedNode === nodeId) {
          taskMetadata.assignedNode = null;
          taskMetadata.status = 'pending';
          taskMetadata.attempts = (taskMetadata.attempts || 0) + 1;

          await this.zk.setData(
            `${workflowQueue}/${task}`,
            JSON.stringify(taskMetadata)
          );

          console.log(`Requeued task ${task} from failed node`);
        }
      }
    } catch (error) {
      console.error('Error rebalancing tasks:', error);
    }
  }
}
```

---

## 🔄 Stateless vs Stateful Services

### Critical for Clustering Success

```javascript
// ❌ BAD: Stateful (can't scale)
class BadCachingService {
  constructor() {
    this.store = new Map(); // Local state!
  }

  async put(key, value) {
    this.store.set(key, value); // Only on this node
  }

  async get(key) {
    return this.store.get(key); // Lost if node crashes
  }
}

// ✅ GOOD: Stateless (cluster-ready)
class GoodCachingService {
  constructor(options) {
    this.redis = new RedisClient(options.redis); // Shared state
    this.logging = options.dependencies.logging;
  }

  async put(key, value) {
    await this.redis.set(key, value); // Shared across all nodes
    this.logging.info('Cached', { key });
  }

  async get(key) {
    return await this.redis.get(key); // Can read from any node
  }
}

// Service Classification
const clusterizeServiceMap = {
  stateless: [
    // Can run on every node independently
    'logging',      // Each node logs to same sink
    'authservice',  // Uses shared Redis for sessions
    'fetching',     // HTTP client, no local state
    'filing'        // Uses shared S3/storage
  ],

  leaderBased: [
    // One leader coordinates, others standby
    'scheduling',   // One scheduler runs jobs
    'workflow',     // One engine processes queue
  ],

  distributed: [
    // Load balanced across multiple nodes
    'caching',      // Redis cluster with replication
    'dataservice',  // Replicated database
  ],

  replicated: [
    // Multiple instances with replication
    'notifying',    // Pub/sub replicated across cluster
    'measuring',    // Metrics aggregated from all nodes
  ]
};
```

---

## 📊 Configuration Management

### Dynamic Configuration Updates (No Restart)

```javascript
class ConfigurationManager {
  constructor(zk) {
    this.zk = zk;
    this.config = {};
    this.listeners = new Map();
  }

  async initialize() {
    // Load initial config from ZooKeeper
    await this.loadConfig();

    // Watch for changes
    this.watchConfigChanges();
  }

  async loadConfig() {
    try {
      const configPath = '/nooblyjs-core/config/global';
      const configData = await this.zk.getData(configPath);
      this.config = JSON.parse(configData.toString());

      console.log('✓ Configuration loaded');
    } catch (error) {
      console.warn('No configuration in ZooKeeper, using defaults');
      this.config = this.getDefaultConfig();
    }
  }

  watchConfigChanges() {
    this.zk.watch('/nooblyjs-core/config', async (event) => {
      console.log('Configuration changed, reloading...');

      const oldConfig = { ...this.config };
      await this.loadConfig();

      // Notify all listeners
      for (const [key, listeners] of this.listeners) {
        const oldValue = oldConfig[key];
        const newValue = this.config[key];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          for (const listener of listeners) {
            await listener(newValue, oldValue);
          }
        }
      }

      console.log('✓ Configuration updated');
    });
  }

  /**
   * Subscribe to configuration changes
   */
  onConfigChange(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
  }

  /**
   * Update configuration (affects all nodes)
   */
  async updateConfig(key, value) {
    const configPath = `/nooblyjs-core/config/global`;

    const config = await this.loadRemoteConfig();
    config[key] = value;

    await this.zk.setData(configPath, JSON.stringify(config));
    console.log(`✓ Configuration updated: ${key}`);
  }
}

// Usage Example
const configManager = new ConfigurationManager(zk);

// Listen for API key changes
configManager.onConfigChange('api_keys', (newKeys, oldKeys) => {
  console.log('API keys updated, reloading...');
  authService.updateApiKeys(newKeys);
});

// Listen for feature flag changes
configManager.onConfigChange('feature_flags', (newFlags, oldFlags) => {
  console.log('Feature flags updated');
  featureManager.updateFlags(newFlags);
});
```

---

## 🚀 Complete Startup Example

```javascript
// cluster-startup.js
const ZooKeeperClient = require('zookeeper-client');
const ClusterNode = require('./cluster/ClusterNode');
const DistributedServiceRegistry = require('./cluster/DistributedServiceRegistry');
const LeaderElection = require('./cluster/LeaderElection');
const FailureDetector = require('./cluster/FailureDetector');

async function startClusterNode() {
  const nodeId = process.env.NODE_ID || `node-${Date.now()}`;
  const zkServers = process.env.ZOOKEEPER_SERVERS || 'localhost:2181';
  const port = process.env.PORT || 3001;

  console.log(`
╔════════════════════════════════════════════╗
║  NooblyJS Core - Cluster Node Startup      ║
╠════════════════════════════════════════════╣
║  Node ID: ${nodeId.padEnd(36)}║
║  Port: ${String(port).padEnd(40)}║
║  ZK Servers: ${zkServers.padEnd(33)}║
╚════════════════════════════════════════════╝
  `);

  try {
    // 1. Connect to ZooKeeper
    console.log('Connecting to ZooKeeper...');
    const zk = new ZooKeeperClient({
      connect: zkServers,
      sessionTimeout: 30000,
      spinInterval: 1000,
      retries: 3
    });

    await new Promise((resolve) => {
      zk.on('state', (state) => {
        if (state === 'CONNECTED') {
          console.log('✓ Connected to ZooKeeper');
          resolve();
        }
      });
    });

    // 2. Initialize cluster node
    console.log('Initializing cluster node...');
    const clusterNode = new ClusterNode(nodeId, port, zk);
    await clusterNode.initialize();

    // 3. Create distributed service registry
    console.log('Creating distributed service registry...');
    const registry = new DistributedServiceRegistry(zk, nodeId);

    // 4. Initialize services
    const app = express();
    const eventEmitter = new EventEmitter();

    await registry.initialize(app, eventEmitter, {
      nodeId,
      mode: 'cluster',
      zookeeperConnection: zk
    });

    // 5. Start leader elections for critical services
    console.log('Starting leader elections...');
    const criticalServices = ['scheduling', 'workflow', 'dataservice'];

    for (const service of criticalServices) {
      const election = new LeaderElection(zk, service);
      election.startElection().catch(console.error);
    }

    // 6. Start failure detection
    console.log('Starting failure detection...');
    const failureDetector = new FailureDetector(zk);
    failureDetector.startMonitoring();

    // 7. Start Express server
    const server = app.listen(port, () => {
      console.log(`
╔════════════════════════════════════════════╗
║          🚀 CLUSTER NODE READY 🚀          ║
╠════════════════════════════════════════════╣
║  Node ID: ${nodeId.padEnd(36)}║
║  URL: http://localhost:${String(port).padEnd(34)}║
║  Services: ${Object.keys(registry.services).length} registered              ║
║  Leader elections: Started                 ║
║  Health monitoring: Active                 ║
╚════════════════════════════════════════════╝
      `);
    });

    // 8. Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('Shutting down gracefully...');
      server.close();
      await clusterNode.deregister();
      zk.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start cluster node:', error);
    process.exit(1);
  }
}

// Start the cluster node
startClusterNode().catch(console.error);
```

---

## 🐳 Docker Compose Example

```yaml
version: '3.8'

services:
  # ZooKeeper Ensemble (3 nodes for quorum)
  zookeeper-1:
    image: zookeeper:latest
    environment:
      ZOO_CFG_EXTRA: "server.1=zookeeper-1:2888:3888 server.2=zookeeper-2:2888:3888 server.3=zookeeper-3:2888:3888"
      ZOO_MY_ID: 1
    ports:
      - "2181:2181"
    networks:
      - cluster

  zookeeper-2:
    image: zookeeper:latest
    environment:
      ZOO_CFG_EXTRA: "server.1=zookeeper-1:2888:3888 server.2=zookeeper-2:2888:3888 server.3=zookeeper-3:2888:3888"
      ZOO_MY_ID: 2
    ports:
      - "2182:2181"
    networks:
      - cluster

  zookeeper-3:
    image: zookeeper:latest
    environment:
      ZOO_CFG_EXTRA: "server.1=zookeeper-1:2888:3888 server.2=zookeeper-2:2888:3888 server.3=zookeeper-3:2888:3888"
      ZOO_MY_ID: 3
    ports:
      - "2183:2181"
    networks:
      - cluster

  # Shared Services
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - cluster

  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    networks:
      - cluster

  # NooblyJS Core Nodes
  node-1:
    build: .
    environment:
      NODE_ID: node-1
      PORT: 3001
      ZOOKEEPER_SERVERS: zookeeper-1:2181,zookeeper-2:2181,zookeeper-3:2181
      REDIS_URL: redis://redis:6379
      MONGODB_URL: mongodb://mongodb:27017
    ports:
      - "3001:3001"
    depends_on:
      - zookeeper-1
      - zookeeper-2
      - zookeeper-3
      - redis
      - mongodb
    networks:
      - cluster

  node-2:
    build: .
    environment:
      NODE_ID: node-2
      PORT: 3002
      ZOOKEEPER_SERVERS: zookeeper-1:2181,zookeeper-2:2181,zookeeper-3:2181
      REDIS_URL: redis://redis:6379
      MONGODB_URL: mongodb://mongodb:27017
    ports:
      - "3002:3001"
    depends_on:
      - zookeeper-1
      - zookeeper-2
      - zookeeper-3
      - redis
      - mongodb
    networks:
      - cluster

  node-3:
    build: .
    environment:
      NODE_ID: node-3
      PORT: 3003
      ZOOKEEPER_SERVERS: zookeeper-1:2181,zookeeper-2:2181,zookeeper-3:2181
      REDIS_URL: redis://redis:6379
      MONGODB_URL: mongodb://mongodb:27017
    ports:
      - "3003:3001"
    depends_on:
      - zookeeper-1
      - zookeeper-2
      - zookeeper-3
      - redis
      - mongodb
    networks:
      - cluster

  # Load Balancer
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "80:80"
    depends_on:
      - node-1
      - node-2
      - node-3
    networks:
      - cluster

networks:
  cluster:
    driver: bridge
```

---

## 📈 Benefits of Clustering with ZooKeeper

| Capability | Benefit | Implementation |
|-----------|---------|-----------------|
| **Service Discovery** | Nodes find each other automatically | ZooKeeper registry + watches |
| **Load Balancing** | Distribute traffic across nodes | Load balancer + service discovery |
| **High Availability** | Continue operating if nodes fail | Ephemeral nodes + health checks |
| **Failover** | Automatic recovery from failures | Leader election + task rebalancing |
| **Leader Election** | Coordinate critical services | Sequential ephemeral nodes |
| **Distributed Locking** | Prevent race conditions | Fair locking algorithm |
| **Config Management** | Update settings without restart | ZooKeeper watches |
| **Health Monitoring** | Real-time cluster visibility | Heartbeats + health checks |
| **Scaling** | Add/remove nodes dynamically | Service registry + routing |
| **Data Consistency** | Maintain state across nodes | Shared data services + replication |

---

## 🎯 Service Routing Decisions

```
Incoming Request: GET /services/caching/api/get/key

┌─────────────────────────────────────────────────────┐
│  Load Balancer receives request                     │
│  (Determines which node to route to)                │
└────────────────┬────────────────────────────────────┘
                 │
    ┌────────────▼───────────────┐
    │ Check Service Config       │
    │                            │
    │ caching.mode = distributed │
    └────────────┬───────────────┘
                 │
    ┌────────────▼────────────────────┐
    │ Query ZooKeeper for Nodes       │
    │                                 │
    │ /nooblyjs-core/nodes/           │
    │ ├── node-1 (capacity: 0.45)     │
    │ ├── node-2 (capacity: 0.65)     │
    │ └── node-3 (capacity: 0.30) ◄── Best choice
    └────────────┬────────────────────┘
                 │
    ┌────────────▼─────────────────┐
    │ Route to node-3              │
    │ (lowest capacity/load)       │
    └────────────┬─────────────────┘
                 │
    ┌────────────▼────────────────────────┐
    │ Node-3 Processes Request            │
    │                                     │
    │ • Validates API key                 │
    │ • Calls caching.get('key')          │
    │ • Returns cached value from Redis   │
    └─────────────────────────────────────┘
```

---

## 🔍 Monitoring & Observability

### Health Check Endpoints

```javascript
// Every node exposes health status
app.get('/health/cluster', (req, res) => {
  res.json({
    nodeId: process.env.NODE_ID,
    status: 'healthy',
    uptime: process.uptime(),
    services: Array.from(registry.services.keys()),
    cluster: {
      totalNodes: clusterSize,
      healthyNodes: healthyNodeCount,
      leaders: electedLeaders,
      pendingTasks: taskQueue.length
    }
  });
});

// Metrics endpoint
app.get('/metrics/cluster', (req, res) => {
  res.json({
    nodeMetrics: {
      cpuUsage: os.loadavg()[0],
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    },
    clusterMetrics: {
      totalRequests: requestCounter.total,
      requestsPerSecond: requestCounter.perSecond,
      averageLatency: calculateAverageLatency(),
      errorRate: calculateErrorRate()
    }
  });
});
```

---

## 🛡️ Production Considerations

### Deployment Checklist

- [ ] ZooKeeper ensemble is 3-5 nodes (odd number for quorum)
- [ ] ZooKeeper is on separate infrastructure from application nodes
- [ ] All nodes can reach all ZooKeeper servers
- [ ] Network partitions are monitored and alerting configured
- [ ] Regular backups of ZooKeeper data
- [ ] Load balancer is configured with health checks
- [ ] Graceful shutdown procedures are tested
- [ ] Scaling procedures are documented and tested
- [ ] Monitoring and alerting are configured
- [ ] Disaster recovery procedures are in place
- [ ] Circuit breakers for inter-node communication
- [ ] Request timeouts configured appropriately

---

## 📚 Next Steps

1. **Implement ClusterNode** - Register nodes with ZooKeeper
2. **Implement DistributedServiceRegistry** - Route requests intelligently
3. **Implement LeaderElection** - Coordinate critical services
4. **Implement FailureDetector** - Monitor cluster health
5. **Add Monitoring** - Health checks, metrics, alerting
6. **Deploy to Kubernetes** - Use StatefulSets for nodes
7. **Test Failure Scenarios** - Kill nodes, network partitions, etc.
8. **Performance Tuning** - Optimize ZooKeeper configuration
9. **Documentation** - Operational runbooks and procedures
10. **Training** - Team training on distributed systems

---

## 📖 References

- [Apache ZooKeeper Documentation](https://zookeeper.apache.org/)
- [ZooKeeper Recipes and Solutions](https://zookeeper.apache.org/doc/current/recipes.html)
- [Building Distributed Systems](https://distributed-systems.readthedocs.io/)
- [Kubernetes StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)

---

This clustering architecture enables NooblyJS Core to scale horizontally while maintaining the elegance and simplicity of its single-node design. ZooKeeper provides battle-tested coordination that makes building distributed systems practical and reliable.
