AIRS Langflow Components
AI-powered SRE tools for monitoring, diagnosing, and remediating service issues in real-time.

Overview
AIRS (AI-powered SRE) provides a suite of Langflow custom components that enable AI agents to monitor, diagnose, and remediate service health issues through natural language interactions.

Features
🔍 Real-time Service Monitoring - Get instant visibility into service health and metrics

🔧 Intelligent Diagnostics - AI-powered root cause analysis and log pattern detection

⚡ Automated Remediation - Safe execution of remediation actions with verification

🛡️ Security First - Robust URL validation and sanitized error messages

🤖 Agent-Friendly - Natural language interface for AI agents

Components
Diagnostic Tools
ServiceLister
Description: Get overview of all services and their current status. Use when you need to know the current system state.

Inputs:

backend_url (UI Setting): AIRS backend API URL (e.g., http://localhost:5000)

query (Agent): Natural language query about system status

Output: JSON with service summary and detailed list

json
{
  "summary": {
    "total_services": 6,
    "healthy_count": 4,
    "warning_count": 1,
    "critical_count": 1
  },
  "services": [...]
}
Example Agent Usage: "List all services and their status"

HealthChecker
Description: Check service health status and metrics. Use when you need detailed service state information.

Inputs:

backend_url (UI Setting): AIRS backend API URL

service_input (Agent): Service ID or name to check

Output: Comprehensive health report with metric status

json
{
  "service_name": "Payment Gateway",
  "overall_status": "CRITICAL",
  "metrics": [...]
}
Example Agent Usage: "Check health of service S1", "What's the status of Payment Gateway?"

LogAnalyzer
Description: Analyze service logs to identify error patterns. Use when diagnosing service issues.

Inputs:

backend_url (UI Setting): AIRS backend API URL

service_input (Agent): Service to analyze logs for

Output: Analysis with patterns and recommended actions

json
{
  "root_cause": "high_cpu_load",
  "patterns": ["CPU spikes every 5 minutes"],
  "suggested_actions": [...]
}
Example Agent Usage: "Analyze logs for service S1", "Check error patterns in auth service"

RootCauseIdentifier
Description: Identify the root cause of service issues. Use after gathering health and log data.

Inputs:

backend_url (UI Setting): AIRS backend API URL

service_input (Agent): Service to identify root cause for

Output: Root cause analysis with confidence scoring

json
{
  "root_cause": "memory_exhaustion",
  "confidence": "High",
  "critical_metrics": ["Memory at 95%"]
}
Example Agent Usage: "Find root cause for service S1", "What's causing Payment Gateway issues?"

Remediation Tools
RecommendActions
Description: Recommend remediation actions based on root cause analysis. Use before executing fixes.

Inputs:

backend_url (UI Setting): AIRS backend API URL

service_input (Agent): Service and context for recommendations

Output: Prioritized action recommendations

json
{
  "recommendations": [
    {
      "action": "restart_service",
      "success_probability": 0.9,
      "risk_level": "low"
    }
  ]
}
Example Agent Usage: "Recommend actions for service S1 with high CPU usage"

ExecuteRemediation
Description: Execute remediation actions on services. Use when you've decided on a fix.

Inputs:

backend_url (UI Setting): AIRS backend API URL

remediation_command (Agent): Action and service to remediate

Output: Action initiation status

json
{
  "action": "restart_service",
  "status": "initiated",
  "success_probability": 0.8
}
Example Agent Usage: "Restart service S1", "Scale instances for Payment Gateway"

RemediationVerifier
Description: Verify that remediation actions were successful. Use after executing fixes.

Inputs:

backend_url (UI Setting): AIRS backend API URL

verification_request (Agent): Service to verify

Output: Verification results with health scoring

json
{
  "remediation_success": true,
  "confidence": "high",
  "health_score": 85
}
Example Agent Usage: "Verify S1 recovery", "Check if Payment Gateway is healthy"

Installation
Prerequisites
Langflow installed and running

AIRS backend service available

Setup
Clone this repository into your Langflow components directory:

bash
cd langflow/components
git clone <repository-url> AIRS
Restart Langflow to load the components

The components will appear in the "Custom Components" section of Langflow

Usage Guide
Step 1: Configure Backend URL
For each AIRS component:

Drag the component to your flow

In the right sidebar, set the Backend API URL to your AIRS backend

Development: http://localhost:5000

Production: http://your-airs-backend:5000

Step 2: Connect Agent
Connect your AI agent to the tool inputs:

query, service_input, remediation_command, etc.

Step 3: Build Your Flow
Create workflows by connecting components:

text
ServiceLister → HealthChecker → LogAnalyzer → RootCauseIdentifier → RecommendActions → ExecuteRemediation → RemediationVerifier
Backend API Requirements
Required Endpoints
Your AIRS backend must implement these exact endpoints:

Service Management
GET /api/services - List all services

json
[
  {
    "id": "S1",
    "name": "Payment Gateway",
    "status": "healthy|warning|critical",
    "remediationInProgress": false,
    "awaitingRemediation": false
  }
]
Health Metrics
GET /api/services/{id}/metrics - Service health metrics

json
{
  "id": "S1",
  "name": "Payment Gateway",
  "status": "critical",
  "metrics": {
    "cpu": 85.5,
    "memory": 92.1,
    "latency": 450,
    "error_rate": 8.2
  }
}
Log Analysis
GET /api/services/{id}/logs/analysis - Log analysis

json
{
  "root_cause": "high_cpu_load",
  "patterns": ["CPU spikes during peak hours"],
  "suggested_actions": ["restart_service", "scale_instances"],
  "recent_errors": ["OutOfMemoryError", "CPUThresholdExceeded"]
}
Remediation
POST /api/services/{id}/remediate - Execute remediation

json
{
  "action": "restart_service",
  "reason": "AI-initiated remediation"
}
Valid Backend URL Examples
http://localhost:5000 ✅

http://airs-backend.internal:5000 ✅

https://api.airs.example.com ✅

Invalid URL Examples
http://google.com ❌ (wrong API structure)

http://localhost:5000/v2 ❌ (wrong endpoint path)

http://user:pass@localhost:5000 ❌ (credentials in URL)

http://localhost:5000?token=abc ❌ (query parameters)

Security Features
URL Validation
All components include robust URL validation:

✅ Scheme validation (http/https only)

✅ Hostname presence check

✅ Credential prevention

✅ Query/fragment prevention

✅ Port range validation

Error Message Sanitization
No backend infrastructure details in errors

Generic connection error messages

Status codes without URL exposure

Example Flows
Basic Monitoring Flow
text
Text Input (query) → Agent → ServiceLister → HealthChecker → Output
Full Troubleshooting Flow
text
Text Input (issue) → Agent → ServiceLister → HealthChecker → LogAnalyzer → RootCauseIdentifier → RecommendActions → ExecuteRemediation → RemediationVerifier → Output
Agent Prompts for Common Tasks
System Overview
text
"Give me a complete system status report"
Service Investigation
text
"Payment Gateway is slow, investigate and fix it"
Emergency Response
text
"Service S3 is down, diagnose and recover immediately"
Troubleshooting
Common Issues
"Cannot connect to AIRS backend service"
Verify your backend URL is correct

Check if the AIRS backend is running

Ensure network connectivity between Langflow and backend

"Service not found"
Verify the service ID exists in your backend

Check service mapping in component documentation

"Invalid backend URL"
Ensure URL starts with http:// or https://

Remove any query parameters or fragments

Don't include credentials in the URL

Debug Mode
For detailed debugging, check Langflow logs for component execution details.

Development
Component Structure
Each component follows this pattern:

python
class ComponentName(Component):
    inputs = [
        MessageTextInput(name="backend_url", ...),  # UI setting
        MessageTextInput(name="agent_input", tool_mode=True, ...)  # Agent control
    ]
    
    def _validate_backend_url(self, url):
        # Security validation
    
    def _make_api_call(self, endpoint):
        # Secure API communication
Adding New Components
Follow the existing security patterns

Include URL validation

Sanitize all error messages

Use consistent JSON response formats

Support
Issues: Create a GitHub issue with detailed description

Backend Integration: Ensure your backend matches the API contract

Agent Training: Provide clear natural language examples to your AI agent

License
MIT License

Copyright (c) 2024 AIRS Langflow Components

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

Note: These components require an AIRS-compatible backend with the exact API structure described above.