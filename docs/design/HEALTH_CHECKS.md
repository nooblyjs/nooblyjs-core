# Health Check Endpoints Guide

This document describes the health check endpoints available for monitoring and orchestration platforms.

## Overview

Noobly JS Core provides multiple health check endpoints designed for different monitoring and orchestration scenarios:

- **Docker**: `HEALTHCHECK` in Dockerfile uses `/health`
- **Load Balancers**: Use `/health` for fast availability checks
- **Kubernetes**: Use `/health/ready` (readiness), `/health/live` (liveness), `/health/startup` (startup)
- **Monitoring Tools**: Use `/health/detailed` for comprehensive status (requires authentication)

## Quick Reference

| Endpoint | Purpose | Status Code | Use Case |
|----------|---------|-------------|----------|
| `GET /health` | Quick liveness check | 200/503 | Docker, load balancers |
| `GET /health/live` | Kubernetes liveness probe | 200/503 | Process restart decisions |
| `GET /health/ready` | Kubernetes readiness probe | 200/503 | Traffic routing decisions |
| `GET /health/startup` | Kubernetes startup probe | 200/503 | Slow startup handling |
| `GET /health/detailed` | Full status report (protected) | 200/500 | Monitoring dashboards |

## Endpoint Details

### GET /health - Quick Liveness Check

Used by Docker `HEALTHCHECK`, load balancers, and simple monitoring tools.

**Response (200 OK - Healthy):**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2026-04-16T10:30:00.000Z"
}
```

**Response (503 Service Unavailable - Unhealthy):**
```json
{
  "status": "critical",
  "message": "Critical services are unavailable",
  "uptime": 30
}
```

**Use Cases:**
- Docker container health check
- Load balancer availability detection
- Simple uptime monitoring

**Behavior:**
- Returns 200 if application is running normally
- Returns 503 if critical services are unavailable
- Returns 503 if application just started (< 1 second)

---

### GET /health/live - Kubernetes Liveness Probe

Indicates whether the process should be restarted.

**Response (200 OK):**
```json
{
  "status": "alive",
  "uptime": 3600,
  "timestamp": "2026-04-16T10:30:00.000Z"
}
```

**Kubernetes Configuration:**
```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 11000
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

**Behavior:**
- Always returns 200 if process is running
- Kubernetes will restart the pod if this probe fails
- Use short timeout (5s) and frequent checks (10s)

---

### GET /health/ready - Kubernetes Readiness Probe

Indicates whether the application should receive traffic.

**Response (200 OK - Ready):**
```json
{
  "status": "ready",
  "uptime": 3600,
  "dependencies": 2,
  "timestamp": "2026-04-16T10:30:00.000Z"
}
```

**Response (503 Not Ready - Starting):**
```json
{
  "status": "not_ready",
  "reason": "Initialization in progress",
  "uptime": 5
}
```

**Kubernetes Configuration:**
```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 11000
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 1
```

**Behavior:**
- Returns 503 until all critical dependencies are initialized
- Returns 200 when application is ready to serve traffic
- Traffic is not routed to pod until this probe passes
- Faster than liveness probe (5s period vs 10s)

---

### GET /health/startup - Kubernetes Startup Probe

Prevents liveness probe from triggering during slow startup.

**Response (200 OK - Started):**
```json
{
  "status": "started",
  "uptime": 30,
  "timestamp": "2026-04-16T10:30:00.000Z"
}
```

**Kubernetes Configuration:**
```yaml
startupProbe:
  httpGet:
    path: /health/startup
    port: 11000
  initialDelaySeconds: 0
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 30  # 30 * 10s = 5 minute startup window
```

**Behavior:**
- Returns 503 while startup is in progress
- Returns 200 once startup is complete
- Disables liveness probe until startup passes
- Useful for applications with variable startup times

---

### GET /health/detailed - Full Status Report

Provides comprehensive health information for monitoring and debugging. **Protected by authentication.**

**Response (200 OK):**
```json
{
  "status": "ready",
  "uptime": 3600,
  "timestamp": "2026-04-16T10:30:00.000Z",
  "node": {
    "version": "v18.16.0",
    "platform": "linux",
    "arch": "x64",
    "pid": 1234
  },
  "memory": {
    "heapUsedMB": 45,
    "heapTotalMB": 128,
    "rssMB": 120,
    "externalMB": 2
  },
  "services": {
    "tracked": 12,
    "healthy": 11,
    "unhealthy": 1
  },
  "critical": {
    "allHealthy": true,
    "dependenciesCount": 2
  },
  "lastCheck": "2026-04-16T10:29:55.000Z"
}
```

**Authentication:**
```bash
# With API key
curl -H "X-API-Key: your-api-key" \
  https://api.example.com/health/detailed

# With bearer token
curl -H "Authorization: Bearer token" \
  https://api.example.com/health/detailed
```

---

## Docker Integration

### HEALTHCHECK in Dockerfile

The Dockerfile includes an automatic health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:11000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
```

**Parameters:**
- `--interval=30s` - Check every 30 seconds
- `--timeout=5s` - Give the check 5 seconds to respond
- `--start-period=10s` - Grace period for startup
- `--retries=3` - Mark unhealthy after 3 consecutive failures

**Verify health:**
```bash
docker inspect --format='{{json .State.Health}}' container_name
```

---

## Kubernetes Integration

### Complete Probe Configuration

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nooblyjs-core
spec:
  containers:
  - name: app
    image: nooblyjs-core:latest
    ports:
    - containerPort: 11000

    # Startup probe: Allow 5 minutes for startup
    startupProbe:
      httpGet:
        path: /health/startup
        port: 11000
      initialDelaySeconds: 0
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 30

    # Liveness probe: Restart if hung
    livenessProbe:
      httpGet:
        path: /health/live
        port: 11000
      initialDelaySeconds: 10
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3

    # Readiness probe: Only route traffic to healthy pods
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 11000
      initialDelaySeconds: 5
      periodSeconds: 5
      timeoutSeconds: 3
      failureThreshold: 1
```

### Helm Chart Example

```yaml
# values.yaml
healthCheck:
  enabled: true
  startupProbe:
    enabled: true
    failureThreshold: 30
    periodSeconds: 10
  livenessProbe:
    enabled: true
    failureThreshold: 3
    periodSeconds: 10
  readinessProbe:
    enabled: true
    failureThreshold: 1
    periodSeconds: 5
```

```yaml
# templates/deployment.yaml
{{- if .Values.healthCheck.enabled }}
startupProbe:
  httpGet:
    path: /health/startup
    port: {{ .Values.service.port }}
  {{- with .Values.healthCheck.startupProbe }}
  failureThreshold: {{ .failureThreshold }}
  periodSeconds: {{ .periodSeconds }}
  {{- end }}

livenessProbe:
  httpGet:
    path: /health/live
    port: {{ .Values.service.port }}
  {{- with .Values.healthCheck.livenessProbe }}
  failureThreshold: {{ .failureThreshold }}
  periodSeconds: {{ .periodSeconds }}
  {{- end }}

readinessProbe:
  httpGet:
    path: /health/ready
    port: {{ .Values.service.port }}
  {{- with .Values.healthCheck.readinessProbe }}
  failureThreshold: {{ .failureThreshold }}
  periodSeconds: {{ .periodSeconds }}
  {{- end }}
{{- end }}
```

---

## Load Balancer Integration

### AWS Application Load Balancer (ALB)

```
Target Group Health Check Configuration:
- Health check protocol: HTTP
- Health check path: /health
- Health check port: 11000
- Healthy threshold: 2
- Unhealthy threshold: 2
- Timeout: 5 seconds
- Interval: 30 seconds
- Success codes: 200
```

### AWS Network Load Balancer (NLB)

```
Target Group Health Check Configuration:
- Health check protocol: HTTP
- Health check path: /health
- Health check port: 11000
- Healthy threshold: 3
- Unhealthy threshold: 3
- Timeout: 10 seconds
- Interval: 30 seconds
```

### NGINX

```nginx
upstream digital_technologies {
    server app1:11000;
    server app2:11000;
    server app3:11000;
}

server {
    location / {
        proxy_pass http://digital_technologies;
    }
}

# Health check (NGINX Plus)
upstream digital_technologies {
    server app1:11000;
    server app2:11000;
    server app3:11000;
    
    zone backend 64k;
    check interval=3000 rise=2 fall=5 timeout=1000 type=http;
    check_http_send "GET /health HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx;
}
```

---

## Monitoring Integration

### Prometheus

Create a scrape configuration:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'nooblyjs-core'
    static_configs:
      - targets: ['localhost:11000']
    metrics_path: '/metrics'  # If metrics endpoint exists
```

### Datadog

```python
# datadog-agent config
init_config:
  default_timeout: 5

instances:
  - name: Noobly JS Core
    url: http://localhost:11000/health/detailed
    auth_type: api_key
    api_key: your_api_key
```

### Grafana

Add a data source and create a dashboard:

```json
{
  "dashboard": {
    "title": "Noobly JS Core Health",
    "panels": [
      {
        "title": "Application Status",
        "targets": [
          {
            "url": "http://localhost:11000/health/detailed",
            "method": "GET"
          }
        ]
      }
    ]
  }
}
```

---

## Troubleshooting

### Application returns 503 on /health

**Check:**
1. Is the application running? `docker ps` or `kubectl get pods`
2. Are critical services initialized? Check logs: `./.application/logs/`
3. Are dependencies accessible? (Database, Redis, etc.)

**Solutions:**
- Verify database connections: `npm run tests -- tests/unit/dataservice/`
- Check Redis availability: `redis-cli ping`
- Review PRODUCTION_SETUP.md for configuration

### Health checks failing after deployment

**Check:**
1. Is the port correct? Default is `11000`
2. Are health endpoints accessible? `curl http://localhost:11000/health`
3. Is the application in the startup period? Give it more time

**Solutions:**
- Increase `initialDelaySeconds` in Kubernetes probes
- Increase `--start-period` in Docker HEALTHCHECK
- Check network connectivity between load balancer and application

### Kubernetes pods not becoming ready

**Check:**
1. `kubectl logs pod_name` for startup errors
2. `kubectl describe pod pod_name` for probe failures
3. `curl http://localhost:11000/health/ready` from pod

**Solutions:**
- Check `readinessProbe` configuration
- Verify all environment variables are set
- Ensure database and cache services are running

---

## Performance Considerations

Health checks add minimal overhead:
- `/health` - ~1ms (quick check)
- `/health/ready` - ~5-10ms (checks dependencies)
- `/health/detailed` - ~20-50ms (full status report)

With default frequency:
- Docker: 30s interval = ~0.1% overhead
- Kubernetes readiness: 5s interval = ~0.3% overhead
- Kubernetes liveness: 10s interval = ~0.1% overhead

---

## Best Practices

1. **Use appropriate probe types**
   - Startup: For slow-starting applications
   - Readiness: For traffic routing decisions
   - Liveness: For crash detection only

2. **Configure reasonable timeouts**
   - Too short: False positives
   - Too long: Slow detection
   - Default 3-5 seconds is usually right

3. **Monitor health check metrics**
   - Track probe success/failure rates
   - Alert on repeated failures
   - Monitor health check latency

4. **Implement fallbacks**
   - Health checks should work even if some services are down
   - Use cached results if database is slow
   - Never have health check depend on critical service

5. **Test probe endpoints**
   ```bash
   # Test liveness
   curl -v http://localhost:11000/health/live
   
   # Test readiness
   curl -v http://localhost:11000/health/ready
   
   # Test detailed status
   curl -H "X-API-Key: your-key" http://localhost:11000/health/detailed
   ```

---

## See Also

- [Production Setup Guide](./PRODUCTION_SETUP.md) - Full deployment instructions
- [Error Handling Guide](./ERROR_HANDLING.md) - Error handling and resilience
- [CLAUDE.md](../CLAUDE.md) - Architecture and service structure
