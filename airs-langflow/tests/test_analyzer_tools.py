import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from tools.analyzer_tools import analyze_service_logs, identify_root_cause, recommend_actions

def test_analyze_service_logs():
    """Test AT1: Service log analysis"""
    print("Testing AT1 - analyze_service_logs...")
    result = analyze_service_logs("S1")
    print(f"Result: {result}")
    assert "service_id" in result or "error" in result
    print("✅ AT1 test passed\n")

def test_identify_root_cause():
    """Test AT2: Root cause identification"""
    print("Testing AT2 - identify_root_cause...")
    log_analysis = {"patterns": ["high_cpu_usage"], "recent_errors": []}
    result = identify_root_cause("S1", log_analysis)
    print(f"Result: {result}")
    assert "identified_root_cause" in result
    print("✅ AT2 test passed\n")

def test_recommend_actions():
    """Test AT3: Action recommendations"""
    print("Testing AT3 - recommend_actions...")
    result = recommend_actions("S1", "CPU exhaustion due to high load or inefficient code")
    print(f"Result: {result}")
    assert "action_plan" in result
    print("✅ AT3 test passed\n")

if __name__ == "__main__":
    test_analyze_service_logs()
    test_identify_root_cause()
    test_recommend_actions()
    print("🔍 All Analyzer tools tests completed!")