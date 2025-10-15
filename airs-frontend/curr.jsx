import React, { useState, useCallback, useMemo, useEffect } from "react";
// Assuming you have run: npm install lucide-react
import { 
    Zap, Clock, Activity, HardHat, Server, Terminal, RefreshCw, Power,
    LayoutDashboard, Users, Settings, LogOut, Search, Bell, User, Cpu
} from "lucide-react";

// --- CONFIGURATION CONSTANTS (Update these for your deployment) ---
const LANGFLOW_API_URL = 'http://localhost:7860/api/v1/run/';
const LANGFLOW_API_KEY = 'YOUR_LANGFLOW_API_KEY'; // Placeholder key

// Initial state for multiple services
const INITIAL_SERVICES = [
    { id: 'S1', name: 'Payment Gateway', status: 'HEALTHY', metric: 'CPU_Load', value: 35.0, history: Array(20).fill(35), alert_id: null },
    { id: 'S2', name: 'User Auth API', status: 'HEALTHY', metric: 'Memory_Use', value: 22.0, history: Array(20).fill(22), alert_id: null },
    { id: 'S3', name: 'Inventory Service', status: 'CRITICAL', metric: 'Latency_ms', value: 950, history: Array(20).fill(950), alert_id: 'INC-1245A' }, // Start one failing
];

// --- UTILITY HOOK: Simulates setInterval but with functional dependencies
const useInterval = (callback, delay) => {
    const savedCallback = React.useRef();

    // Remember the latest callback.
    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    // Set up the interval.
    useEffect(() => {
        function tick() {
            savedCallback.current();
        }
        if (delay !== null) {
            let id = setInterval(tick, delay);
            return () => clearInterval(id);
        }
    }, [delay]);
};

// --- CORE STATE MANAGEMENT ---

const App = () => {
    const [services, setServices] = useState(INITIAL_SERVICES);
    const [allLogs, setAllLogs] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastActionTime, setLastActionTime] = useState(null);

    // Filter services for the dashboard view
    const failingService = useMemo(() => services.find(s => s.status === 'CRITICAL'), [services]);

    // Helper to add timestamped, sourced log entries
    const addLog = useCallback((source, message, alertId = 'System') => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        const newLog = {
            timestamp,
            source,
            message,
            id: Date.now() + Math.random(),
            alertId,
        };
        // Keep the last 100 logs
        setAllLogs(prev => [...prev, newLog].slice(-100));
    }, []);

    // --- REAL-TIME DATA SIMULATION ---
    useInterval(() => {
        setServices(prevServices => prevServices.map(service => {
            let newValue;
            let newStatus = service.status;
            let newHistory = [...service.history];
            
            // 1. Simulate Fluctuation
            if (service.status === 'HEALTHY') {
                // Healthy: value fluctuates +/- 2 (max 60)
                const fluctuation = (Math.random() * 4) - 2;
                newValue = Math.max(15, Math.min(60, service.value + fluctuation));
                newValue = parseFloat(newValue.toFixed(1));

                // 2. Introduce Random Failure (1% chance if healthy and not currently processing)
                if (!isProcessing && Math.random() < 0.01 && service.name !== failingService?.name) {
                    addLog('System', `${service.name} status degraded. Simulating CRITICAL failure!`, `INC-${Math.floor(Math.random() * 9000) + 1000}B`);
                    newStatus = 'CRITICAL';
                    newValue = service.name === 'Inventory Service' ? 999 : 99.0; // Fail differently
                }

            } else {
                // Critical: value keeps rising/stays high
                const increase = service.name === 'Inventory Service' ? 50 : 0.5;
                newValue = Math.min(service.name === 'Inventory Service' ? 1000 : 99.9, service.value + increase);
                newValue = parseFloat(newValue.toFixed(1));

                // 3. Spontaneously recover if processing finished and it's not the initial failing service (S3)
                if (!isProcessing && service.id !== 'S3' && service.value < 100 && Math.random() < 0.05) {
                     addLog('System', `${service.name} metrics temporarily stabilized. Clearing alert.`, service.alert_id);
                     newStatus = 'HEALTHY';
                     newValue = 30.0;
                }
            }

            // Update history: push new value, discard oldest
            newHistory.push(newValue);
            newHistory = newHistory.slice(1);

            // Update alert ID if status changed to critical
            let newAlertId = service.alert_id;
            if (newStatus === 'CRITICAL' && !newAlertId) {
                 newAlertId = `INC-${Math.floor(Math.random() * 9000) + 1000}B`;
            } else if (newStatus === 'HEALTHY' && newAlertId) {
                newAlertId = null; // Clear ID on recovery
            }

            return {
                ...service,
                status: newStatus,
                value: newValue,
                history: newHistory,
                alert_id: newAlertId,
            };
        }));
    }, isProcessing ? 500 : 1500); // Poll faster when agent is running


    // --- API SIMULATION: REMEDIATION LOGIC (Autonomous Agent) ---
    // Defined BEFORE the useEffect that uses it in the dependency array
    const callLangflowAPI = async (serviceId) => {
        // Simulating Agent Triage/RCA/Action/Validation time
        const delay = 4000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const service = services.find(s => s.id === serviceId);

        if (!service) return;
        const alertId = service.alert_id;

        // 1. Triage & RCA
        addLog('Agent', `[Triage/RCA] Checking ${service.name} (Alert ${alertId}): Identified high ${service.metric}. Calculating optimal dynamic scaling action.`, alertId);
        await new Promise(r => setTimeout(r, 2000));
        
        // 2. Action
        addLog('Agent', `[Action] Invoking SCALE_UP Tool on Kubernetes cluster: ${service.name} replicas set to 5.`, alertId);
        await new Promise(r => setTimeout(r, 2500));
        
        // 3. Validation
        addLog('Agent', `[Validation] Checking health metrics post-action. Metrics are stabilizing...`, alertId);
        
        // Success criteria: Return success to trigger UI status update
        return { status: 'success' };
    };

    const handleRemediation = useCallback(async (serviceId) => {
        const service = services.find(s => s.id === serviceId);
        // Only run if service is critical and not already processing
        if (!service || service.status === 'HEALTHY' || isProcessing) return;
        
        setIsProcessing(true);
        setLastActionTime(Date.now());
        const alertId = service.alert_id;
        
        try {
            await callLangflowAPI(serviceId);

            // Success: Update UI state to Healthy
            setServices(prevServices => prevServices.map(s => {
                if (s.id === serviceId) {
                    // Set to a healthy, but perhaps elevated value post-remediation
                    const healthyValue = s.name === 'Inventory Service' ? 150 : 30.0;
                    return {
                        ...s,
                        status: 'HEALTHY',
                        value: healthyValue,
                        history: Array(20).fill(healthyValue),
                        alert_id: null,
                    };
                }
                return s;
            }));
            addLog('Agent', `[SUCCESS] ${service.name} recovered and metrics stabilized. Service is HEALTHY.`, alertId);

        } catch (error) {
            addLog('Agent', `[FAILURE] Remediation failed for ${service.name}: ${error.message}`, alertId);
        } finally {
            setIsProcessing(false);
        }
    }, [isProcessing, services, addLog]);


    // --- AUTONOMOUS TRIGGER ---
    // This useEffect now safely accesses handleRemediation defined above
    useEffect(() => {
        // If a service is critical and the agent is not currently busy, trigger remediation.
        if (failingService && !isProcessing) {
            addLog('System', `Critical alert detected for ${failingService.name} (Alert ${failingService.alert_id}). Initiating autonomous remediation sequence.`, failingService.alert_id);
            handleRemediation(failingService.id);
        }
    }, [failingService, isProcessing, handleRemediation, addLog]);


    // --- VISUAL COMPONENTS ---

    // Component 1: SVG Sparkline Graph
    const Sparkline = ({ history, isCritical, maxVal }) => {
        const width = 100;
        const height = 40;
        const strokeColor = isCritical ? '#ef4444' : '#10b981';
        const normalizedMax = maxVal > 100 ? maxVal : 100;

        // Convert data points to SVG coordinates
        const points = history.map((val, index) => {
            const x = (index / (history.length - 1)) * width;
            // Normalize value to 0-1 range based on its max possible value (or 100)
            const yNormalized = val / normalizedMax;
            // Map normalized value to SVG height (inverted for graph drawing)
            const y = height * (1 - yNormalized);
            return `${x},${y}`;
        }).join(" ");

        return (
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
                <polyline
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="2"
                    points={points}
                    className="sparkline-path"
                />
            </svg>
        );
    };


    // Component 2: Single Service Card
    const ServiceCard = ({ service, isProcessing, failingServiceId }) => {
        const isCritical = service.status === 'CRITICAL';
        const maxVal = service.name === 'Inventory Service' ? 1000 : 100;
        const colorClass = isCritical ? 'critical-card' : 'healthy-card';
        const isThisServiceFailing = service.id === failingServiceId;
        const showAgentStatus = isThisServiceFailing && isProcessing;

        return (
            <div className={`service-card ${colorClass}`}>
                <div className="flex-row justify-between mb-4">
                    <div className="flex-row align-center">
                        <Server className={`icon-medium mr-2 ${isCritical ? 'text-red-400' : 'text-green-400'}`} />
                        <h3 className="text-xl font-bold">{service.name}</h3>
                    </div>
                    <span className={`status-tag ${isCritical ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                        {service.status}
                    </span>
                </div>

                <div className="flex-row justify-between items-end mb-4">
                    <div className="flex-col">
                        <p className="text-gray-400 text-sm">{service.metric}</p>
                        <p className={`text-4xl font-extrabold ${isCritical ? 'text-red-300' : 'text-green-300'}`}>
                            {service.value}
                            <span className="text-lg font-normal ml-1">{service.metric.includes('Latency') ? 'ms' : '%'}</span>
                        </p>
                    </div>

                    <div className="w-24 h-10">
                        {/* Sparkline Graph */}
                        <Sparkline history={service.history} isCritical={isCritical} maxVal={maxVal} />
                    </div>
                </div>
                
                <div className="text-xs text-gray-500 mb-4 font-mono">
                    Alert ID: {service.alert_id || 'N/A'}
                </div>

                {showAgentStatus ? (
                    <div className="agent-status-bar bg-indigo-700">
                        <span className="flex-row align-center justify-center">
                            <RefreshCw className="icon-small mr-2 animate-spin" /> 
                            Agent Remediating...
                        </span>
                    </div>
                ) : (
                    <div className="agent-status-bar bg-gray-700">
                        <span className="text-gray-400">
                            {isCritical ? "Awaiting Agent Response (Auto-Triggered)" : "Service Operational"}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    // Component 3: Dashboard Header
    const DashboardHeader = () => (
        <header className="header">
            <div className="flex-row align-center">
                <Cpu className="icon-medium mr-3 text-indigo-400" />
                <h1 className="text-lg font-bold">Langflow AIRS Dashboard</h1>
            </div>
            
            <div className="flex-row align-center space-x-4">
                <div className="search-bar">
                    <Search className="icon-small text-gray-400 mr-2" />
                    <input type="text" placeholder="Search alerts or services..." className="search-input" />
                </div>
                <button className="icon-button"><Bell className="icon-medium" /></button>
                <div className="user-profile">
                    <User className="icon-medium" />
                </div>
            </div>
        </header>
    );

    // Component 4: Sidebar
    const Sidebar = () => (
        <nav className="sidebar">
            <div className="sidebar-menu">
                <a href="#" className="sidebar-item active">
                    <LayoutDashboard className="icon-medium mr-3" />
                    Dashboard
                </a>
                <a href="#" className="sidebar-item">
                    <Activity className="icon-medium mr-3" />
                    Log Analysis
                </a>
                <a href="#" className="sidebar-item">
                    <Users className="icon-medium mr-3" />
                    Teams
                </a>
                <a href="#" className="sidebar-item">
                    <Settings className="icon-medium mr-3" />
                    Configuration
                </a>
            </div>
            <div className="sidebar-footer">
                <a href="#" className="sidebar-item">
                    <LogOut className="icon-medium mr-3" />
                    Logout
                </a>
            </div>
        </nav>
    );

    // Component 5: Agent Action Timeline
    const AgentActionTimeline = () => {
        // Filter and reverse for chronological view (newest on top)
        const timelineLogs = useMemo(() => {
            return allLogs.filter(log => log.source === 'Agent' || log.source === 'System').reverse();
        }, [allLogs]);

        const getLogVisuals = (message, source) => {
            if (source === 'System') {
                if (message.includes('CRITICAL')) return { Icon: Zap, color: 'text-red-400', tag: 'CRITICAL ALERT' };
                if (message.includes('Initiating autonomous')) return { Icon: HardHat, color: 'text-indigo-400', tag: 'AUTO-TRIGGER' };
                return { Icon: Terminal, color: 'text-gray-400', tag: 'SYSTEM' };
            }
            if (message.includes('[SUCCESS]')) return { Icon: Activity, color: 'text-green-400', tag: 'SUCCESS' };
            if (message.includes('[Triage/RCA]')) return { Icon: Cpu, color: 'text-yellow-400', tag: 'TRIAGE' };
            if (message.includes('[Action]')) return { Icon: Power, color: 'text-blue-400', tag: 'ACTION' };
            if (message.includes('[Validation]')) return { Icon: Clock, color: 'text-cyan-400', tag: 'VALIDATION' };
            
            return { Icon: Terminal, color: 'text-gray-400', tag: 'LOG' };
        };

        return (
            <div className="timeline-container">
                <div className="flex-row justify-between align-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-100 flex-row align-center">
                        <Terminal className="icon-medium mr-2 text-indigo-400" />
                        Autonomous Action Timeline
                    </h2>
                    <p className="text-sm text-gray-500">{lastActionTime && `Last action: ${new Date(lastActionTime).toLocaleTimeString()}`}</p>
                </div>

                <div className="timeline-scroller">
                    {timelineLogs.length === 0 ? (
                        <p className="text-center text-gray-500 italic p-10">System is stable. Waiting for a critical alert to activate the autonomous agent...</p>
                    ) : (
                        timelineLogs.map(log => {
                            const { Icon, color, tag } = getLogVisuals(log.message, log.source);
                            return (
                                <div key={log.id} className="timeline-event">
                                    <div className={`timeline-dot ${color}`}>
                                        <Icon className="icon-small" />
                                    </div>
                                    <div className="timeline-content">
                                        <div className="flex-row justify-between align-center mb-1">
                                            <span className={`event-tag ${tag.toLowerCase().replace(/\s/g, '-')}`}>{tag}</span>
                                            <span className="text-xs text-gray-500 font-mono">{log.timestamp}</span>
                                        </div>
                                        <p className="text-gray-300 text-sm leading-snug">{log.message}</p>
                                        {log.alertId && log.alertId !== 'System' && (
                                            <p className="text-xs text-gray-600 mt-1">Alert ID: {log.alertId}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            {/* --- STYLES (SIMULATING SEPARATE CSS FILE) --- */}
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');

                :root {
                    --bg-dark: #0d1117;
                    --sidebar-dark: #161b22;
                    --panel-dark: #1f232b; /* Slightly lighter for cards/content */
                    --accent-indigo: #6366f1;
                    --accent-green: #10b981;
                    --accent-red: #ef4444;
                    --text-light: #d1d5db;
                }

                /* --- MAIN LAYOUT (Header, Sidebar, Content) --- */
                .app-container {
                    display: grid;
                    grid-template-columns: 240px 1fr; /* Sidebar width and main content */
                    grid-template-rows: 64px 1fr; /* Header height and main content */
                    min-height: 100vh;
                    background-color: var(--bg-dark);
                    color: var(--text-light);
                    font-family: 'Inter', sans-serif;
                }
                
                @media (max-width: 1024px) {
                    .app-container {
                        grid-template-columns: 1fr; /* Single column layout on mobile/tablet */
                        grid-template-rows: 64px 1fr; 
                    }
                    .sidebar { display: none; } /* Hide sidebar on small screens */
                    .header { grid-column: 1 / 2; }
                    .main-content { grid-column: 1 / 2; }
                }

                /* Utility Classes (Manual Tailwind) */
                .flex-row { display: flex; }
                .flex-col { display: flex; flex-direction: column; }
                .justify-between { justify-content: space-between; }
                .justify-center { justify-content: center; }
                .align-center { align-items: center; }
                .mb-4 { margin-bottom: 1rem; }
                .mb-6 { margin-bottom: 1.5rem; }
                .mr-2 { margin-right: 0.5rem; }
                .space-x-4 > * + * { margin-left: 1rem; } /* Simplified spacing */

                .icon-small { width: 1rem; height: 1rem; }
                .icon-medium { width: 1.5rem; height: 1.5rem; }


                /* --- HEADER STYLES --- */
                .header {
                    grid-column: 1 / 3; /* Spans sidebar and content area */
                    grid-row: 1 / 2;
                    background-color: var(--sidebar-dark);
                    border-bottom: 1px solid #374151;
                    padding: 0 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 20;
                }

                .search-bar {
                    display: flex;
                    align-items: center;
                    background-color: var(--bg-dark);
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    border: 1px solid #374151;
                    width: 300px;
                }
                .search-input {
                    background: transparent;
                    border: none;
                    outline: none;
                    color: var(--text-light);
                    width: 100%;
                }
                .icon-button {
                    background: var(--bg-dark);
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    border: 1px solid #374151;
                    transition: background 0.2s;
                }
                .icon-button:hover {
                    background: #252b35;
                }
                .user-profile {
                    width: 36px;
                    height: 36px;
                    background-color: var(--accent-indigo);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                /* --- SIDEBAR STYLES --- */
                .sidebar {
                    grid-column: 1 / 2;
                    grid-row: 2 / 3;
                    background-color: var(--sidebar-dark);
                    padding: 2rem 1rem;
                    border-right: 1px solid #374151;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .sidebar-menu {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .sidebar-item {
                    display: flex;
                    align-items: center;
                    padding: 0.75rem 1rem;
                    border-radius: 0.5rem;
                    color: var(--text-light);
                    text-decoration: none;
                    transition: background-color 0.2s;
                }
                .sidebar-item:hover {
                    background-color: #252b35;
                }
                .sidebar-item.active {
                    background-color: var(--accent-indigo);
                    font-weight: 600;
                    color: white;
                }
                .sidebar-footer {
                    margin-top: auto;
                    padding-top: 1rem;
                    border-top: 1px solid #374151;
                }


                /* --- MAIN CONTENT LAYOUT --- */
                .main-content {
                    grid-column: 2 / 3;
                    grid-row: 2 / 3;
                    padding: 2rem;
                    overflow-y: auto;
                }
                .content-header {
                    margin-bottom: 2rem;
                }
                .content-title {
                    font-size: 2.25rem; /* text-4xl */
                    font-weight: 800;
                    color: #e5e7eb;
                }

                /* Dashboard Grid */
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr; /* Main panels take 2/3, timeline takes 1/3 */
                    gap: 2rem;
                    margin-top: 1.5rem;
                }
                
                @media (max-width: 1280px) {
                    .dashboard-grid {
                        grid-template-columns: 1fr; /* Single column on larger tablets */
                    }
                }

                /* Service Cards Container */
                .service-cards-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                }
                
                .service-card {
                    background-color: var(--panel-dark);
                    padding: 1.5rem;
                    border-radius: 0.75rem;
                    border: 1px solid #374151;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    border-left-width: 4px; /* for accent color */
                }

                .healthy-card { border-left-color: var(--accent-green); }
                .critical-card { border-left-color: var(--accent-red); }

                .status-tag {
                    padding: 0.25rem 0.6rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    border-radius: 9999px;
                    text-transform: uppercase;
                }

                .agent-status-bar {
                    padding: 0.6rem 1rem;
                    border-radius: 0.5rem;
                    font-weight: bold;
                    color: white;
                    text-align: center;
                    margin-top: 1rem;
                }

                /* Sparkline SVG Animation */
                .sparkline-path {
                    transition: points 1.5s linear;
                }


                /* Agent Action Timeline */
                .timeline-container {
                    background-color: var(--panel-dark);
                    padding: 1.5rem;
                    border-radius: 0.75rem;
                    border: 1px solid #374151;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
                    display: flex;
                    flex-direction: column;
                }
                
                .timeline-scroller {
                    height: 500px;
                    overflow-y: scroll;
                    padding-right: 0.5rem;
                }

                .timeline-scroller::-webkit-scrollbar { width: 4px; }
                .timeline-scroller::-webkit-scrollbar-thumb { background-color: #4b5563; border-radius: 2px; }

                .timeline-event {
                    display: flex;
                    margin-bottom: 1.5rem;
                    position: relative;
                }

                .timeline-dot {
                    width: 1.5rem;
                    height: 1.5rem;
                    border-radius: 50%;
                    background-color: #374151;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                    flex-shrink: 0;
                    margin-right: 1rem;
                    border: 2px solid var(--panel-dark);
                }

                .timeline-event:not(:last-child)::before {
                    content: '';
                    position: absolute;
                    top: 1.5rem;
                    left: 0.75rem;
                    width: 2px;
                    height: calc(100% - 1.5rem);
                    background-color: #374151;
                    z-index: 0;
                }

                .timeline-content {
                    flex-grow: 1;
                    background-color: #111827;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    border-left: 3px solid var(--accent-indigo);
                }
                
                /* Timeline Tags */
                .event-tag {
                    padding: 0.1rem 0.5rem;
                    font-size: 0.65rem;
                    font-weight: 700;
                    border-radius: 0.25rem;
                    text-transform: uppercase;
                }

                .critical-alert { background-color: #b91c1c; color: #fee2e2; }
                .auto-trigger { background-color: #4338ca; color: #eef2ff; }
                .success { background-color: #065f46; color: #d1fae5; }
                .triage { background-color: #b45309; color: #fffbeb; }
                .action { background-color: #1d4ed8; color: #eff6ff; }
                .validation { background-color: #0891b2; color: #f0f9ff; }
                .system { background-color: #374151; color: #d1d5db; }

                /* Spin animation for loading */
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                `}
            </style>
            
            <div className="app-container">
                <DashboardHeader />
                <Sidebar />

                <main className="main-content">
                    <header className="content-header">
                        <p className="text-gray-400 text-lg mt-1">Autonomous Remediation System (AIRS) Overview</p>
                        <h1 className="content-title">
                            Microservice Dashboard
                        </h1>
                    </header>

                    <div className="dashboard-grid">
                        {/* Column 1: Service Cards */}
                        <div className="flex-col">
                            <h2 className="text-xl font-bold mb-4 text-gray-200">Microservice Health</h2>
                            <div className="service-cards-container">
                                {services.map(service => (
                                    <ServiceCard 
                                        key={service.id} 
                                        service={service} 
                                        isProcessing={isProcessing}
                                        failingServiceId={failingService?.id}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Column 2: Agent Action Timeline */}
                        <div className="flex-col">
                            <AgentActionTimeline />
                        </div>
                    </div>
                    
                    {failingService && (
                        <div className="mt-8 p-4 rounded-lg bg-red-900/50 border border-red-500 text-sm text-red-100">
                            <p className="font-bold flex-row align-center"><Zap className="icon-small mr-2"/> CRITICAL ALERT ACTIVE:</p>
                            <p className="ml-6">Service **{failingService.name}** is failing ({failingService.metric}: {failingService.value}{failingService.metric.includes('Latency') ? 'ms' : '%'}). Autonomous remediation has been **automatically triggered** and is running in the background.</p>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default App;
