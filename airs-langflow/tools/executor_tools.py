from .base_tools import backend_client
import time
from typing import Dict, Any

def execute_remediation(service_id: str, action: str, reason: str) -> Dict[str, Any]:
    """
    ET1: Execute the remediation action
    """
    data = {
        "action": action,
        "reason": reason
    }
    
    result = backend_client.make_request(f"/services/{service_id}/remediate", "POST", data)
    
    if "error" in result:
        return {"error": result["error"]}
    
    return {
        "service_id": service_id,
        "action_executed": action,
        "execution_result": result,
        "status": "remediation_initiated",
        "estimated_completion_ms": result.get("estimated_completion", 4000)
    }

def verify_recovery(service_id: str) -> Dict[str, Any]:
    """
    ET2: Verify service has recovered after remediation
    """
    max_retries = 8
    for attempt in range(max_retries):
        result = backend_client.make_request(f"/services/{service_id}/metrics")
        
        if "error" in result:
            return {"error": result["error"]}
        
        status = result.get("status", "unknown")
        metrics = result.get("metrics", {})
        
        if status == "healthy":
            return {
                "service_id": service_id,
                "recovery_verified": True,
                "final_status": status,
                "final_metrics": metrics,
                "verification_attempts": attempt + 1,
                "message": "✅ Service fully recovered and healthy"
            }
        
        time.sleep(2)  # Wait 2 seconds between checks
    
    return {
        "service_id": service_id,
        "recovery_verified": False,
        "final_status": result.get("status", "unknown"),
        "final_metrics": result.get("metrics", {}),
        "verification_attempts": max_retries,
        "message": "❌ Service did not recover within expected time"
    }

def generate_report(service_id: str, incident_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    ET3: Generate comprehensive incident report
    """
    report_id = f"INCIDENT-{service_id}-{int(time.time())}"
    
    report = {
        "report_id": report_id,
        "service_affected": service_id,
        "incident_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "resolution_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "summary": {
            "root_cause": incident_data.get("root_cause", "unknown"),
            "actions_performed": incident_data.get("actions", []),
            "recovery_status": "SUCCESS" if incident_data.get("recovery_verified") else "FAILED",
            "total_duration_minutes": incident_data.get("duration_minutes", 5)
        },
        "technical_details": {
            "metrics_before": incident_data.get("metrics_before", {}),
            "metrics_after": incident_data.get("metrics_after", {}),
            "logs_analyzed": incident_data.get("logs_analyzed", 0),
            "remediation_agent": "AIRS_Orchestrator"
        },
        "recommendations": [
            "Monitor service metrics for next 24 hours",
            "Review capacity planning for peak loads",
            "Update runbook with this incident pattern"
        ]
    }
    
    return {
        "service_id": service_id,
        "report": report,
        "executive_summary": f"""
🏥 INCIDENT REPORT: {service_id}
===============================
📅 Incident Time: {report['incident_timestamp']}
🔍 Root Cause: {report['summary']['root_cause']}
🛠️ Actions: {', '.join(report['summary']['actions_performed'])}
✅ Status: {report['summary']['recovery_status']}
⏱️ Duration: {report['summary']['total_duration_minutes']} minutes
📋 Report ID: {report_id}
        """
    }