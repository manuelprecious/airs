# remediation_tools/recommend_actions.py
from typing import Any
import requests
import re
import json
from urllib.parse import urlparse
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema import Message


class RecommendActions(Component):
    display_name = "Recommend Actions"
    description = "Recommend remediation actions based on root cause analysis. Use before executing fixes."
    icon = "lightbulb"
    name = "RecommendActions"

    inputs = [
        MessageTextInput(
            name="backend_url",
            display_name="Backend API URL",
            info="Base URL for AIRS backend API (e.g., http://localhost:5000)",
            value="http://localhost:5000",
        ),
        MessageTextInput(
            name="service_input",
            display_name="Service and Context",
            info="Service ID or name and root cause context for action recommendations",
            tool_mode=True,
            value="Recommend actions for service S1 with high CPU usage",
        )
    ]

    outputs = [
        Output(
            display_name="Action Recommendations",
            name="action_recommendations",
            method="get_action_recommendations",
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
        input_upper = user_input.upper()

        service_id_match = re.search(r"\b(S[1-9]\d*)\b", input_upper)
        if service_id_match:
            return service_id_match.group(1)

        service_mapping = {
            "PAYMENT": "S1",
            "AUTH": "S2",
            "INVENTORY": "S3",
            "REPORTING": "S4",
            "SEARCH": "S5",
            "LOG": "S6",
        }

        for key, service_id in service_mapping.items():
            if key in input_upper:
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
            raise TimeoutError(
                f"Backend request timed out after {self.timeout} seconds"
            )
        except requests.exceptions.HTTPError as e:
            # Sanitized - only status code, no URL
            if e.response.status_code == 404:
                raise ValueError("Service not found")
            raise Exception(f"Backend returned error: {e.response.status_code}")
        except Exception as e:
            # Generic error without backend details
            raise Exception(f"Error communicating with backend service")

    def _get_remediation_config(self) -> dict[str, Any]:
        """Get remediation configuration from backend"""
        try:
            # In a real implementation, this would come from the backend
            # For now, we'll use a static configuration
            return {
                "restart_service": {
                    "time": 4000,
                    "successProbability": 0.9,
                    "description": "Restart the service instance",
                },
                "scale_instances": {
                    "time": 6000,
                    "successProbability": 0.8,
                    "description": "Scale out by adding more instances",
                },
                "scale_memory": {
                    "time": 5000,
                    "successProbability": 0.85,
                    "description": "Increase memory allocation",
                },
                "clear_cache": {
                    "time": 3000,
                    "successProbability": 0.7,
                    "description": "Clear application cache",
                },
                "kill_connections": {
                    "time": 3500,
                    "successProbability": 0.75,
                    "description": "Terminate stale database connections",
                },
            }
        except Exception as e:
            raise Exception(f"Failed to get remediation configuration")

    def _recommend_actions_by_root_cause(
        self, root_cause: str, service_data: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Recommend actions based on root cause analysis"""
        remediation_config = self._get_remediation_config()

        # Map root causes to recommended actions
        root_cause_actions = {
            "high_cpu_load": ["restart_service", "scale_instances", "clear_cache"],
            "memory_exhaustion": ["restart_service", "scale_memory", "scale_instances"],
            "database_bottleneck": [
                "kill_connections",
                "restart_service",
                "scale_instances",
            ],
            "network_latency": ["scale_instances", "restart_service"],
            "general_performance_issue": [
                "restart_service",
                "scale_instances",
                "clear_cache",
            ],
        }

        # Get recommended action keys
        action_keys = root_cause_actions.get(
            root_cause, ["restart_service", "scale_instances"]
        )

        # Build action recommendations with details
        recommendations = []
        for action_key in action_keys:
            if action_key in remediation_config:
                config = remediation_config[action_key]
                recommendations.append(
                    {
                        "action": action_key,
                        "display_name": action_key.replace("_", " ").title(),
                        "description": config.get(
                            "description", "No description available"
                        ),
                        "estimated_time_seconds": config.get("time", 5000) / 1000,
                        "success_probability": config.get("successProbability", 0.5),
                        "risk_level": (
                            "low"
                            if config.get("successProbability", 0) > 0.8
                            else "medium"
                        ),
                    }
                )

        # Sort by success probability (highest first)
        recommendations.sort(key=lambda x: x["success_probability"], reverse=True)
        return recommendations

    def get_action_recommendations(self) -> Message:
        """Get recommended remediation actions as a tool response"""
        try:
            user_input = getattr(self, "service_input", "").strip()
            if not user_input:
                raise ValueError(
                    "Please specify the service and context for action recommendations"
                )

            service_id = self._extract_service_id(user_input)

            # Get service health and log analysis to determine root cause
            health_data = self._make_api_call(f"/services/{service_id}/metrics")
            log_analysis = self._make_api_call(f"/services/{service_id}/logs/analysis")

            if not isinstance(health_data, dict) or not isinstance(log_analysis, dict):
                raise ValueError("Invalid response format from backend")

            service_name = health_data.get("name", "Unknown Service")
            service_status = health_data.get("status", "unknown")
            root_cause = log_analysis.get("root_cause", "general_performance_issue")

            # Get recommended actions
            recommendations = self._recommend_actions_by_root_cause(
                root_cause, health_data
            )

            # Create JSON response
            json_response = {
                "component": "RecommendActions",
                "service_id": service_id,
                "service_name": service_name,
                "service_status": service_status,
                "root_cause": root_cause,
                "root_cause_display": root_cause.replace("_", " ").title(),
                "recommendations": recommendations,
                "total_recommendations": len(recommendations),
            }

            self.status = f"Generated {len(recommendations)} action recommendations for {service_name}"
            return Message(text=json.dumps(json_response), sender="RecommendActions")

        except Exception as e:
            error_message = f"❌ Error generating action recommendations: {str(e)}"
            self.status = error_message
            return Message(text=error_message, sender="RecommendActions")