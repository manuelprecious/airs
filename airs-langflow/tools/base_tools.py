import requests
import os
from typing import Dict, Any, Optional


class BackendClient:
    def __init__(self):
        self.base_url = os.getenv("BACKEND_URL", "http://localhost:5000")

    def make_request(
        self, endpoint: str, method: str = "GET", data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/api{endpoint}"
        try:
            if method.upper() == "GET":
                response = requests.get(url, timeout=10)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {"error": f"Backend request failed: {str(e)}"}
        except Exception as e:
            return {"error": f"Unexpected error: {str(e)}"}


backend_client = BackendClient()
