# SRE Monitoring Backend - Complete Documentation

---

## Table of Contents
* [Overview](#overview)
* [Project Structure](#project-structure)
* [API Documentation](#api-documentation) 
* [Core Services](#core-services)
* [Setup & Installation](#setup--installation)
* [Docker Deployment](#docker-deployment)
* [Environment Variables](#environment-variables)
* [Development Guide](#development-guide)
* [Troubleshooting](#troubleshooting)

---

## Overview
The **SRE Monitoring Backend** is a Node.js/Express API that provides comprehensive service monitoring, automated remediation, and log analysis capabilities. It serves as the core engine for tracking service health, simulating failures, and executing recovery actions.

### **Key Features**
* **Real-time Service Monitoring:** Track CPU, memory, latency, error rates, and throughput across multiple services
* **Automated Remediation:** Built-in recovery actions with configurable success probabilities
* **Log Analysis:** Pattern recognition and root cause analysis
* **Load Simulation:** Controlled stress testing with multiple intensity levels
* **Health Checking:** Comprehensive system status monitoring
* **RESTful API:** Full CRUD operations for service management

---

## Project Structure
```text
airs-backend/
├── config/
│   └── constants.js          # Thresholds & configurations
├── models/
│   └── Service.js           # Service data model & in-memory storage
├── routes/
│   ├── services.js          # Service management endpoints
│   ├── health.js            # Health check endpoints
│   └── status.js            # System status monitoring
├── services/
│   ├── metricsService.js    # Metrics simulation engine
│   ├── remediationService.js # Automated remediation actions
│   └── logService.js        # Log pattern analysis
├── utils/
│   └── helpers.js           # Utility functions
├── server.js                # Main application entry point
├── package.json             # Dependencies & scripts
├── Dockerfile               # Container configuration
├── .env.example             # Environment template
└── .gitignore               # Git ignore rules
```

markdown
### API Documentation
```bash
Base URL: http://localhost:5000/api
```
## Health & Status Endpoints

### GET /health
Returns overall system health status

```bash
curl http://localhost:5000/api/health
```
``` json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services_healthy": 5,
  "services_critical": 1,
  "services_total": 6,
  "uptime": 3600.45
}
```

### GET /system-status
Returns comprehensive system status including external service connectivity

```bash
curl http://localhost:5000/api/system-status
```

``` json
{
  "watchman": {
    "running": true,
    "lastHeartbeat": "2024-01-15T10:29:55.000Z",
    "uptime": 7200
  },
  "langflow": {
    "connected": true,
    "lastChecked": "2024-01-15T10:30:00.000Z"
  },
  "overall_status": "operational",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Service Management Endpoints
### GET /services

Returns overview of all monitored services

```bash
curl http://localhost:5000/api/services
```

```json
[
  {
    "id": "S1",
    "name": "Payment Gateway",
    "status": "critical",
    "remediationInProgress": false,
    "awaitingRemediation": true,
    "instanceCount": 2,
    "lastIncident": {
      "timestamp": "2024-01-15T10:25:00.000Z",
      "action_taken": "restart_service",
      "reason": "High CPU usage"
    }
  }
]
```

### GET /services/:id/metrics
Returns detailed metrics and logs for a specific service

```bash
curl http://localhost:5000/api/services/S1/metrics
```

```json
{
  "id": "S1",
  "name": "Payment Gateway",
  "status": "critical",
  "metrics": {
    "cpu": 92.5,
    "memory": 85.2,
    "latency": 1200,
    "error_rate": 15.5,
    "throughput": 150
  },
  "logs": [
    {
      "timestamp": "2024-01-15T10:29:00.000Z",
      "level": "ERROR",
      "message": "CPU utilization exceeding thresholds",
      "trace_id": "trace-1705314540123"
    }
  ],
  "remediationInProgress": false,
  "awaitingRemediation": true,
  "instanceCount": 2,
  "lastIncident": null
}
```

### GET /services/:id/logs/analysis
Returns AI-ready analysis of service logs and metrics

```bash
curl http://localhost:5000/api/services/S1/logs/analysis
```
```json
{
  "recent_errors": ["CPU utilization exceeding thresholds"],
  "patterns": ["high_cpu_usage"],
  "suggested_actions": ["scale_instances", "restart_service"],
  "root_cause": "high_cpu_load",
  "analysis_timestamp": "2024-01-15T10:30:00.000Z"
}
```

### POST /services/:id/simulate-load
Triggers artificial load on a service to test failure scenarios

```bash
curl -X POST http://localhost:5000/api/services/S1/simulate-load \
  -H "Content-Type: application/json" \
  -d '{"intensity": "high"}'
```

```json
{
  "message": "Applied high load to Payment Gateway",
  "current_metrics": {
    "cpu": 92.5,
    "memory": 85.2,
    "latency": 1200,
    "error_rate": 15.5,
    "throughput": 150
  },
  "status": "critical",
  "awaiting_remediation": true
}
```

### POST /services/:id/remediate
Initiates remediation action on a critical service

``` bash
curl -X POST http://localhost:5000/api/services/S1/remediate \
  -H "Content-Type: application/json" \
  -d '{"action": "restart_service", "reason": "High CPU usage detected"}'
```
```json
{
  "message": "Remediation action 'restart_service' initiated",
  "estimated_completion": 4000,
  "service_status": "remediating",
  "action_reason": "High CPU usage detected",
  "success_probability": 0.9
}
```

### POST /services/reset
Resets all services to healthy state

```bash
curl -X POST http://localhost:5000/api/services/reset
```

```json
{
  "message": "All services reset to healthy state"
}
```


## Core Services
### Metrics Service

* Automatic Updates: Metrics update every 5 seconds with realistic fluctuations

* Status Transitions: Automatic health state changes based on configurable thresholds

* Natural Behavior: Simulates real-world service behavior patterns

## Remediation Service
* Multiple Actions: restart_service, scale_instances, scale_memory, clear_cache, kill_connections

* Configurable Success: Each action has configurable success probability and duration

* State Management: Tracks remediation progress and prevents conflicts

## Log Analysis Service
* Pattern Recognition: Identifies error patterns from service logs

* Root Cause Analysis: Determines probable causes of service issues

* Action Recommendations: Suggests appropriate remediation strategies

## Setup & Installation
### Prerequisites
* Node.js 22+

* npm or yarn package manager

## Local Development

```bash
# Clone the repository
git clone <repository-url>
cd airs-backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your actual values

# Start the application
npm start

# Development mode with auto-reload
npm run dev
```

### Production Deployment
```bash
# Set environment to production
export NODE_ENV=production

# Start the application
npm start
```

## Docker Deployment
### Build Image
``` bash
docker build -t airs-backend:latest .
```

### Run Container
```bash
# Using environment file
docker run -p 5000:5000 --env-file .env airs-backend:latest

# With individual environment variables
docker run -p 5000:5000 \
  -e LANGFLOW_API_KEY="your_key" \
  -e WATCHMAN_BASE_URL="http://localhost:5001" \
  airs-backend:latest
```

### Development with Hot Reload
``` bash
docker run -p 5000:5000 \
  -v $(pwd):/app \
  -v /app/node_modules \
  --env-file .env \
  airs-backend:latest npm run dev
```

### Container Management
```bash
# View logs
docker logs airs-backend

# Stop container
docker stop airs-backend

# Remove container
docker rm airs-backend

# Health check
docker inspect --format='{{.State.Health.Status}}' airs-backend
```

## Environment Variables
Create a `.env` file with the following variables:

```env
# API Configuration
LANGFLOW_API_KEY=your_langflow_api_key_here

# Service URLs
WATCHMAN_BASE_URL=http://localhost:5001
LANGFLOW_BASE_URL=http://localhost:7860
LANGFLOW_FLOW_ID=your_flow_id_here

# CORS Configuration
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Server Configuration
PORT=5000
NODE_ENV=development
```

## Development Guide
### Adding New Services
Update the service initialization in `models/Service.js`:

```javascript
function initializeServices() {
  services = [
    new Service('S1', 'Payment Gateway', 'critical'),
    new Service('S2', 'User Auth API', 'healthy'),
    // Add new service
    new Service('S7', 'New Microservice', 'healthy'),
  ];
}
```

### Adding New Metric Types
Update thresholds in `config/constants.js`:

```javascript
const THRESHOLDS = {
  // Existing thresholds
  cpu: { warn: 70, crit: 85 },
  memory: { warn: 75, crit: 90 },
  // Add new metric
  network_throughput: { warn: 1000, crit: 2000 }
};
```

### Customizing Remediation Actions
Add new actions in `config/constants.js`:

```javascript
const REMEDIATION_CONFIG = {
  // Existing actions
  restart_service: { time: 4000, successProbability: 0.9 },
  // Add new action
  redeploy_service: { time: 8000, successProbability: 0.95 }
};
```

## Troubleshooting
### Common Issues
Port 5000 Already in Use

```bash
# Use different port
docker run -p 5001:5000 airs-backend:latest
# Or change PORT in .env file
```
### Environment Variables Not Loading

```bash
# Verify .env file exists in project root
# Check variable names match exactly
# Restart application after changes
```

Docker Build Fails

```bash
# Clear Docker cache
docker build --no-cache -t airs-backend:latest .
```

### Debug Mode
Enable debug logging by setting environment variable:

```bash
DEBUG=true node server.js
```

### Logs & Debugging
```bash
# View application logs
docker logs airs-backend

# Check health endpoint
curl http://localhost:5000/api/health

# Verify all services are running
curl http://localhost:5000/api/services
```

### Default Service Configuration

| Service               | Initial Status | Description                          |
|-----------------------|----------------|--------------------------------------|
| Payment Gateway (S1)  | `critical`     | Starts in critical state for demo    |
| User Auth API (S2)    | `healthy`      | Normal operation                     |
| Inventory Service (S3)| `warning`      | Minor issues detected                |
| Reporting Engine (S4) | `healthy`      | Normal operation                     |
| Search Indexer (S5)   | `healthy`      | Normal operation                     |
| Log Ingestion (S6)    | `healthy`      | Normal operation                     |

### Security Features
* Helmet.js: Security headers protection
* CORS Configuration: Controlled cross-origin access
* Input Validation: API endpoint input sanitization
* Non-root Execution: Docker containers run as non-root user
* Environment Variables: Sensitive data protection


### License
MIT License - see LICENSE file for details

### Contributing
* Fork the repository
* Create a feature branch (git checkout -b feature/amazing-feature)
* Commit your changes (git commit -m 'Add amazing feature')
* Push to the branch (git push origin feature/amazing-feature)
* Open a Pull Request

### Support
For issues and questions:
1. Check the troubleshooting section above
2. Review API documentation
3. Open an issue in the repository