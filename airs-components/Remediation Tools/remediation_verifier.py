# remediation_tools/remediation_verifier.py
from typing import Any
import requests
import re
import json
from urllib.parse import urlparse
from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema import Message


class RemediationVerifier(Component):
    display_name = "Remediation Verifier"
    description = "Verify that remediation actions were successful. Use after executing fixes."
    icon = "check-circle"
    name = "RemediationVerifier"

    inputs = [
        MessageTextInput(
            name="backend_url",
            display_name="Backend API URL",
            info="Base URL for AIRS backend API (e.g., http://localhost:5000)",
            value="http://localhost:5000",
        ),
        MessageTextInput(
            name="verification_request",
            display_name="Verification Request",
            info="Service to verify remediation success for (e.g., 'verify S1 recovery', 'check if Payment Gateway is healthy')",
            tool_mode=True,
            value="Verify remediation for service S1"
        )
    ]

    outputs = [
        Output(
            display_name="Verification Result",
            name="verification_result",
            method="verify_remediation_success"
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
        
        service_id_match = re.search(r'\b(S[1-9]\d*)\b', input_upper)
        if service_id_match:
            return service_id_match.group(1)
        
        service_mapping = {
            'PAYMENT': 'S1',
            'AUTH': 'S2',
            'INVENTORY': 'S3',
            'REPORTING': 'S4',
            'SEARCH': 'S5',
            'LOG': 'S6'
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
            raise TimeoutError(f"Backend request timed out after {self.timeout} seconds")
        except requests.exceptions.HTTPError as e:
            # Sanitized - only status code, no URL
            if e.response.status_code == 404:
                raise ValueError("Service not found")
            raise Exception(f"Backend returned error: {e.response.status_code}")
        except Exception as e:
            # Generic error without backend details
            raise Exception(f"Error communicating with backend service")

    def _assess_remediation_success(self, service_data: dict[str, Any]) -> dict[str, Any]:
        """Assess whether remediation was successful based on service state and metrics"""
        metrics = service_data.get('metrics', {})
        service_status = service_data.get('status', 'unknown')
        
        # Check critical metrics against thresholds
        healthy_metrics = 0
        total_metrics = 0
        
        metric_thresholds = {
            'cpu': 70,  # Below 70% is healthy
            'memory': 75,  # Below 75% is healthy  
            'latency': 300,  # Below 300ms is healthy
            'error_rate': 5  # Below 5% is healthy
        }
        
        for metric, threshold in metric_thresholds.items():
            if metric in metrics:
                total_metrics += 1
                if metrics[metric] < threshold:
                    healthy_metrics += 1
        
        # Calculate health score
        health_score = (healthy_metrics / total_metrics) * 100 if total_metrics > 0 else 0
        
        # Determine overall success
        if service_status == 'healthy' and health_score >= 75:
            success = True
            confidence = "high"
        elif service_status == 'healthy' and health_score >= 50:
            success = True  
            confidence = "medium"
        elif service_status == 'warning' and health_score >= 50:
            success = "partial"
            confidence = "medium"
        else:
            success = False
            confidence = "high"
        
        return {
            'success': success,
            'confidence': confidence,
            'health_score': health_score,
            'service_status': service_status,
            'healthy_metrics': healthy_metrics,
            'total_metrics': total_metrics
        }

    def _assess_metric_status(self, metric_name: str, value: float) -> str:
        """Assess individual metric status"""
        thresholds = {
            'cpu': {'warn': 70, 'crit': 85},
            'memory': {'warn': 75, 'crit': 90},
            'latency': {'warn': 300, 'crit': 500},
            'error_rate': {'warn': 5, 'crit': 10}
        }
        
        if metric_name in thresholds:
            threshold = thresholds[metric_name]
            if value >= threshold['crit']:
                return "critical"
            elif value >= threshold['warn']:
                return "warning"
            else:
                return "healthy"
        return "unknown"

    def verify_remediation_success(self) -> Message:
        """Verify remediation success and return result"""
        try:
            user_input = getattr(self, 'verification_request', '').strip()
            if not user_input:
                raise ValueError("Please specify which service to verify")
            
            service_id = self._extract_service_id(user_input)
            
            # Get current service state
            service_data = self._make_api_call(f"/services/{service_id}/metrics")
            
            if not isinstance(service_data, dict):
                raise ValueError("Invalid response format from backend")
            
            service_name = service_data.get('name', 'Unknown Service')
            
            # Assess remediation success
            verification_result = self._assess_remediation_success(service_data)
            
            # Format metrics for JSON response
            metrics = service_data.get('metrics', {})
            formatted_metrics = []
            metric_display = {
                'cpu': ('CPU Usage', '%'),
                'memory': ('Memory Usage', '%'), 
                'latency': ('Latency', 'ms'),
                'error_rate': ('Error Rate', '%'),
                'throughput': ('Throughput', 'req/s')
            }
            
            for metric_key, (display_name, unit) in metric_display.items():
                if metric_key in metrics:
                    value = metrics[metric_key]
                    status = self._assess_metric_status(metric_key, value)
                    formatted_metrics.append({
                        "name": metric_key,
                        "display_name": display_name,
                        "value": value,
                        "unit": unit,
                        "status": status
                    })
            
            # Create JSON response
            json_response = {
                "component": "RemediationVerifier",
                "service_id": service_id,
                "service_name": service_name,
                "remediation_success": verification_result['success'],
                "confidence": verification_result['confidence'],
                "health_score": verification_result['health_score'],
                "service_status": verification_result['service_status'],
                "healthy_metrics": verification_result['healthy_metrics'],
                "total_metrics": verification_result['total_metrics'],
                "remediation_in_progress": service_data.get('remediationInProgress', False),
                "awaiting_remediation": service_data.get('awaitingRemediation', False),
                "metrics": formatted_metrics
            }

            self.status = f"Verification completed for {service_name}: {verification_result['success']}"
            return Message(text=json.dumps(json_response), sender="RemediationVerifier")
            
        except Exception as e:
            error_message = f"❌ Error verifying remediation: {str(e)}"
            self.status = error_message
            return Message(text=error_message, sender="RemediationVerifier")