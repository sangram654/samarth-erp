import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ChatbotWidget.css';

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.origin}/api`;

const QUICK_ACTIONS = {
    student: [
        { label: '📊 My Attendance', message: 'What is my current attendance percentage?' },
        { label: '💰 Fee Status', message: 'Show me my fee status and pending amount.' },
        { label: '📝 My Marks', message: 'What are my latest marks and grades?' },
        { label: '📅 Leave Status', message: 'What is the status of my leave applications?' },
        { label: '📚 Library Books', message: 'Do I have any books issued from the library?' },
    ],
    teacher: [
        { label: '📋 Latest Notices', message: 'What are the latest college notices?' },
        { label: '📅 Leave Status', message: 'What is the status of my leave applications?' },
    ],
    parent: [
        { label: '📊 Ward Attendance', message: 'What is my child\'s attendance?' },
        { label: '💰 Fee Status', message: 'Show me my child\'s fee status.' },
        { label: '📝 Ward Marks', message: 'What are my child\'s latest marks?' },
    ],
    admin: [
        { label: '📋 Latest Notices', message: 'What are the latest college notices?' },
        { label: '📊 Attendance Overview', message: 'Give me an overview of college attendance today.' },
    ],
    default: [
        { label: '📋 Latest Notices', message: 'What are the latest college notices?' },
        { label: '❓ ERP Help', message: 'What can you help me with?' },
    ]
};

function TypingIndicator() {
    return (
        <div className="cw-msg cw-msg--bot">
            <div className="cw-avatar">🤖</div>
            <div className="cw-bubble cw-bubble--bot cw-typing">
                <span></span><span></span><span></span>
            </div>
        </div>
    );
}

export default function ChatbotWidget({ userRole }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            id: 'welcome',
            role: 'bot',
            content: `Hi! I'm Sammy, your AI assistant for Samarth College ERP 👋\n\nI can fetch your real attendance, fees, marks, and more. What can I help you with?`,
            timestamp: new Date(),
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [hasNewMessage, setHasNewMessage] = useState(false);
    const [conversationHistory, setConversationHistory] = useState([]);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const role = userRole || 'default';
    const quickActions = QUICK_ACTIONS[role] || QUICK_ACTIONS.default;

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, scrollToBottom]);

    useEffect(() => {
        if (isOpen) {
            setHasNewMessage(false);
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    const sendMessage = useCallback(async (text) => {
        const trimmed = (text || inputValue).trim();
        if (!trimmed || isLoading) return;

        const userMsg = { id: Date.now(), role: 'user', content: trimmed, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        // Build conversation history for context
        const history = [...conversationHistory, { role: 'user', content: trimmed }];

        try {
            const token = localStorage.getItem('token');
            const resp = await fetch(`${API_BASE}/chatbot/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    message: trimmed,
                    conversationHistory: conversationHistory.slice(-6)
                })
            });

            const data = await resp.json();

            if (data.success) {
                const botContent = data.data.message;
                const botMsg = {
                    id: Date.now() + 1,
                    role: 'bot',
                    content: botContent,
                    timestamp: new Date(),
                    toolsUsed: data.data.toolsUsed || [],
                    source: data.data.source,
                };
                setMessages(prev => [...prev, botMsg]);
                setConversationHistory([
                    ...history,
                    { role: 'assistant', content: botContent }
                ]);

                if (!isOpen) setHasNewMessage(true);
            } else {
                throw new Error(data.message || 'Unknown error');
            }
        } catch (err) {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'bot',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
                isError: true,
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [inputValue, isLoading, conversationHistory, isOpen]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([{
            id: 'welcome-new',
            role: 'bot',
            content: `Chat cleared! How can I help you?`,
            timestamp: new Date(),
        }]);
        setConversationHistory([]);
    };

    const formatTime = (ts) => {
        const d = ts instanceof Date ? ts : new Date(ts);
        return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    const getAgentLabel = (source, toolsUsed) => {
        if (!toolsUsed?.length) return null;
        const toolLabels = {
            get_my_attendance: 'Attendance',
            get_my_fees: 'Fees',
            get_my_marks: 'Marks',
            get_leave_status: 'Leave',
            get_notice_board: 'Notices',
            get_library_status: 'Library',
        };
        const labels = toolsUsed.map(t => toolLabels[t] || t).join(', ');
        return `🔍 Checked: ${labels}`;
    };

    return (
        <>
            {/* Floating Toggle Button */}
            <button
                id="chatbot-toggle-btn"
                className={`cw-fab ${isOpen ? 'cw-fab--open' : ''}`}
                onClick={() => setIsOpen(o => !o)}
                aria-label="Open AI Assistant"
            >
                {isOpen ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                )}
                {hasNewMessage && !isOpen && <span className="cw-fab-badge"></span>}
            </button>

            {/* Chat Window */}
            <div className={`cw-window ${isOpen ? 'cw-window--open' : ''}`} role="dialog" aria-label="AI Assistant">
                {/* Header */}
                <div className="cw-header">
                    <div className="cw-header-info">
                        <div className="cw-header-avatar">🤖</div>
                        <div>
                            <div className="cw-header-name">Sammy</div>
                            <div className="cw-header-status">
                                <span className="cw-status-dot"></span>
                                AI-Powered ERP Assistant
                            </div>
                        </div>
                    </div>
                    <div className="cw-header-actions">
                        <button className="cw-icon-btn" onClick={clearChat} title="Clear chat" aria-label="Clear chat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                            </svg>
                        </button>
                        <button className="cw-icon-btn" onClick={() => setIsOpen(false)} aria-label="Close">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="cw-messages" id="chatbot-messages">
                    {messages.map(msg => (
                        <div key={msg.id} className={`cw-msg cw-msg--${msg.role}`}>
                            {msg.role === 'bot' && <div className="cw-avatar">🤖</div>}
                            <div className={`cw-bubble cw-bubble--${msg.role} ${msg.isError ? 'cw-bubble--error' : ''}`}>
                                <div className="cw-bubble-text">{msg.content}</div>
                                <div className="cw-bubble-meta">
                                    {msg.role === 'bot' && msg.toolsUsed?.length > 0 && (
                                        <span className="cw-agent-label">{getAgentLabel(msg.source, msg.toolsUsed)}</span>
                                    )}
                                    <span className="cw-timestamp">{formatTime(msg.timestamp)}</span>
                                </div>
                            </div>
                            {msg.role === 'user' && <div className="cw-avatar cw-avatar--user">👤</div>}
                        </div>
                    ))}

                    {isLoading && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions */}
                {messages.length <= 2 && !isLoading && (
                    <div className="cw-quick-actions" id="chatbot-quick-actions">
                        {quickActions.map((action, idx) => (
                            <button
                                key={idx}
                                id={`quick-action-${idx}`}
                                className="cw-quick-btn"
                                onClick={() => sendMessage(action.message)}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="cw-input-area">
                    <textarea
                        id="chatbot-input"
                        ref={inputRef}
                        className="cw-input"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about your attendance, fees, marks..."
                        rows={1}
                        disabled={isLoading}
                        aria-label="Chat message input"
                    />
                    <button
                        id="chatbot-send-btn"
                        className={`cw-send-btn ${isLoading ? 'cw-send-btn--loading' : ''}`}
                        onClick={() => sendMessage()}
                        disabled={isLoading || !inputValue.trim()}
                        aria-label="Send message"
                    >
                        {isLoading ? (
                            <span className="cw-spinner"></span>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="22" y1="2" x2="11" y2="13"/>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                            </svg>
                        )}
                    </button>
                </div>

                <div className="cw-footer-note">
                    Powered by Groq LLaMA-3.3 · Samarth ERP AI
                </div>
            </div>
        </>
    );
}
