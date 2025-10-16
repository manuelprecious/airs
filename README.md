http://localhost:5000/api


### Health Check
`GET /health`

bash
curl http://localhost:5000/api/health

**Response:**
json
{
  "status": "degraded",
  "timestamp": "2025-10-15T18:23:24.379Z",
  "services_healthy": 3,
  "services_critical": 3,
  "services_total": 6,
  "uptime": 780.7896482
}


### Service Management
* `GET /services`: Returns overview of all services
    * *Response:* Array of service objects with basic info
* `GET /services/:id/metrics`: Returns detailed metrics and logs for a specific service
    * *Response:* Complete service object with metrics, logs, and state
* `POST /services/:id/simulate-load`: Triggers artificial load on a service to test failure scenarios
    **Body:**
    json
    {
      "intensity": "low|medium|high|extreme"
    }
    
* `POST /services/:id/remediate`: Initiates remediation action on a critical service
    **Body:**
    json
    {
      "action": "restart_service|scale_instances|scale_memory|clear_cache|kill_connections",
      "reason": "Description of why remediation is needed"
    }
    

### Service Object Structure
javascript
{
  "id": "S1",
  "name": "Payment Gateway",
  "status": "critical", // healthy|warning|critical
  "metrics": {
    "cpu": 92.0,        // Percentage
    "memory": 85.0,     // Percentage  
    "latency": 1200,    // Milliseconds
    "error_rate": 15.5, // Percentage
    "throughput": 150   // Requests per second
  },
  "logs": [...],        // Recent log entries
  "remediationInProgress": false,
  "awaitingRemediation": true,
  "instanceCount": 4,
  "lastIncident": null
}


### Configuration Constants
**Thresholds** (`config/constants.js`):
javascript
const THRESHOLDS = {
  cpu: { warn: 70, crit: 85 },
  memory: { warn: 75, crit: 90 },
  latency: { warn: 300, crit: 500 },
  error_rate: { warn: 5, crit: 10 }
};

**Remediation Actions:**
javascript
const REMEDIATION_CONFIG = {
  restart_service: { time: 4000, successProbability: 0.9 },
  scale_instances: { time: 6000, successProbability: 0.8 },
  scale_memory: { time: 5000, successProbability: 0.85 },
  clear_cache: { time: 3000, successProbability: 0.7 },
  kill_connections: { time: 3500, successProbability: 0.75 }
};


---

## Frontend Documentation
### Component Architecture
text
App.jsx
├── DashboardContext.jsx (State Management)
├── Header.jsx
├── Sidebar.jsx
└── MainDashboardView.jsx
    ├── ServiceCard.jsx (Individual Service Display)
    ├── DoughnutChart.jsx (Health Overview)
    ├── LogItem.jsx (Audit Log Entries)
    └── Sparkline.jsx (Metric Trends)


### Key Components
* **DashboardContext.jsx**: Central state management for the entire application, handles backend communication and data synchronization, manages service states, metrics, and remediation actions, and implements 2-second polling for real-time updates.
* **ServiceCard.jsx**: Displays individual service health and metrics, shows real-time metrics in 2x2 grid (CPU, Memory, Latency, Errors), provides remediation action buttons, and includes visual status indicators and alert badges.
* **MainDashboardView.jsx**: Primary dashboard layout and organization, health overview with summary statistics, service grid layout and log display, and tabbed interface for different log views.

### State Management
The application uses a combination of:
* **React Context** for global state
* **Local Storage** for persistence
* **Custom Hooks** for backend communication

javascript
// Using the dashboard context
const { 
  services,           // Array of service objects
  logs,               // Audit log entries
  startRemediation,   // Function to trigger remediation
  isLoading,          // Loading state
  error,              // Error messages
  refreshData,        // Manual refresh function
  backendAvailable    // Backend connectivity status
} = useDashboard();


### Styling System
The UI uses CSS custom properties for theming:

css
/* Dark Mode (Default) */
.dark-mode {
  --bg-dark: #0f172a;
  --bg-medium: #1e293b;
  --text-primary: #f8fafc;
  /* ... other variables */
}

/* Light Mode */
.light-mode {
  --bg-dark: #f1f5f9;
  --bg-medium: #ffffff;
  --text-primary: #0f172a;
  /* ... other variables */
}


---

## AI Agent Integration
### AIRS Agent Architecture
The system is designed for seamless AI agent integration with the following capabilities:

### 1. Service Analysis Endpoint
`GET /services/:id/logs/analysis`
Provides AI-ready analysis of service logs and metrics

**Response:**
json
{
  "recent_errors": ["CPU utilization exceeding thresholds", "..."],
  "patterns": ["high_cpu_usage", "memory_leak"],
  "suggested_actions": ["restart_service", "scale_instances"],
  "root_cause": "high_cpu_load",
  "analysis_timestamp": "2025-10-15T18:23:24.379Z"
}


### 2. AI Decision Framework
javascript
// Example AI agent decision logic
class AIRSAgent {
  async analyzeAndRemediate(serviceId) {
    // Step 1: Get service analysis
    const analysis = await this.getServiceAnalysis(serviceId);
    
    // Step 2: Determine best action based on patterns
    const action = this.determineRemediationAction(analysis);
    
    // Step 3: Execute remediation
    if (action) {
      await this.triggerRemediation(serviceId, action, analysis);
    }
  }
  
  determineRemediationAction(analysis) {
    const strategy = {
      'high_cpu_usage': 'scale_instances',
      'memory_leak': 'restart_service',
      'database_connection_issues': 'kill_connections',
      'high_latency': 'clear_cache'
    };
    
    for (let pattern of analysis.patterns) {
      if (strategy[pattern]) {
        return strategy[pattern];
      }
    }
    
    return 'restart_service'; // Default fallback
  }
}


### 3. Integration Points
**Real-time Monitoring:**
javascript
// Poll for critical services and auto-remediate
setInterval(async () => {
  const services = await fetchServices();
  const criticalServices = services.filter(s => s.status === 'critical');
  
  for (const service of criticalServices) {
    await aiAgent.analyzeAndRemediate(service.id);
  }
}, 10000); // Check every 10 seconds

**Log Pattern Recognition:**
javascript
// Backend error pattern configuration
const ERROR_PATTERNS = {
  high_cpu: [
    "CPU utilization exceeding thresholds",
    "Garbage collection overhead",
    "Thread pool exhaustion"
  ],
  memory_leak: [
    "OutOfMemoryError",
    "GC overhead limit exceeded", 
    "Heap space exhausted"
  ]
  // ... more patterns
};


### 4. AI Agent API Client
javascript
// Complete AI agent implementation example
class AIRSAgentClient {
  constructor(backendUrl = 'http://localhost:5000') {
    this.backendUrl = backendUrl;
  }
  
  async getServiceAnalysis(serviceId) {
    const response = await fetch(
      `${this.backendUrl}/api/services/${serviceId}/logs/analysis`
    );
    return await response.json();
  }
  
  async triggerRemediation(serviceId, action, reason) {
    const response = await fetch(
      `${this.backendUrl}/api/services/${serviceId}/remediate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Remediation failed: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  async monitorAndRemediate() {
    try {
      // Get all services
      const response = await fetch(`${this.backendUrl}/api/services`);
      const services = await response.json();
      
      // Find critical services needing remediation
      const criticalServices = services.filter(
        service => service.status === 'critical' && 
                   !service.remediationInProgress &&
                   service.awaitingRemediation
      );
      
      // Remediate each critical service
      for (const service of criticalServices) {
        console.log(`🔄 AI Agent analyzing critical service: ${service.name}`);
        
        const analysis = await this.getServiceAnalysis(service.id);
        const action = this.determineOptimalAction(analysis);
        
        console.log(`🚀 AI Agent triggering ${action} for ${service.name}`);
        await this.triggerRemediation(
          service.id, 
          action, 
          `AI Automated: ${analysis.root_cause}`
        );
        
        // Add delay between remediations
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('AI Agent monitoring error:', error);
    }
  }
  
  determineOptimalAction(analysis) {
    // Implement AI decision logic here
    // This can be enhanced with ML models
    
    if (analysis.patterns.includes('high_cpu_usage')) {
      return 'scale_instances';
    } else if (analysis.patterns.includes('memory_leak')) {
      return 'restart_service';
    } else if (analysis.patterns.includes('database_connection_issues')) {
      return 'kill_connections';
    } else if (analysis.patterns.includes('high_latency')) {
      return 'clear_cache';
    }
    
    // Default action
    return 'restart_service';
  }
}

// Usage example
const aiAgent = new AIRSAgentClient();
setInterval(() => aiAgent.monitorAndRemediate(), 15000); // Run every 15 seconds


---

## Setup & Installation
### Prerequisites
* **Node.js** 16+ and npm
* Modern web browser
* (Optional) **Docker** for containerization

### Backend Setup
Navigate to backend directory:
bash
cd airs-backend

Install dependencies:
bash
npm install

Start the backend server:
bash
node server.js

The backend will start on **http://localhost:5000**

### Frontend Setup
Navigate to frontend directory:
bash
cd airs-frontend

Install dependencies:
bash
npm install

Start the development server:
bash
npm run dev

The frontend will start on **http://localhost:3000** (or similar)

### Environment Variables
**Backend (`.env`):**
env
PORT=5000
NODE_ENV=development

**Frontend (`.env`):**
env
VITE_BACKEND_URL=http://localhost:5000


---

## Development Guide
### Adding New Services
**Backend - Update Service Models:**
javascript
// In models/Service.js
function initializeServices() {
  services = [
    new Service('S1', 'Payment Gateway', 'critical'),
    new Service('S2', 'User Auth API', 'healthy'),
    // Add new service:
    new Service('S7', 'New Microservice', 'healthy'),
  ];
}

**Frontend - Service will automatically appear** due to dynamic data loading.

### Adding New Metric Types
**Backend - Update Constants:**
javascript
// In config/constants.js
const THRESHOLDS = {
  // ... existing thresholds
  network_throughput: { warn: 1000, crit: 2000 } // MB/s
};

**Frontend - Update Metric Processing:**
javascript
// In DashboardContext.jsx, update transformBackendMetrics
const transformBackendMetrics = (backendMetrics) => {
  return {
    // ... existing metrics
    Network_Throughput: backendMetrics.network_throughput || 0
  };
};


### Customizing Remediation Actions
**Add New Action to Backend:**
javascript
// In config/constants.js
const REMEDIATION_CONFIG = {
  // ... existing actions
  redeploy_service: { time: 8000, successProbability: 0.95 }
};

**Update Remediation Service:**
javascript
// In services/remediationService.js, add action handler
const actionMessages = {
  // ... existing messages
  redeploy_service: 'Redeploying service with latest version...'
};


---

## Deployment
### Docker Deployment
**Backend Dockerfile:**
dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]


**Frontend Dockerfile:**
dockerfile
FROM node:16-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80


**`docker-compose.yml`:**
yaml
version: '3.8'
services:
  backend:
    build: ./airs-backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      
  frontend:
    build: ./airs-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend


### Production Considerations
* **Database Persistence:** Replace in-memory storage with Redis/PostgreSQL
* **Authentication:** Add JWT-based auth for API endpoints
* **Rate Limiting:** Implement API rate limiting
* **Monitoring:** Add health checks and metrics export
* **SSL:** Configure HTTPS in production

---

## Troubleshooting
### Common Issues
* **Backend Connection Errors:**
    * Ensure backend is running on port 5000
    * Check `VITE_BACKEND_URL` environment variable
    * Verify CORS configuration
* **Remediation Failures:**
    * Service must be in **critical** status
    * Check `awaitingRemediation` flag is true
    * Verify remediation action is valid
* **Frontend Build Issues:**
    * Clear `node_modules` and reinstall dependencies
    * Check React and Vite version compatibility
    * Verify all environment variables are set

### Debug Mode
Enable debug logging by adding to backend:
javascript
// In server.js
const DEBUG = process.env.DEBUG === 'true';


### Performance Optimization
**Backend:**
* Implement connection pooling
* Add request caching
* Optimize database queries
**Frontend:**
* Implement virtual scrolling for large log lists
* Add request debouncing
* Optimize re-renders with `React.memo`

---

## API Testing Examples
### Using curl for Testing
**Get Service Health:**
bash
curl http://localhost:5000/api/health

**Simulate Load:**
bash
curl -X POST http://localhost:5000/api/services/S1/simulate-load \
  -H "Content-Type: application/json" \
  -d '{"intensity": "high"}'

**Trigger Remediation:**
bash
curl -X POST http://localhost:5000/api/services/S1/remediate \
  -H "Content-Type: application/json" \
  -d '{"action": "restart_service", "reason": "Testing API"}'


### Using JavaScript for Testing
javascript
// Complete test suite
class AIRSTestSuite {
  constructor(baseUrl = 'http://localhost:5000/api') {
    this.baseUrl = baseUrl;
  }
  
  async runFullTest() {
    try {
      console.log('🚀 Starting AIRS System Test...');
      
      // Test 1: Health Check
      await this.testHealthEndpoint();
      
      // Test 2: Service Listing
      const services = await this.testServiceListing();
      
      // Test 3: Load Simulation
      await this.testLoadSimulation(services[0].id);
      
      // Test 4: Remediation
      await this.testRemediation(services[0].id);
      
      console.log('✅ All tests completed successfully!');
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }
  
  async testHealthEndpoint() {
    const response = await fetch(`${this.baseUrl}/health`);
    const data = await response.json();
    console.log('🏥 Health Check:', data.status);
    return data;
  }
  
  async testServiceListing() {
    const response = await fetch(`${this.baseUrl}/services`);
    const services = await response.json();
    console.log('📊 Services Found:', services.length);
    return services;
  }
  
  async testLoadSimulation(serviceId) {
    const response = await fetch(`${this.baseUrl}/services/${serviceId}/simulate-load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intensity: 'high' })
    });
    const result = await response.json();
    console.log('⚡ Load Simulation:', result.message);
    return result;
  }
  
  async testRemediation(serviceId) {
    // Wait a bit for service to become critical
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const response = await fetch(`${this.baseUrl}/services/${serviceId}/remediate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'restart_service',
        reason: 'Automated test remediation'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Remediation failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('🛠️ Remediation Started:', result.message);
    return result;
  }
}

// Run tests
const testSuite = new AIRSTestSuite();
testSuite.runFullTest();


---

## Conclusion
The **SRE AI Remediation System (AIRS)** provides a comprehensive foundation for monitoring and automating microservices remediation. With its modular architecture, real-time dashboard, and AI-ready APIs, it serves as both a practical monitoring tool and a platform for advanced AI-driven operations.

The system is designed for extensibility, allowing teams to:
* Add new metric types and thresholds
* Implement custom remediation actions
* Integrate with existing monitoring solutions
* Deploy AI agents for autonomous operations

For questions or contributions, refer to the source code documentation and API specifications provided in this document.