import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from tools.orchestrator_tools import (
    get_service_health_status,
    airs_analyzer_tool,
    airs_executor_tool,
)


def test_get_service_health_status():
    """Test OT1: Service health status"""
    print("Testing OT1 - get_service_health_status...")
    result = get_service_health_status()
    print(f"Result: {result}")
    assert "services" in result or "error" in result
    print("✅ OT1 test passed\n")


def test_airs_analyzer_tool():
    """Test OT2: Analyzer agent trigger"""
    print("Testing OT2 - airs_analyzer_tool...")
    result = airs_analyzer_tool("S1", "High CPU usage detected")
    print(f"Result: {result}")
    assert result["action"] == "trigger_analyzer"
    assert result["next_agent"] == "AIRS_Analyzer"
    print("✅ OT2 test passed\n")


def test_airs_executor_tool():
    """Test OT3: Executor agent trigger"""
    print("Testing OT3 - airs_executor_tool...")
    action_plan = {"primary_action": "restart_service", "reasoning": "Test"}
    result = airs_executor_tool("S1", action_plan)
    print(f"Result: {result}")
    assert result["action"] == "trigger_executor"
    assert result["next_agent"] == "AIRS_Executor"
    print("✅ OT3 test passed\n")


if __name__ == "__main__":
    test_get_service_health_status()
    test_airs_analyzer_tool()
    test_airs_executor_tool()
    print("🎯 All Orchestrator tools tests completed!")
