# diagnostic_tools/root_cause_identifier.py
from typing import Any
import requests
import re
import json
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
                raise ValueError("Expected health and log data as dictionaries")
            
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