# remediation_tools/execute_remediation.py
from typing import Any, Optional
import requests
import re
import json
from urllib.parse import urlparse
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema import Message


class ExecuteRemediation(Component):
    display_name = "Execute Remediation"
    description = "Execute remediation actions on services. Use when you've decided on a fix."
    icon = "play"
    name = "ExecuteRemediation"

    inputs = [
        MessageTextInput(
            name="backend_url",
            display_name="Backend API URL",
            info="Base URL for AIRS backend API (e.g., http://localhost:5000)",
            value="http://localhost:5000",
        ),
        MessageTextInput(
            name="remediation_command",
            display_name="Remediation Command",
            info="Action to execute and service (e.g., 'restart service S1', 'scale instances for Payment Gateway')",
            tool_mode=True,
            value="restart service S1"
        )
    ]

    outputs = [
        Output(
            display_name="Remediation Result",
            name="remediation_result",
            method="execute_remediation_action"
        )
    ]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.timeout = 30  # Longer timeout for remediation actions

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

    def _parse_remediation_command(self, user_input: str) -> tuple[str, str, str]:
        """Parse remediation command to extract service ID, action, and reason"""
        user_input_lower = user_input.lower()
        
        # Extract service ID
        service_id_match = re.search(r'\b(S[1-9]\d*)\b', user_input.upper())
        if service_id_match:
            service_id = service_id_match.group(1)
        else:
            service_mapping = {
                'payment': 'S1',
                'auth': 'S2',
                'inventory': 'S3',
                'reporting': 'S4', 
                'search': 'S5',
                'log': 'S6'
            }
            service_id = "S1"
            for key, sid in service_mapping.items():
                if key in user_input_lower:
                    service_id = sid
                    break
        
        # Extract action
        action_mapping = {
            'restart': 'restart_service',
            'scale instance': 'scale_instances',
            'scale memory': 'scale_memory',
            'clear cache': 'clear_cache',
            'kill connection': 'kill_connections'
        }
        
        action = 'restart_service'  # default
        for key, action_key in action_mapping.items():
            if key in user_input_lower:
                action = action_key
                break
        
        # Generate reason from command
        reason = f"AI-initiated remediation: {user_input}"
        
        return service_id, action, reason

    def _make_api_call(self, endpoint: str, method: str = "GET", data: Optional[dict] = None) -> Any:
        """Make API call to backend with error handling"""
        # Validate URL first
        backend_url = self._validate_backend_url(self.backend_url)
        url = f"{backend_url}/api{endpoint}"
        
        try:
            if method.upper() == "POST":
                # For POST requests, data should not be None
                if data is None:
                    data = {}
                response = requests.post(url, json=data, timeout=self.timeout)
            else:
                response = requests.get(url, timeout=self.timeout)
                
            response.raise_for_status()
            return response.json()
        except requests.exceptions.ConnectionError:
            # Sanitized error message - no URL exposure
            raise ConnectionError("Cannot connect to AIRS backend service")
        except requests.exceptions.Timeout:
            raise TimeoutError(f"Backend request timed out after {self.timeout} seconds")
        except requests.exceptions.HTTPError as e:
            # Sanitized error messages
            if e.response.status_code == 404:
                raise ValueError("Service not found")
            elif e.response.status_code == 409:
                # Try to get error message from response, but sanitize it
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get('error', 'Remediation conflict')
                    raise Exception(f"Remediation conflict: {error_msg}")
                except:
                    raise Exception("Remediation conflict: Another operation is in progress")
            raise Exception(f"Backend returned error: {e.response.status_code}")
        except Exception as e:
            # Generic error without backend details
            raise Exception(f"Error communicating with backend service")

    def execute_remediation_action(self) -> Message:
        """Execute remediation action and return result"""
        try:
            user_input = getattr(self, 'remediation_command', '').strip()
            if not user_input:
                raise ValueError("Please specify the remediation action to execute")
            
            # Parse the command
            service_id, action, reason = self._parse_remediation_command(user_input)
            
            # First, check if service exists and is in a state that allows remediation
            service_data = self._make_api_call(f"/services/{service_id}/metrics")
            service_name = service_data.get('name', 'Unknown Service')
            service_status = service_data.get('status', 'unknown')
            
            # Check if service is in a state that allows remediation
            if service_status != 'critical' and not service_data.get('awaitingRemediation', False):
                raise Exception(f"Service {service_name} is not in a critical state and does not require remediation")
            
            if service_data.get('remediationInProgress', False):
                raise Exception(f"Remediation already in progress for {service_name}")
            
            # Execute the remediation action
            remediation_data = {
                "action": action,
                "reason": reason
            }
            
            result = self._make_api_call(
                f"/services/{service_id}/remediate", 
                method="POST", 
                data=remediation_data
            )
            
            # Create JSON response
            json_response = {
                "component": "ExecuteRemediation",
                "service_id": service_id,
                "service_name": service_name,
                "service_status": service_status,
                "action": action,
                "action_display_name": action.replace('_', ' ').title(),
                "reason": reason,
                "status": "initiated",
                "estimated_completion_ms": result.get('estimated_completion', 5000) if isinstance(result, dict) else 5000,
                "success_probability": result.get('success_probability', 0.8) if isinstance(result, dict) else 0.8,
                "backend_message": result.get('message', 'Remediation initiated') if isinstance(result, dict) else 'Remediation initiated',
                "remediation_in_progress": True
            }

            self.status = f"Remediation action '{action}' initiated for {service_name}"
            return Message(text=json.dumps(json_response), sender="ExecuteRemediation")
            
        except Exception as e:
            error_message = f"❌ Error executing remediation action: {str(e)}"
            self.status = error_message
            return Message(text=error_message, sender="ExecuteRemediation")