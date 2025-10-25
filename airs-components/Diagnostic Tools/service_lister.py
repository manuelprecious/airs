# diagnostic_tools/service_lister.py
from typing import Any
import requests
import json
import re
from urllib.parse import urlparse
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema import Message


class ServiceLister(Component):
    display_name = "Service Lister"
    description = "Get overview of all services and their status. Use when you need to know the current system state."
    icon = "server"
    name = "ServiceLister"

    inputs = [
        MessageTextInput(
            name="backend_url",
            display_name="Backend API URL",
            info="Base URL for AIRS backend API (e.g., http://localhost:5000)",
            value="http://localhost:5000",
        ),
        MessageTextInput(
            name="query",
            display_name="User Query",
            info="Natural language query about system status",
            tool_mode=True,
            value="List all services and their status",
        )
    ]

    outputs = [
        Output(
            display_name="Services Overview",
            name="services_overview",
            method="get_services_overview",
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
                raise ValueError("Requested resource not found")
            raise Exception(f"Backend returned error: {e.response.status_code}")
        except Exception as e:
            # Generic error without backend details
            raise Exception(f"Error communicating with backend service")

    def get_services_overview(self) -> Message:
        """Get formatted overview of all services as a tool response"""
        try:
            services_data = self._make_api_call("/services")

            if not isinstance(services_data, list):
                raise ValueError("Invalid response format from backend")

            # Calculate statistics
            total_services = len(services_data)
            healthy_count = sum(
                1 for s in services_data if s.get("status") == "healthy"
            )
            warning_count = sum(
                1 for s in services_data if s.get("status") == "warning"
            )
            critical_count = sum(
                1 for s in services_data if s.get("status") == "critical"
            )

            # Format services for JSON response
            formatted_services = []
            for service in services_data:
                service_info = {
                    "id": service.get("id", "Unknown"),
                    "name": service.get("name", "Unknown"),
                    "status": service.get("status", "unknown"),
                    "remediation_in_progress": service.get("remediationInProgress", False),
                    "awaiting_remediation": service.get("awaitingRemediation", False)
                }
                formatted_services.append(service_info)

            # Create JSON response
            json_response = {
                "component": "ServiceLister",
                "summary": {
                    "total_services": total_services,
                    "healthy_count": healthy_count,
                    "warning_count": warning_count,
                    "critical_count": critical_count
                },
                "services": formatted_services
            }

            self.status = f"Found {total_services} services - {healthy_count} healthy, {critical_count} critical"
            return Message(text=json.dumps(json_response), sender="ServiceLister")

        except Exception as e:
            error_message = f"❌ Error getting service list: {str(e)}"
            self.status = error_message
            return Message(text=error_message, sender="ServiceLister")