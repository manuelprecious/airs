# diagnostic_tools/log_analyzer.py
from typing import Any
import requests
import re
import json
from urllib.parse import urlparse
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema import Message


class LogAnalyzer(Component):
    display_name = "Log Analyzer"
    description = "Analyze service logs to identify error patterns. Use when diagnosing service issues."
    icon = "file-text"
    name = "LogAnalyzer"

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
            info="Service ID or name to analyze logs for",
            tool_mode=True,
            value="Analyze logs for service S1"
        )
    ]

    outputs = [
        Output(
            display_name="Log Analysis",
            name="log_analysis",
            method="get_log_analysis"
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

    def get_log_analysis(self) -> Message:
        """Get log analysis as a tool response"""
        try:
            user_input = getattr(self, 'service_input', '').strip()
            if not user_input:
                raise ValueError("Please specify which service to analyze")
            
            service_id = self._extract_service_id(user_input)
            
            # Get log analysis from backend
            analysis_data = self._make_api_call(f"/services/{service_id}/logs/analysis")
            
            if not isinstance(analysis_data, dict):
                raise ValueError("Invalid response format from backend")
            
            # Get service details for context
            service_data = self._make_api_call(f"/services/{service_id}/metrics")
            service_name = service_data.get('name', 'Unknown Service') if isinstance(service_data, dict) else 'Unknown Service'
            
            # Create JSON response directly
            json_response = {
                "component": "LogAnalyzer",
                "service_id": service_id,
                "service_name": service_name,
                "root_cause": analysis_data.get('root_cause', 'unknown'),
                "patterns": analysis_data.get('patterns', []),
                "suggested_actions": analysis_data.get('suggested_actions', [])[:3],
                "recent_errors": analysis_data.get('recent_errors', [])[:5]
            }
            self.status = f"Log analysis completed for {service_name}"
            return Message(text=json.dumps(json_response), sender="LogAnalyzer")
            
        except Exception as e:
            error_message = f"❌ Error analyzing logs: {str(e)}"
            self.status = error_message
            return Message(text=error_message, sender="LogAnalyzer")