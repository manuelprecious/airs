# diagnostic_tools/service_lister.py
from typing import Any
import requests
import json
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
        self.backend_url = "http://localhost:5000"
        self.timeout = 10

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
            raise TimeoutError(
                f"Backend request timed out after {self.timeout} seconds"
            )
        except requests.exceptions.HTTPError as e:
            raise Exception(f"Backend returned error: {e.response.status_code}")
        except Exception as e:
            raise Exception(f"Unexpected error calling backend: {str(e)}")

    def get_services_overview(self) -> Message:
        """Get formatted overview of all services as a tool response"""
        try:
            services_data = self._make_api_call("/services")

            if not isinstance(services_data, list):
                raise ValueError("Expected list of services from backend")

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