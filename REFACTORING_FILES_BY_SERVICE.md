# NooblyJS Core - Files by Service & Refactoring Status

## Quick Status Legend
- **PC** = Promise Chains (HIGH priority)
- **CL** = console.log statements (HIGH priority)  
- **VAR** = var declarations (MEDIUM priority)
- **FD** = function declarations (LOW priority)
- **CLEAN** = Modern code (reference)

---

## Service Breakdown

### 1. AISERVICE (8 files)
```
src/aiservice/index.js                          CLEAN
src/aiservice/provider/aibase.js                PC, CL
src/aiservice/provider/aiclaude.js              VAR, CL
src/aiservice/provider/aiopenai.js              VAR, CL
src/aiservice/provider/aiollama.js              VAR, CL
src/aiservice/provider/aiapi.js                 VAR, CL
src/aiservice/modules/analytics.js              CL
src/aiservice/routes/index.js                   PC, CL
src/aiservice/views/script.js                   CL
src/aiservice/views/index.js                    CL
```

### 2. APPSERVICE (6 files)
```
src/appservice/index.js                         VAR
src/appservice/baseClasses/appBase.js           CLEAN
src/appservice/baseClasses/appDataBase.js       CLEAN
src/appservice/baseClasses/appRouteBase.js      CLEAN
src/appservice/baseClasses/appServiceBase.js    CLEAN
src/appservice/baseClasses/appViewBase.js       CLEAN
src/appservice/baseClasses/appWorkerBase.js     CLEAN
```

### 3. AUTHSERVICE (12 files)
```
src/authservice/index.js                        CLEAN
src/authservice/routes/index.js                 PC
src/authservice/providers/authBase.js           VAR, PC, CL
src/authservice/providers/authFile.js           VAR, PC, CL
src/authservice/providers/authMemory.js         VAR, PC, CL
src/authservice/providers/authGoogle.js         VAR, PC, CL
src/authservice/providers/authPassport.js       VAR, PC, CL
src/authservice/providers/authApi.js            VAR, PC, CL
src/authservice/middleware/apiKey.js            CLEAN
src/authservice/middleware/authenticate.js      CLEAN
src/authservice/middleware/index.js             CLEAN
src/authservice/middleware/passport.js          CL
src/authservice/middleware/services.js          CL
src/authservice/modules/analytics.js            CLEAN
src/authservice/views/index.js                  CLEAN
```

### 4. CACHING (8 files)
```
src/caching/index.js                            CLEAN
src/caching/routes/index.js                     PC, CL
src/caching/providers/caching.js                CLEAN
src/caching/providers/cachingRedis.js           VAR, PC, CL
src/caching/providers/cachingMemcached.js       VAR, PC, CL
src/caching/providers/cachingFile.js            VAR, PC, CL
src/caching/providers/cachingApi.js             VAR, PC, CL
src/caching/modules/analytics.js                CL
src/caching/scriptlibrary/index.js              CL
src/caching/services/index.js                   CLEAN
src/caching/views/index.js                      CLEAN
```

### 5. DATASERVICE (8 files)
```
src/dataservice/index.js                        CLEAN
src/dataservice/routes/index.js                 PC
src/dataservice/providers/dataservice.js        CLEAN
src/dataservice/providers/dataservicefiles.js   CLEAN
src/dataservice/providers/dataserviceMongoDB.js CLEAN
src/dataservice/providers/dataserviceDocumentDB.js CLEAN
src/dataservice/providers/dataserviceSimpleDB.js CLEAN
src/dataservice/providers/dataserviceApi.js     CLEAN
src/dataservice/modules/analytics.js            CLEAN
src/dataservice/views/index.js                  CLEAN
```

### 6. FETCHING (6 files)
```
src/fetching/index.js                           CLEAN
src/fetching/routes/index.js                    PC
src/fetching/providers/fetchingnode.js          CLEAN
src/fetching/providers/fetchingaxios.js         CLEAN
src/fetching/modules/analytics.js               CL
src/fetching/views/index.js                     CLEAN
```

### 7. FILING (12 files - Complex)
```
src/filing/index.js                             CLEAN
src/filing/routes/index.js                      PC, CL
src/filing/providers/filingLocal.js             CL
src/filing/providers/filingS3.js                PC, CL
src/filing/providers/filingGCP.js               PC, CL
src/filing/providers/filingGit.js               PC, CL
src/filing/providers/filingFtp.js               CL
src/filing/providers/filingApi.js               CL
src/filing/modules/analytics.js                 CL
src/filing/modules/filingSyncProvider.js        CL
src/filing/sync/CommitQueue.js                  CL
src/filing/sync/LocalWorkingStore.js            CL
src/filing/sync/MetadataStore.js                CL
src/filing/views/index.js                       CLEAN
```

### 8. LOGGING (7 files)
```
src/logging/index.js                            CLEAN
src/logging/routes/index.js                     PC, CL
src/logging/providers/logging.js                CL
src/logging/providers/loggingFile.js            VAR, CL
src/logging/providers/loggingApi.js             VAR, CL
src/logging/modules/analytics.js                CLEAN
src/logging/scriptlibrary/client.js             VAR, CL
src/logging/views/script.js                     CL
src/logging/views/index.js                      CLEAN
```

### 9. MEASURING (5 files)
```
src/measuring/index.js                          CLEAN
src/measuring/routes/index.js                   PC
src/measuring/provider/measuring.js             CL
src/measuring/providers/measuringApi.js         CLEAN
src/measuring/modules/analytics.js              CLEAN
src/measuring/views/index.js                    CLEAN
```

### 10. NOTIFYING (5 files)
```
src/notifying/index.js                          CLEAN
src/notifying/routes/index.js                   PC, CL
src/notifying/provider/notifying.js             CL
src/notifying/providers/notifyingApi.js         CLEAN
src/notifying/modules/analytics.js              CL
src/notifying/views/index.js                    CLEAN
```

### 11. QUEUEING (8 files - Heavy)
```
src/queueing/index.js                           CLEAN
src/queueing/routes/index.js                    PC, CL
src/queueing/providers/queueing.js              CLEAN
src/queueing/providers/queueingRedis.js         PC, CL
src/queueing/providers/queueingRabbitMQ.js      PC, CL
src/queueing/providers/queueingApi.js           VAR, PC, CL
src/queueing/modules/analytics.js               CL
src/queueing/scriptlibrary/client.js            VAR, CL
src/queueing/views/index.js                     CLEAN
```

### 12. REQUESTING (3 files)
```
src/requesting/index.js                         CLEAN
src/requesting/routes/index.js                  PC
src/requesting/modules/analytics.js             CL
```

### 13. SCHEDULING (5 files)
```
src/scheduling/index.js                         CLEAN
src/scheduling/routes/index.js                  PC, CL
src/scheduling/providers/scheduling.js          PC, CL
src/scheduling/modules/analytics.js             CL
src/scheduling/views/index.js                   CLEAN
```

### 14. SEARCHING (6 files)
```
src/searching/index.js                          CLEAN
src/searching/routes/index.js                   PC
src/searching/providers/searching.js            CLEAN
src/searching/providers/searchingFile.js        CL
src/searching/providers/searchingApi.js         CLEAN
src/searching/modules/analytics.js              CL
src/searching/views/index.js                    CLEAN
```

### 15. WORKFLOW (6 files - Complex)
```
src/workflow/index.js                           CLEAN
src/workflow/routes/index.js                    PC, CL
src/workflow/provider/workerRunner.js           CL
src/workflow/providers/workflowApi.js           CLEAN
src/workflow/modules/analytics.js               CLEAN
src/workflow/views/index.js                     CLEAN
```

### 16. WORKING (6 files)
```
src/working/index.js                            CLEAN
src/working/routes/index.js                     PC, CL
src/working/providers/working.js                PC
src/working/providers/workerScript.js           CL
src/working/providers/workingApi.js             CLEAN
src/working/modules/analytics.js                CLEAN
src/working/views/index.js                      CLEAN
```

### 17. VIEWS (2 files)
```
src/views/js/navigation.js                      CL
src/views/modules/monitoring.js                 CL
```

---

## Summary by Issue Type

### Promise Chains (23 files) - HIGH PRIORITY
All 15 route files + 8 provider files

**Routes**:
1. caching/routes/index.js
2. logging/routes/index.js
3. queueing/routes/index.js
4. scheduling/routes/index.js
5. notifying/routes/index.js
6. workflow/routes/index.js
7. filing/routes/index.js
8. dataservice/routes/index.js
9. authservice/routes/index.js
10. measuring/routes/index.js
11. requesting/routes/index.js
12. fetching/routes/index.js
13. working/routes/index.js
14. searching/routes/index.js
15. aiservice/routes/index.js

**Providers**:
1. aiservice/provider/aibase.js
2. authservice/providers/authBase.js
3. authservice/providers/authFile.js
4. authservice/providers/authMemory.js
5. authservice/providers/authGoogle.js
6. authservice/providers/authPassport.js
7. authservice/providers/authApi.js
8. caching/providers/cachingRedis.js
9. caching/providers/cachingMemcached.js
10. caching/providers/cachingFile.js
11. caching/providers/cachingApi.js
12. queueing/providers/queueingRedis.js
13. queueing/providers/queueingRabbitMQ.js
14. queueing/providers/queueingApi.js
15. filing/providers/filingS3.js
16. filing/providers/filingGCP.js
17. filing/providers/filingGit.js
18. scheduling/providers/scheduling.js
19. working/providers/working.js

---

### console.log Statements (68 files) - HIGH PRIORITY
Spread across all services (most have 1-2, some have many)

**Heavy usage** (5+ statements):
- queueing/providers/queueingRabbitMQ.js
- queueing/providers/queueingRedis.js
- caching/providers/cachingRedis.js
- logging/views/script.js
- aiservice/views/script.js
- views/modules/monitoring.js

**Moderate usage** (2-4 statements):
- All routes files
- All auth providers
- Filing providers (git, s3, gcp)
- Scheduling/measuring/notifying providers

**Light usage** (1 statement):
- Most analytics modules
- Script libraries
- Middleware files

---

### var Declarations (15 files) - MEDIUM PRIORITY
All should be converted to let/const

1. aiservice/provider/aiclaude.js
2. aiservice/provider/aiopenai.js
3. aiservice/provider/aiollama.js
4. aiservice/provider/aiapi.js
5. appservice/index.js (2 vars)
6. authservice/providers/authBase.js
7. authservice/providers/authFile.js
8. authservice/providers/authMemory.js
9. authservice/providers/authGoogle.js
10. authservice/providers/authPassport.js
11. authservice/providers/authApi.js
12. caching/providers/cachingRedis.js
13. caching/providers/cachingMemcached.js
14. caching/providers/cachingFile.js
15. caching/providers/cachingApi.js
16. logging/providers/loggingFile.js
17. logging/providers/loggingApi.js
18. logging/scriptlibrary/client.js
19. queueing/providers/queueingApi.js
20. queueing/scriptlibrary/client.js

---

## Refactoring Statistics

| Service | Total Files | Promise Chains | console.log | var | Status |
|---------|------------|----------------|------------|-----|--------|
| aiservice | 8 | 1 | 6 | 4 | HIGH |
| appservice | 7 | 0 | 0 | 2 | LOW |
| authservice | 15 | 7 | 8 | 6 | HIGH |
| caching | 11 | 5 | 9 | 4 | HIGH |
| dataservice | 10 | 1 | 1 | 0 | LOW |
| fetching | 6 | 1 | 1 | 0 | LOW |
| filing | 14 | 3 | 10 | 0 | HIGH |
| logging | 9 | 1 | 7 | 2 | MEDIUM |
| measuring | 6 | 1 | 2 | 0 | LOW |
| notifying | 6 | 1 | 3 | 0 | MEDIUM |
| queueing | 9 | 4 | 7 | 2 | HIGH |
| requesting | 3 | 1 | 1 | 0 | LOW |
| scheduling | 5 | 2 | 2 | 0 | MEDIUM |
| searching | 6 | 1 | 2 | 0 | LOW |
| workflow | 6 | 1 | 1 | 0 | MEDIUM |
| working | 6 | 1 | 1 | 0 | LOW |
| views | 2 | 0 | 2 | 0 | LOW |
| **TOTAL** | **133** | **23** | **68** | **18** | - |

---

## File Count by Priority & Type

**HIGH (Refactor First)**
- Promise Chains in Routes: 15 files
- Promise Chains in Providers: 8 files
- console.log in all services: 68 files (distributed)
- **Total: ~70 high-priority refactors**

**MEDIUM (Second Pass)**
- var declarations: 18 instances across 15 files

**LOW (Polish Pass)**
- function declarations: Present but low impact
- Already modern: 46+ reference files

---

## Recommended Starting Points

**Best places to start** (highest ROI):
1. All 15 route files (consistent patterns, high impact)
2. Authentication providers (6 files, complete service)
3. Queueing service (complex but contained)

**Services to tackle together**:
1. Caching + Queueing (both have Redis providers)
2. Filing service (complex but isolated)
3. Auth service (complete self-contained service)

**Easy wins**:
- All var → let/const conversions
- console.log removal in service modules
- Script libraries (isolated from core)

