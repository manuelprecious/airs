# diagnostic_tools/root_cause_identifier.py
from typing import Any
import requests
import re
import json
from urllib.parse import urlparse
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema import Message


class RootCauseIdentifier(Component):
    display_name = "Root Cause Identifier"
    description = "Identify the root cause of service issues. Use after gathering health and log data."
    icon = "search"
    name = "RootCauseIdentifier"

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
            info="Service ID or name to identify root cause for",
            tool_mode=True,
            value="Find root cause for service S1"
        )
    ]

    outputs = [
        Output(
            display_name="Root Cause Analysis",
            name="root_cause_analysis", 
            method="get_root_cause_analysis"
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
        
        service_id_match = re.search(r'\b(S[1-9]\d*)\b', input_lower.upper())
        if service_id_match:
            return service_id_match.group(1)
        
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

    def get_root_cause_analysis(self) -> Message:
        """Get root cause analysis as a tool response"""
        try:
            user_input = getattr(self, 'service_input', '').strip()
            if not user_input:
                raise ValueError("Please specify which service to analyze")
            
            service_id = self._extract_service_id(user_input)
            
            # Get health data
            health_data = self._make_api_call(f"/services/{service_id}/metrics")
            
            # Get log analysis
            log_analysis = self._make_api_call(f"/services/{service_id}/logs/analysis")
            
            if not isinstance(health_data, dict) or not isinstance(log_analysis, dict):
                raise ValueError("Invalid response format from backend")
            
            service_name = health_data.get('name', 'Unknown Service')
            service_status = health_data.get('status', 'unknown')
            metrics = health_data.get('metrics', {})
            
            # Determine root cause based on combined analysis
            root_cause = log_analysis.get('root_cause', 'unknown')
            recent_errors = log_analysis.get('recent_errors', [])
            confidence = "High" if len(recent_errors) > 2 else "Medium" if recent_errors else "Low"
            
            # Build critical metrics evidence
            critical_metrics = []
            for metric, value in metrics.items():
                if metric == 'cpu' and value > 70:
                    critical_metrics.append(f"CPU at {value}%")
                elif metric == 'memory' and value > 75:
                    critical_metrics.append(f"Memory at {value}%")
                elif metric == 'latency' and value > 300:
                    critical_metrics.append(f"Latency at {value}ms")
                elif metric == 'error_rate' and value > 5:
                    critical_metrics.append(f"Error rate at {value}%")
            
            # Create JSON response
            json_response = {
                "component": "RootCauseIdentifier",
                "service_id": service_id,
                "service_name": service_name,
                "service_status": service_status,
                "root_cause": root_cause,
                "confidence": confidence,
                "critical_metrics_count": len(critical_metrics),
                "critical_metrics": critical_metrics,
                "recent_errors": recent_errors[:3] if recent_errors else []
            }
            self.status = f"Root cause analysis completed for {service_name}"
            return Message(text=json.dumps(json_response), sender="RootCauseIdentifier")
            
        except Exception as e:
            error_message = f"❌ Error identifying root cause: {str(e)}"
            self.status = error_message
            return Message(text=error_message, sender="RootCauseIdentifier")