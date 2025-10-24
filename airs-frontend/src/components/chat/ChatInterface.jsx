import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Trash2, RotateCcw, AlertCircle, Key, Clock, RefreshCw } from 'lucide-react';

const ChatInterface = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AIRS assistant. I can help you monitor services, analyze issues, and trigger remediations.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const [apiKey, setApiKey] = useState('sk-4QAXZM7ZVzIUtEq3gO4KmHiwUvgvlMPxTPLP1wcFZEk');
  const messagesEndRef = useRef(null);

  // Langflow configuration
  const LANGFLOW_CONFIG = {
    url: 'http://127.0.0.1:7860',
    flowId: '3b082a94-51bb-4ba0-89fa-5d266e0f8d30',
    testFlowId: '6054595b-9a4f-4f84-89ca-4f602cac0bff' // Faster test endpoint
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helper function to safely format timestamp
  const formatTimestamp = (timestamp) => {
    try {
      // Handle both Date objects and ISO strings
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Unknown Time';
    }
  };

  // Save messages to localStorage for persistence
  useEffect(() => {
    if (messages.length > 1) {
      // Convert Date objects to ISO strings for storage
      const messagesForStorage = messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
      }));
      
      localStorage.setItem('airs_chat_history', JSON.stringify({
        messages: messagesForStorage,
        sessionId,
        lastUpdated: new Date().toISOString()
      }));
    }
  }, [messages, sessionId]);

  // Load messages from localStorage on component mount
  useEffect(() => {
    const savedChat = localStorage.getItem('airs_chat_history');
    if (savedChat) {
      try {
        const { messages: savedMessages, sessionId: savedSessionId } = JSON.parse(savedChat);
        if (savedMessages && savedMessages.length > 0) {
          // Convert ISO strings back to Date objects
          const messagesWithDates = savedMessages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          
          setMessages(messagesWithDates);
          setSessionId(savedSessionId || crypto.randomUUID());
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        // Clear corrupted data
        localStorage.removeItem('airs_chat_history');
      }
    }
  }, []);

  // Test Langflow connection on component mount
  useEffect(() => {
    testLangflowConnection();
  }, [apiKey]);

  const testLangflowConnection = async () => {
    try {
      setConnectionStatus('checking');
      
      const payload = {
        output_type: "chat",
        input_type: "chat", 
        input_value: "test",
        session_id: crypto.randomUUID()
      };

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      // Use the faster test endpoint for connection checks
      const response = await fetch(
        `${LANGFLOW_CONFIG.url}/api/v1/run/${LANGFLOW_CONFIG.testFlowId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'x-api-key': apiKey
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId); // Clear timeout if request completes

      if (response.ok) {
        setConnectionStatus('connected');
      } else if (response.status === 429) {
        setConnectionStatus('rate_limited');
        throw new Error('Rate limit exceeded during connection test');
      } else {
        const errorData = await response.json();
        throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('Langflow connection test failed:', error);
      
      // Enhanced error categorization
      if (error.name === 'AbortError') {
        setConnectionStatus('error');
        console.error('Langflow connection timeout - server may be down');
      } else if (error.message.includes('429')) {
        setConnectionStatus('rate_limited');
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        setConnectionStatus('error');
        console.error('Langflow network error - server may be down or unreachable');
      } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        setConnectionStatus('error');
        console.error('Langflow server error - service may be down');
      } else {
        setConnectionStatus('error');
      }
    }
  };

  // Enhanced error handling with status code specific messages
  const processChatMessage = async (userMessage) => {
    setIsLoading(true);
    
    try {
      const payload = {
        output_type: "chat",
        input_type: "chat",
        input_value: userMessage,
        session_id: sessionId
      };

      console.log('Sending to Langflow:', {
        url: `${LANGFLOW_CONFIG.url}/api/v1/run/${LANGFLOW_CONFIG.flowId}`,
        payload
      });

      // Add timeout for main chat requests too
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for chat

      // Use the main chat endpoint for actual conversations
      const response = await fetch(
        `${LANGFLOW_CONFIG.url}/api/v1/run/${LANGFLOW_CONFIG.flowId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'x-api-key': apiKey
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      console.log('Langflow response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Langflow API error: ${response.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage += ` - ${errorData.detail || errorData.message || errorData.error?.message || errorText}`;
        } catch {
          errorMessage += ` - ${errorText}`;
        }
        
        // Enhanced status code handling
        throw new Error(`${response.status}:${errorMessage}`);
      }

      const data = await response.json();
      console.log('Langflow full response:', data);

      // Extract the AI response from Langflow
      let aiResponse = 'I received your message but had trouble processing the response.';
      
      if (data && data.outputs && data.outputs[0] && data.outputs[0].outputs) {
        const output = data.outputs[0].outputs[0];
        
        // Try different response structures
        if (output.results && output.results.message && output.results.message.text) {
          aiResponse = output.results.message.text;
        } else if (output.results && output.results.message) {
          aiResponse = output.results.message;
        } else if (output.results && typeof output.results === 'string') {
          aiResponse = output.results;
        } else if (output.results && output.results.output) {
          aiResponse = output.results.output;
        } else if (output.results) {
          aiResponse = typeof output.results === 'object' 
            ? JSON.stringify(output.results, null, 2) 
            : String(output.results);
        }
      } else if (data && data.message) {
        aiResponse = data.message;
      } else if (data && data.output) {
        aiResponse = data.output;
      }

      setConnectionStatus('connected');
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        source: 'langflow'
      }]);

    } catch (error) {
      console.error('Chat API error:', error);
      setConnectionStatus('error');
      
      let errorMessage = '';
      const statusCode = error.message.split(':')[0];
      
      // Enhanced error handling based on status codes
      switch (statusCode) {
        case '429':
          errorMessage = `**Rate Limit Exceeded** 🚫\n\n`;
          errorMessage += `You've reached the rate limit for the AI model. This is usually temporary.\n\n`;
          errorMessage += `**What you can do:**\n`;
          errorMessage += `• Wait 1-2 minutes and try again\n`;
          errorMessage += `• The system will automatically retry\n`;
          errorMessage += `• Consider upgrading your API tier for higher limits\n\n`;
          errorMessage += `*This is a provider limitation, not an issue with AIRS.*`;
          break;
          
        case '403':
          errorMessage = `**Authentication Failed** 🔑\n\n`;
          errorMessage += `The API key is not working or has insufficient permissions.\n\n`;
          errorMessage += `**Please check:**\n`;
          errorMessage += `• Is the API key correct?\n`;
          errorMessage += `• Does the key have proper permissions?\n`;
          errorMessage += `• Is Langflow configured to accept this key?\n\n`;
          errorMessage += `Current API key: ${apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : 'Not set'}`;
          break;
          
        case '404':
          errorMessage = `**Flow Not Found** 🔍\n\n`;
          errorMessage += `The flow ID \`${LANGFLOW_CONFIG.flowId}\` was not found.\n\n`;
          errorMessage += `**Possible causes:**\n`;
          errorMessage += `• The flow doesn't exist\n`;
          errorMessage += `• The flow is not published\n`;
          errorMessage += `• Incorrect flow ID in configuration\n`;
          break;
          
        case '500':
        case '502':
        case '503':
          errorMessage = `**Service Unavailable** 🔧\n\n`;
          errorMessage += `Langflow server is experiencing issues.\n\n`;
          errorMessage += `**What to do:**\n`;
          errorMessage += `• Check if Langflow server is running\n`;
          errorMessage += `• Try again in a few minutes\n`;
          errorMessage += `• Check server logs for details\n`;
          break;
          
        case '400':
          errorMessage = `**Bad Request** ⚠️\n\n`;
          errorMessage += `The request was malformed or missing required parameters.\n\n`;
          errorMessage += `**Details:** ${error.message.split(':').slice(1).join(':')}`;
          break;
          
        default:
          if (error.name === 'AbortError') {
            errorMessage = `**Request Timeout** ⏰\n\n`;
            errorMessage += `Langflow server is not responding in a timely manner.\n\n`;
            errorMessage += `**Possible causes:**\n`;
            errorMessage += `• Langflow server may be down\n`;
            errorMessage += `• The server is overloaded\n`;
            errorMessage += `• Network connectivity issues\n`;
          } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
            errorMessage = `**Network Connection Error** 🌐\n\n`;
            errorMessage += `Cannot connect to Langflow at ${LANGFLOW_CONFIG.url}.\n\n`;
            errorMessage += `**Please ensure:**\n`;
            errorMessage += `• Langflow server is running\n`;
            errorMessage += `• The URL is correct\n`;
            errorMessage += `• CORS is properly configured\n`;
            errorMessage += `• No firewall blocking the connection\n`;
          } else {
            errorMessage = `**Unexpected Error** ❌\n\n`;
            errorMessage += `An unexpected error occurred while processing your message.\n\n`;
            errorMessage += `**Error Details:**\n${error.message}`;
          }
          break;
      }
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
        source: 'error'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced retry logic for rate limits
  const processChatMessageWithRetry = async (userMessage, retryCount = 0) => {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds
    
    try {
      await processChatMessage(userMessage);
    } catch (error) {
      if (error.message.startsWith('429') && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
        console.log(`Rate limit hit, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Show retry status to user
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⏳ Rate limit encountered. Retrying in ${delay/1000} seconds... (${retryCount + 1}/${maxRetries})`,
          timestamp: new Date(),
          source: 'retry'
        }]);
        
        setConnectionStatus('retrying');
        await new Promise(resolve => setTimeout(resolve, delay));
        return processChatMessageWithRetry(userMessage, retryCount + 1);
      } else {
        throw error; // Re-throw if max retries reached or different error
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    
    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);
    
    setInput('');
    
    // Process with Langflow AI with retry logic
    await processChatMessageWithRetry(userMessage);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: 'Hello! I\'m your AIRS assistant. I can help you monitor services, analyze issues, and trigger remediations.',
      timestamp: new Date()
    }]);
    setSessionId(crypto.randomUUID());
    localStorage.removeItem('airs_chat_history');
    setConnectionStatus('unknown');
  };

  const resetSession = () => {
    setSessionId(crypto.randomUUID());
    setConnectionStatus('unknown');
  };

  const retryConnection = async () => {
    setConnectionStatus('unknown');
    await testLangflowConnection();
  };

  const updateApiKey = (newKey) => {
    setApiKey(newKey);
    setConnectionStatus('unknown');
  };

  const getChatContextInfo = () => {
    const userMessages = messages.filter(msg => msg.role === 'user').length;
    const totalMessages = messages.length;
    return `${userMessages} user messages, ${totalMessages} total`;
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected to Langflow';
      case 'error':
        return 'Connection Failed';
      case 'rate_limited':
        return 'Rate Limited - Retrying...';
      case 'retrying':
        return 'Reconnecting...';
      case 'checking':
        return 'Checking connection...';
      default:
        return 'Checking connection...';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <div className="connection-status-connected"></div>;
      case 'error':
        return <AlertCircle size={14} className="connection-status-error" />;
      case 'rate_limited':
        return <Clock size={14} className="connection-status-rate-limited" />;
      case 'retrying':
        return <RefreshCw size={14} className="connection-status-retrying animate-spin" />;
      case 'checking':
        return <RefreshCw size={14} className="connection-status-checking animate-spin" />;
      default:
        return <div className="connection-status-unknown"></div>;
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="chat-floating-button"
        >
          <MessageCircle size={24} />
          {messages.length > 1 && (
            <span className="chat-notification-badge">
              {messages.filter(msg => msg.role === 'user').length}
            </span>
          )}
          {connectionStatus === 'error' && (
            <div className="connection-error-indicator"></div>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-title-section">
              <div className="chat-title">
                <Bot size={20} />
                <div>
                  <h3>AIRS Assistant</h3>
                  <div className="chat-session-info">
                    <span className="connection-status">
                      {getConnectionStatusIcon()}
                      {getConnectionStatusText()}
                    </span>
                    {connectionStatus === 'error' && (
                      <button 
                        onClick={retryConnection}
                        className="retry-connection-btn"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="chat-actions">
                <button 
                  onClick={() => {
                    const newKey = prompt('Enter new API key:', apiKey);
                    if (newKey !== null) updateApiKey(newKey);
                  }}
                  className="chat-action-btn"
                  title="Change API Key"
                >
                  <Key size={16} />
                </button>
                <button 
                  onClick={resetSession}
                  className="chat-action-btn"
                  title="Reset Session Context"
                >
                  <RotateCcw size={16} />
                </button>
                <button 
                  onClick={clearChat}
                  className="chat-action-btn"
                  title="Clear Chat History"
                >
                  <Trash2 size={16} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="chat-close-btn"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role} ${msg.source || ''}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.content}</div>
                  <div className="message-time">
                    {formatTimestamp(msg.timestamp)}
                    {msg.source === 'langflow' && (
                      <span className="message-source"> • Langflow AI</span>
                    )}
                    {msg.source === 'error' && (
                      <span className="message-source"> • Connection Error</span>
                    )}
                    {msg.source === 'retry' && (
                      <span className="message-source"> • Retrying</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">
                  <Bot size={16} />
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div className="message-time">
                    Connecting to Langflow AI...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="chat-input-container">
            {connectionStatus === 'error' && (
              <div className="connection-error-message">
                <AlertCircle size={16} />
                <div className="error-details">
                  <strong>Langflow Connection Issue</strong>
                  <span>Click retry or check if Langflow server is running</span>
                </div>
              </div>
            )}
            {connectionStatus === 'rate_limited' && (
              <div className="connection-error-message">
                <Clock size={16} />
                <div className="error-details">
                  <strong>Rate Limit Exceeded</strong>
                  <span>Please wait a moment before sending more messages</span>
                </div>
              </div>
            )}
            <div className="chat-input">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about services, trigger remediations..."
                disabled={isLoading || connectionStatus === 'error' || connectionStatus === 'rate_limited'}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading || connectionStatus === 'error' || connectionStatus === 'rate_limited'}
                className="chat-send-btn"
              >
                <Send size={18} />
              </button>
            </div>
            {connectionStatus === 'connected' && (
              <div className="chat-suggestions">
                <button onClick={() => setInput('Show critical services')}>Critical Services</button>
                <button onClick={() => setInput('Remediate S1')}>Remediate S1</button>
                <button onClick={() => setInput('Check system health')}>System Health</button>
                <button onClick={() => setInput('Analyze Payment Gateway logs')}>Analyze Logs</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ChatInterface;