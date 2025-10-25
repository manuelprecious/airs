markdown
# AIRS Watchman - 24/7 AI Monitoring & Auto-Remediation Service

## Overview
AIRS Watchman is an intelligent monitoring system that provides 24/7 AI-powered service health monitoring and automated remediation. It continuously monitors backend services, detects critical issues, and automatically triggers AI-driven remediation workflows.

## Features
- 🔍 **Real-time Service Monitoring** - Continuous health checks and status polling
- 🤖 **AI-Powered Remediation** - Automated problem resolution via Langflow AI
- ⚡ **Smart Rate Limiting** - Token management for AI API calls
- 📊 **Comprehensive Health Dashboard** - System status and metrics
- 🔄 **Persistent Critical Tracking** - Progressive backoff for recurring issues
- 📝 **Detailed Logging** - Winston-based logging with file and console outputs

## Architecture
Service Poller → Critical Detector → Auto Remediation → Langflow AI
↓
Health API ← Token Manager ← Watchman Service

text

## Prerequisites
- Node.js v22.20.0 or higher
- Backend service running on port 5000
- Langflow instance running on port 7860
- Watchman service on port 5001 (if using companion service)

## Quick Start

### Method 1: Git Clone & Run
```bash
# Clone the repository
git clone <repository-url>
cd airs-watchman

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your actual values

# Start the service
npm start

# For development
npm run dev
Method 2: Docker
bash
# Build the image
docker build -t airs-watchman .

# Run the container
docker run -d \
  -p 5001:5001 \
  --name airs-watchman \
  --env-file .env \
  airs-watchman
Method 3: Docker Compose
bash
# Start with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
Configuration
Environment Variables
Create a .env file with the following variables:

bash
# Service URLs
BACKEND_URL=http://localhost:5000
WATCHMAN_URL=http://localhost:5001
LANGFLOW_URL=http://localhost:7860

# Langflow AI Configuration
LANGFLOW_API_KEY=your_langflow_api_key
LANGFLOW_HEALTH_FLOW_ID=6054595b-9a4f-4f84-89ca-4f602cac0bff
LANGFLOW_REMEDIATION_FLOW_ID=a9fa6d4b-4f83-41e5-8072-a35c313648da

# Token Management
DAILY_TOKEN_LIMIT=500000
MINUTE_TOKEN_LIMIT=6000
DAILY_REQUEST_LIMIT=20000
MINUTE_REQUEST_LIMIT=200

# Service Settings
NODE_ENV=development
LOG_LEVEL=info
File Structure
text
airs-watchman/
├── index.js                 # Main application entry
├── routes/
│   ├── health.js           # Health check endpoints
│   └── ...                 # Other route files
├── services/
│   ├── poller.js           # Service polling logic
│   ├── detector.js         # Critical state detection
│   ├── remediator.js       # Auto-remediation service
│   └── token_manager.js    # API rate limiting
├── config/
│   └── constants.js        # Configuration constants
├── utils/
│   └── logger.js           # Logging configuration
├── logs/                   # Application logs
├── Dockerfile
├── docker-compose.yml
└── package.json
API Documentation
Health & Status Endpoints
GET /system-status
Returns comprehensive system health status.

Response:

json
{
  "watchman": {
    "running": true,
    "lastHeartbeat": "2024-01-15T10:30:00.000Z"
  },
  "langflow": {
    "connected": true,
    "lastChecked": "2024-01-15T10:30:00.000Z"
  },
  "remediation": {
    "total_fixes": 15,
    "success_rate": "87%",
    "active_remediations": 2,
    "system_load": "Low"
  },
  "overall_status": "operational",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
GET /remediation-status
Returns current remediation status and history.

Response:

json
{
  "active_triggers": 2,
  "persistent_critical": 1,
  "flow_id": "a9fa6d4b-4f83-41e5-8072-a35c313648da",
  "last_trigger": "2024-01-15T10:25:00.000Z",
  "persistent_critical_services": [
    {
      "serviceId": "service-123",
      "firstDetected": "2024-01-15T10:15:00.000Z",
      "triggerCount": 3,
      "timeCritical": "15 minutes"
    }
  ]
}
GET /token-usage
Returns current token usage and rate limits.

Response:

json
{
  "tokens": {
    "daily": 12500,
    "minute": 450,
    "dailyLimit": 500000,
    "minuteLimit": 6000
  },
  "requests": {
    "daily": 89,
    "minute": 12,
    "dailyLimit": 20000,
    "minuteLimit": 200
  }
}
Service Management Endpoints
POST /remediate/:serviceId
Manually trigger remediation for a specific service.

Body:

json
{
  "reason": "Manual remediation request",
  "priority": "high"
}
Response:

json
{
  "success": true,
  "message": "Remediation triggered for service-123",
  "session_id": "uuid-here",
  "attempt": 1
}
Monitoring & Health Checks
Service States
HEALTHY: Service operating normally

WARNING: Service showing degradation

CRITICAL: Service requires immediate attention

Polling Intervals
Normal: 30 seconds

Degraded: 15 seconds

Critical: 10 seconds

Auto-Remediation Features
Progressive backoff (5min, 15min, 30min, 1hr)

Persistent critical service tracking

AI-driven remediation workflows

Fallback rule-based remediation

Email escalation after 3 failures

Logging
Logs are stored in the logs/ directory:

error.log - Error-level logs only

combined.log - All application logs

Log Levels
error - Critical errors requiring attention

warn - Warning conditions

info - General operational information

debug - Debug-level information

Troubleshooting
Common Issues
Service cannot connect to backend:

bash
# Check if backend is running
curl http://localhost:5000/api/services

# Verify BACKEND_URL in .env
Langflow API failures:

bash
# Test Langflow connection
curl -H "x-api-key: YOUR_KEY" http://localhost:7860/api/v1/flows

# Verify LANGFLOW_API_KEY and LANGFLOW_URL
High token usage:

Check token usage via /token-usage endpoint

Review service polling frequency

Adjust token limits in configuration

Health Check
bash
# Check service health
curl http://localhost:5001/system-status

# Check remediation status
curl http://localhost:5001/remediation-status
Development
Running Tests
bash
# Install dev dependencies
npm install

# Start in development mode
npm run dev
Adding New Services
Ensure backend service exposes /api/services endpoint

Service should have health metrics (CPU, memory, error rate, latency)

Update polling intervals in config/constants.js if needed

Deployment
Production Considerations
Set NODE_ENV=production

Configure proper logging levels

Set appropriate token limits for your usage

Ensure all required services are accessible

Configure health check endpoints for orchestration

Docker Production Deployment
bash
# Build with production optimizations
docker build --target production -t airs-watchman:prod .

# Run with production settings
docker run -d \
  -p 5001:5001 \
  --name airs-watchman-prod \
  --env-file .env.production \
  --restart unless-stopped \
  airs-watchman:prod
Security
API keys are stored in environment variables

All sensitive configuration externalized

Rate limiting on AI API calls

No hardcoded credentials in source code

Support
For issues and questions:

Check application logs in logs/ directory

Verify all environment variables are set

Ensure all dependent services are running

Check token usage and limits

License
MIT License

Copyright (c) 2024 AIRS Watchman

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.