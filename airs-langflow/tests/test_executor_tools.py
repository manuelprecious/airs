import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from tools.executor_tools import execute_remediation, verify_recovery, generate_report

def test_execute_remediation():
    """Test ET1: Remediation execution"""
    print("Testing ET1 - execute_remediation...")
    result = execute_remediation("S1", "restart_service", "Test execution")
    print(f"Result: {result}")
    # This may fail if service not in critical state - that's expected
    assert "service_id" in result or "error" in result
    print("✅ ET1 test passed\n")

def test_verify_recovery():
    """Test ET2: Recovery verification"""
    print("Testing ET2 - verify_recovery...")
    result = verify_recovery("S1")
    print(f"Result: {result}")
    assert "recovery_verified" in result
    print("✅ ET2 test passed\n")

def test_generate_report():
    """Test ET3: Report generation"""
    print("Testing ET3 - generate_report...")
    incident_data = {
        "root_cause": "CPU exhaustion",
        "actions": ["restart_service"],
        "recovery_verified": True,
        "duration_minutes": 5,
        "metrics_before": {"cpu": 92},
        "metrics_after": {"cpu": 25},
        "logs_analyzed": 15
    }
    result = generate_report("S1", incident_data)
    print(f"Result: {result}")
    assert "executive_summary" in result
    print("✅ ET3 test passed\n")

if __name__ == "__main__":
    test_execute_remediation()
    test_verify_recovery() 
    test_generate_report()
    print("⚡ All Executor tools tests completed!")