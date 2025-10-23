# diagnostic_tools/log_analyzer.py
from typing import Any
import requests
import re
import json
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
        self.backend_url = "http://localhost:5000"
        self.timeout = 10

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
        try:
            url = f"{self.backend_url}/api{endpoint}"
            response = requests.get(url, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.ConnectionError:
            raise ConnectionError(f"Cannot connect to backend at {self.backend_url}")
        except requests.exceptions.Timeout:
            raise TimeoutError(f"Backend request timed out after {self.timeout} seconds")
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Service not found: {endpoint}")
            raise Exception(f"Backend returned error: {e.response.status_code}")
        except Exception as e:
            raise Exception(f"Unexpected error calling backend: {str(e)}")

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
                raise ValueError("Expected analysis data as dictionary")
            
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