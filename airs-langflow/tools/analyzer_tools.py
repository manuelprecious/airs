from .base_tools import backend_client
from typing import Dict, Any

def analyze_service_logs(service_id: str) -> Dict[str, Any]:
    """
    AT1: Analyze service logs to identify patterns
    """
    result = backend_client.make_request(f"/services/{service_id}/logs/analysis")
    
    if "error" in result:
        return {"error": result["error"]}
    
    return {
        "service_id": service_id,
        "recent_errors": result.get("recent_errors", []),
        "patterns": result.get("patterns", []),
        "suggested_actions": result.get("suggested_actions", []),
        "root_cause": result.get("root_cause", "unknown")
    }

def identify_root_cause(service_id: str, log_analysis: Dict[str, Any]) -> Dict[str, Any]:
    """
    AT2: Identify root cause from analysis
    """
    patterns = log_analysis.get("patterns", [])
    
    # Enhanced root cause mapping
    root_cause_mapping = {
        "high_cpu_usage": "CPU exhaustion due to high load or inefficient code",
        "memory_leak": "Memory leak in application causing gradual degradation", 
        "database_connection_issues": "Database connection pool exhaustion or slow queries",
        "high_latency": "Network latency or upstream service degradation"
    }
    
    root_cause = "unknown"
    for pattern in patterns:
        if pattern in root_cause_mapping:
            root_cause = root_cause_mapping[pattern]
            break
    
    return {
        "service_id": service_id,
        "identified_root_cause": root_cause,
        "confidence": "high" if root_cause != "unknown" else "low",
        "supporting_patterns": patterns
    }

def recommend_actions(service_id: str, root_cause: str) -> Dict[str, Any]:
    """
    AT3: Recommend specific remediation actions
    """
    action_recommendations = {
        "CPU exhaustion due to high load or inefficient code": {
            "primary_action": "restart_service",
            "secondary_actions": ["scale_instances", "clear_cache"],
            "reasoning": "Restart to clear stuck processes and scale for load"
        },
        "Memory leak in application causing gradual degradation": {
            "primary_action": "restart_service", 
            "secondary_actions": ["scale_memory"],
            "reasoning": "Restart to free leaked memory and increase allocation"
        },
        "Database connection pool exhaustion or slow queries": {
            "primary_action": "restart_service",
            "secondary_actions": ["kill_connections"],
            "reasoning": "Restart to reset connection pool and kill stale connections"
        },
        "Network latency or upstream service degradation": {
            "primary_action": "scale_instances",
            "secondary_actions": ["clear_cache"],
            "reasoning": "Scale to distribute load and clear cached bad responses"
        }
    }
    
    recommendation = action_recommendations.get(root_cause, {
        "primary_action": "restart_service",
        "secondary_actions": [],
        "reasoning": "Default action for unknown root cause"
    })
    
    return {
        "service_id": service_id,
        "recommended_actions": recommendation,
        "action_plan": {
            "primary_action": recommendation["primary_action"],
            "fallback_actions": recommendation["secondary_actions"],
            "expected_duration": "2-5 minutes",
            "success_probability": 0.85
        }
    }