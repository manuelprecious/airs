from .base_tools import backend_client
from typing import Dict, Any


def get_service_health_status() -> Dict[str, Any]:
    """
    OT1: Get health status of all services
    """
    result = backend_client.make_request("/services")

    if "error" in result:
        return {"error": result["error"]}

    services = []
    for service in result:
        services.append(
            {
                "id": service["id"],
                "name": service["name"],
                "status": service["status"].upper(),
                "remediationInProgress": service.get("remediationInProgress", False),
                "awaitingRemediation": service.get("awaitingRemediation", False),
            }
        )

    return {
        "services": services,
        "total_services": len(services),
        "critical_services": len([s for s in services if s["status"] == "CRITICAL"]),
        "healthy_services": len([s for s in services if s["status"] == "HEALTHY"]),
    }


def airs_analyzer_tool(service_id: str, issue_description: str) -> Dict[str, Any]:
    """
    OT2: Trigger AIRS Analyzer agent for diagnosis
    This will be connected to the Analyzer Agent in Langflow
    """
    return {
        "action": "trigger_analyzer",
        "service_id": service_id,
        "issue_description": issue_description,
        "timestamp": "analyzer_triggered",
        "next_agent": "AIRS_Analyzer",
    }


def airs_executor_tool(service_id: str, action_plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    OT3: Trigger AIRS Executor agent for remediation
    This will be connected to the Executor Agent in Langflow
    """
    return {
        "action": "trigger_executor",
        "service_id": service_id,
        "action_plan": action_plan,
        "timestamp": "executor_triggered",
        "next_agent": "AIRS_Executor",
    }
