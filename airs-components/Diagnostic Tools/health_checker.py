# diagnostic_tools/health_checker.py
from typing import Any, Tuple
import requests
import re
import json
from urllib.parse import urlparse
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema import Message


class HealthChecker(Component):
    display_name = "Health Checker"
    description = "Check service health status and metrics. Use when you need to know current service state."
    icon = "activity"
    name = "HealthChecker"

    inputs = [
        MessageTextInput(
            name="backend_url",
            display_name="Backend API URL",
            info="Base URL for AIRS backend API (e.g., http://localhost:5000)",
            value="http://localhost:5000",
        ),
        MessageTextInput(
            name="service_input",
            display_name="Service Identifier",
            info="Service ID or name to check health (e.g., 'S1', 'Payment Gateway')",
            tool_mode=True,
            value="Check health of service S1"
        )
    ]

    outputs = [
        Output(
            display_name="Health Report",
            name="health_report",
            method="get_health_report"
        )
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.timeout = 10

    def _validate_backend_url(self, url: str) -> str:
        """Validate and sanitize backend URL"""
        if not url:
            raise ValueError("Backend URL cannot be empty")
        
        # Basic URL format validation
        if not re.match(r'^https?://', url):
            raise ValueError("Backend URL must start with http:// or https://")
        
        parsed = urlparse(url)
        
        # Security validations
        if parsed.scheme not in ['http', 'https']:
            raise ValueError("Invalid URL scheme. Must be http or https")
        
        if not parsed.hostname:
            raise ValueError("Invalid URL: missing hostname")
        
        # Prevent credential leakage in URLs
        if parsed.username or parsed.password:
            raise ValueError("URL must not contain username or password")
        
        # Prevent potentially dangerous URL components
        if parsed.query or parsed.fragment:
            raise ValueError("URL must not contain query parameters or fragments")
        
        # Basic port validation
        if parsed.port and (parsed.port < 1 or parsed.port > 65535):
            raise ValueError("Invalid port number")
        
        return url.rstrip('/')

    def _extract_service_id(self, user_input: str) -> str:
        """Extract service ID from natural language input"""
        input_lower = user_input.lower()
        
        # Look for service IDs like S1, S2, etc.
        service_id_match = re.search(r'\b(S[1-9]\d*)\b', input_lower.upper())
        if service_id_match:
            return service_id_match.group(1)
        
        # Map common service names to IDs
        service_mapping = {
            'payment': 'S1',
            'auth': 'S2', 
            'user auth': 'S2',
            'inventory': 'S3',
            'reporting': 'S4',
            'search': 'S5',
            'log': 'S6'
        }
        
        for key, service_id in service_mapping.items():
            if key in input_lower:
                return service_id
        
        # Default to S1 if no match
        return "S1"

    def _make_api_call(self, endpoint: str) -> Any:
        """Make API call to backend with error handling"""
        # Validate URL first
        backend_url = self._validate_backend_url(self.backend_url)
        url = f"{backend_url}/api{endpoint}"
        
        try:
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.ConnectionError:
            # Sanitized error message - no URL exposure
            raise ConnectionError("Cannot connect to AIRS backend service")
        except requests.exceptions.Timeout:
            raise TimeoutError(f"Backend request timed out after {self.timeout} seconds")
        except requests.exceptions.HTTPError as e:
            # Sanitized - only status code, no URL
            if e.response.status_code == 404:
                raise ValueError("Service not found")
            raise Exception(f"Backend returned error: {e.response.status_code}")
        except Exception as e:
            # Generic error without backend details
            raise Exception(f"Error communicating with backend service")

    def _assess_metric_health(self, metric_name: str, value: float) -> Tuple[str, str]:
        """Assess individual metric health"""
        thresholds = {
            'cpu': {'warn': 70, 'crit': 85},
            'memory': {'warn': 75, 'crit': 90},
            'latency': {'warn': 300, 'crit': 500},
            'error_rate': {'warn': 5, 'crit': 10}
        }
        
        if metric_name in thresholds:
            threshold = thresholds[metric_name]
            if value >= threshold['crit']:
                return "🔴", "CRITICAL"
            elif value >= threshold['warn']:
                return "🟡", "WARNING"
            else:
                return "🟢", "HEALTHY"
        return "⚪", "UNKNOWN"

    def get_health_report(self) -> Message:
        """Get health report as a tool response"""
        try:
            user_input = getattr(self, 'service_input', '').strip()
            if not user_input:
                raise ValueError("Please specify which service to check")
            
            service_id = self._extract_service_id(user_input)
            
            # Get service details
            service_data = self._make_api_call(f"/services/{service_id}/metrics")
            
            if not isinstance(service_data, dict):
                raise ValueError("Invalid response format from backend")
            
            # Extract metrics and info
            metrics = service_data.get('metrics', {})
            service_name = service_data.get('name', 'Unknown Service')
            service_status = service_data.get('status', 'unknown')
            
            # Format metrics for JSON response
            formatted_metrics = []
            metric_display_map = {
                'cpu': ("CPU Usage", "%"),
                'memory': ("Memory Usage", "%"),
                'latency': ("Latency", "ms"),
                'error_rate': ("Error Rate", "%"),
                'throughput': ("Throughput", "req/s")
            }
            
            for metric_name, value in metrics.items():
                if metric_name in metric_display_map:
                    display_name, unit = metric_display_map[metric_name]
                    icon, status = self._assess_metric_health(metric_name, value)
                    formatted_metrics.append({
                        "name": metric_name,
                        "display_name": display_name,
                        "value": value,
                        "unit": unit,
                        "status": status,
                        "icon": icon
                    })
            
            # Create JSON response
            json_response = {
                "component": "HealthChecker",
                "service_id": service_id,
                "service_name": service_name,
                "overall_status": service_status.upper(),
                "remediation_in_progress": service_data.get('remediationInProgress', False),
                "awaiting_remediation": service_data.get('awaitingRemediation', False),
                "metrics": formatted_metrics
            }

            self.status = f"Health check completed for {service_name}"
            return Message(text=json.dumps(json_response), sender="HealthChecker")
            
        except Exception as e:
            error_message = f"❌ Error checking service health: {str(e)}"
            self.status = error_message
            return Message(text=error_message, sender="HealthChecker")