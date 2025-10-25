import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Trash2, AlertCircle, Clock, RefreshCw } from 'lucide-react';

// Separate component for connection status to prevent main chat re-renders
const ConnectionStatus = ({ onRetry }) => {
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  // Connection test using AI status endpoint
  const testBackendConnection = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/ai/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-cache'
      });

      if (response.ok) {
        const data = await response.json();
        const aiConnected = data.connected || false;
        
        setConnectionStatus(currentStatus => {
          if (aiConnected && currentStatus !== 'connected') {
            return 'connected';
          } else if (!aiConnected && currentStatus !== 'error') {
            return 'error';
          }
          return currentStatus;
        });
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      console.error('AI status check failed:', error);
      setConnectionStatus('error');
    }
  };

  // Periodic system status checking every 10 seconds
  useEffect(() => {
    testBackendConnection();
    const intervalId = setInterval(testBackendConnection, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const handleRetry = async () => {
    setConnectionStatus('checking');
    await testBackendConnection();
    if (onRetry) onRetry();
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Langflow AI Connected';
      case 'error':
        return 'Langflow AI Disconnected';
      case 'rate_limited':
        return 'Rate Limited';
      case 'checking':
        return 'Checking AI service...';
      case 'retrying':
        return 'Reconnecting...';
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
      case 'checking':
        return <RefreshCw size={14} className="connection-status-checking animate-spin" />;
      default:
        return <div className="connection-status-unknown"></div>;
    }
  };

  return (
    <span className="connection-status">
      {getConnectionStatusIcon()}
      {getConnectionStatusText()}
      {connectionStatus === 'error' && (
        <button 
          onClick={handleRetry}
          className="retry-connection-btn"
          style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '12px' }}
        >
          Retry
        </button>
      )}
    </span>
  );
};

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
  const messagesEndRef = useRef(null);

  // Backend configuration
  const BACKEND_CONFIG = {
    url: import.meta.env.VITE_BACKEND_URL
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
          const messagesWithDates = savedMessages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));

          setMessages(messagesWithDates);
          setSessionId(savedSessionId || crypto.randomUUID());
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        localStorage.removeItem('airs_chat_history');
      }
    }
  }, []);

  // Enhanced error handling with status code specific messages
  const getErrorMessage = (errorData) => {
    const statusCode = errorData.statusCode;
    const rawError = errorData.error;
    
    switch (statusCode) {
      case 429:
        return `**Rate Limit Exceeded** 🚫\n\nYou've reached the rate limit for Langflow AI. Please wait a moment and try again.\n\n**What you can do:**\n• Wait 1-2 minutes and try again\n• The system will automatically retry\n• Consider upgrading your API tier for higher limits\n\n*This is a provider limitation, not an issue with AIRS.*`;
        
      case 403:
        return `**Authentication Failed** 🔑\n\nThe Langflow AI service configuration is incorrect. Please check backend configuration.\n\n**Error details:** ${rawError}`;
        
      case 404:
        return `**Flow Not Found** 🔍\n\nThe specified Langflow flow was not found.\n\n**Error details:** ${rawError}`;
        
      case 500:
      case 502:
      case 503:
        return `**Service Unavailable** 🔧\n\nThe Langflow AI service is currently unavailable. Please try again later.\n\n**Error details:** ${rawError}`;
        
      case 504:
        return `**Request Timeout** ⏰\n\nThe Langflow AI service is not responding in a timely manner. Please try again.\n\n**Error details:** ${rawError}`;
        
      default:
        if (rawError.includes('ECONNREFUSED') || rawError.includes('NetworkError')) {
          return `**Network Connection Error** 🌐\n\nCannot connect to Langflow AI service.\n\n**Please ensure:**\n• Langflow server is running\n• Backend can connect to Langflow\n• Check network connectivity\n\n**Error:** ${rawError}`;
        } else {
          return `**Langflow AI Service Error** 🔧\n\nUnable to get response from AI service: ${rawError}`;
        }
    }
  };

  // Process chat message through backend proxy
  const processChatMessage = async (userMessage) => {
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_CONFIG.url}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: sessionId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          message: data.error || `AI service error: ${response.status}`,
          statusCode: response.status,
          details: data.details
        };
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        source: data.source || 'langflow'
      }]);

      setConnectionStatus('connected');

    } catch (error) {
      console.error('Chat API error:', error);
      setConnectionStatus('error');

      const errorMessage = getErrorMessage(error);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
        source: 'error'
      }]);
      
      throw error; // Re-throw for retry logic
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
      if (error.statusCode === 429 && retryCount < maxRetries) {
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

    // Process through backend proxy with retry logic
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
  };

  const handleConnectionRetry = () => {
    setConnectionStatus('checking');
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
                    <ConnectionStatus onRetry={handleConnectionRetry} />
                  </div>
                </div>
              </div>
              <div className="chat-actions">
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
            
            {/* ENHANCED LOADING INDICATOR - Better visibility for light/dark modes */}
            {isLoading && (
              <div className="message assistant loading-indicator">
                <div className="message-avatar">
                  <Bot size={16} className="animate-pulse" />
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <div className="typing-dots">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                    <div className="typing-text">Langflow AI is thinking...</div>
                  </div>
                  <div className="message-time">
                    Processing your request...
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
                {isLoading ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            {/* REMOVED: Quick suggestion buttons for cleaner UI */}
          </div>
        </div>
      )}
    </>
  );
};

export default ChatInterface;