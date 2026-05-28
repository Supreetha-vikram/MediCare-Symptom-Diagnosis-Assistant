import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";

function App() {
  // Authentication state
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("medicare_current_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Theme state
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("medicare_theme");
    return saved || "light";
  });

  // Chat interface state
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  
  const chatEndRef = useRef(null);

  // Apply theme class to document element on change
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("medicare_theme", theme);
  }, [theme]);

  // Load chat history from MongoDB when the logged-in user changes
  useEffect(() => {
    const fetchHistory = async () => {
      if (user) {
        try {
          const response = await axios.get(`http://127.0.0.1:8000/api/history?username=${user.username}`);
          setHistory(response.data || []);
        } catch (error) {
          console.error("Error fetching history from backend:", error);
          setHistory([]);
        }
      } else {
        setHistory([]);
      }
    };
    
    fetchHistory();
    setChat([]);
    setActiveChatId(null);
  }, [user]);

  // Auto scroll to the bottom of the chat list on update
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat, isLoading]);

  // Sync individual chat session to MongoDB
  const saveHistoryToBackend = async (session) => {
    if (user) {
      try {
        await axios.post("http://127.0.0.1:8000/api/history", {
          username: user.username,
          ...session
        });
      } catch (error) {
        console.error("Error saving chat history to MongoDB:", error);
      }
    }
  };

  // Auth form submissions via backend MongoDB endpoints
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setAuthError("Please fill out all fields.");
      return;
    }
    
    try {
      const response = await axios.post("http://127.0.0.1:8000/api/auth/login", {
        username: loginUsername.trim(),
        password: loginPassword
      });
      const userData = response.data; // { username, email }
      setUser(userData);
      localStorage.setItem("medicare_current_user", JSON.stringify(userData));
      setLoginUsername("");
      setLoginPassword("");
    } catch (error) {
      if (error.response && error.response.data && error.response.data.detail) {
        setAuthError(error.response.data.detail);
      } else {
        setAuthError("Error connecting to login service.");
      }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    if (!loginUsername.trim() || !loginPassword.trim() || !loginEmail.trim()) {
      setAuthError("Please fill out all fields.");
      return;
    }

    try {
      const response = await axios.post("http://127.0.0.1:8000/api/auth/register", {
        username: loginUsername.trim(),
        email: loginEmail.trim(),
        password: loginPassword
      });
      
      const userData = { username: response.data.username, email: response.data.email };
      setUser(userData);
      localStorage.setItem("medicare_current_user", JSON.stringify(userData));
      setLoginUsername("");
      setLoginEmail("");
      setLoginPassword("");
      setIsRegistering(false);
    } catch (error) {
      if (error.response && error.response.data && error.response.data.detail) {
        setAuthError(error.response.data.detail);
      } else {
        setAuthError("Error connecting to registration service.");
      }
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("medicare_current_user");
    setChat([]);
    setActiveChatId(null);
  };

  // Theme switcher
  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };

  // Send message action
  const sendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = {
      sender: "user",
      text: message
    };

    const tempChat = [...chat, userMessage];
    setChat(tempChat);
    setMessage("");
    setIsLoading(true);

    let currentId = activeChatId;
    
    // Update history in real time on UI and backend if active session exists
    if (currentId) {
      const activeSession = history.find(h => h.id === currentId);
      if (activeSession) {
        const updatedSession = { ...activeSession, messages: tempChat };
        setHistory(history.map(h => h.id === currentId ? updatedSession : h));
        saveHistoryToBackend(updatedSession);
      }
    }

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/chat",
        {
          message: userMessage.text
        }
      );

      const data = response.data;
      let botMessage;
      
      if (data.detected_symptoms && data.detected_symptoms.length > 0) {
        botMessage = {
          sender: "bot",
          data: data,
          text: `Predicted Disease: ${data.predicted_disease}. Confidence: ${data.confidence}%`
        };
      } else {
        botMessage = {
          sender: "bot",
          text: data.message || "No symptoms detected. Please describe your symptoms more clearly."
        };
      }

      const finalChat = [...tempChat, botMessage];
      setChat(finalChat);

      if (currentId) {
        const activeSession = history.find(h => h.id === currentId);
        if (activeSession) {
          let newTitle = activeSession.title;
          if (botMessage.data && botMessage.data.predicted_disease && newTitle.startsWith("Symptom:")) {
            newTitle = `Diagnosis: ${botMessage.data.predicted_disease}`;
          }
          const updatedSession = { ...activeSession, title: newTitle, messages: finalChat };
          setHistory(history.map(h => h.id === currentId ? updatedSession : h));
          saveHistoryToBackend(updatedSession);
        }
      } else {
        // Create new history session in backend
        const newId = Date.now();
        let newTitle = userMessage.text;
        if (newTitle.length > 25) {
          newTitle = newTitle.substring(0, 25) + "...";
        }
        newTitle = `Symptom: ${newTitle}`;

        if (botMessage.data && botMessage.data.predicted_disease) {
          newTitle = `Diagnosis: ${botMessage.data.predicted_disease}`;
        }

        const now = new Date();
        const timestampStr = now.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

        const newSession = {
          id: newId,
          title: newTitle,
          timestamp: timestampStr,
          messages: finalChat
        };

        setHistory([newSession, ...history]);
        saveHistoryToBackend(newSession);
        setActiveChatId(newId);
      }

    } catch (error) {
      const errorMessage = {
        sender: "bot",
        text: "Error connecting to backend."
      };
      const errorChat = [...tempChat, errorMessage];
      setChat(errorChat);

      if (currentId) {
        const activeSession = history.find(h => h.id === currentId);
        if (activeSession) {
          const updatedSession = { ...activeSession, messages: errorChat };
          setHistory(history.map(h => h.id === currentId ? updatedSession : h));
          saveHistoryToBackend(updatedSession);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  // Reset conversation view
  const startNewChat = () => {
    setChat([]);
    setActiveChatId(null);
  };

  // History operations
  const loadChat = (chatSession) => {
    setActiveChatId(chatSession.id);
    setChat(chatSession.messages);
  };

  const deleteChat = async (e, chatId) => {
    e.stopPropagation();
    try {
      await axios.delete(`http://127.0.0.1:8000/api/history/${chatId}?username=${user.username}`);
      setHistory(history.filter(h => h.id !== chatId));
      if (activeChatId === chatId) {
        setChat([]);
        setActiveChatId(null);
      }
    } catch (error) {
      console.error("Error deleting chat session from backend DB:", error);
    }
  };

  const clearAllHistory = async () => {
    if (window.confirm("Are you sure you want to delete all chat history? This cannot be undone.")) {
      try {
        await axios.delete(`http://127.0.0.1:8000/api/history?username=${user.username}`);
        setHistory([]);
        setChat([]);
        setActiveChatId(null);
      } catch (error) {
        console.error("Error clearing chat history from backend DB:", error);
      }
    }
  };

  // Render Login Panel if not authenticated
  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <h2 className="login-title">MediCare AI Portal</h2>
            <p className="login-subtitle">
              {isRegistering ? "Create your diagnostic account" : "Sign in to analyze symptoms & track history"}
            </p>
          </div>

          <form className="login-form" onSubmit={isRegistering ? handleRegister : handleLogin}>
            {authError && (
              <div style={{
                color: "var(--severity-severe)",
                fontSize: "13px",
                fontWeight: "600",
                textAlign: "center",
                backgroundColor: "var(--severity-severe-bg)",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--severity-severe-border)"
              }}>
                {authError}
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
              />
            </div>

            {isRegistering && (
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="Enter email address"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-btn">
              {isRegistering ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div className="login-footer">
            {isRegistering ? "Already have an account?" : "New to MediCare AI?"}
            <button
              className="login-footer-link"
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError("");
                setLoginUsername("");
                setLoginPassword("");
                setLoginEmail("");
              }}
            >
              {isRegistering ? "Sign In" : "Register here"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main chat interface
  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top">
          {/* Branding */}
          <div className="sidebar-brand">
            <div className="brand-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <span className="brand-title">MediCare AI</span>
          </div>

          {/* Action button */}
          <button onClick={startNewChat} className="new-chat-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New Chat
          </button>

          {/* Previous Chats Section */}
          <div className="sidebar-history-container">
            <div className="sidebar-section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Chat Logs</span>
              {history.length > 0 && (
                <button onClick={clearAllHistory} style={{ background: "none", border: "none", color: "var(--text-light)", fontSize: "10px", fontWeight: "700", cursor: "pointer", textTransform: "uppercase" }}>
                  Clear All
                </button>
              )}
            </div>
            
            <div className="history-list">
              {history.length === 0 ? (
                <div style={{ fontSize: "12px", color: "var(--text-light)", padding: "12px", fontStyle: "italic", textAlign: "center" }}>
                  No previous chats
                </div>
              ) : (
                history.map((hSession) => (
                  <button
                    key={hSession.id}
                    onClick={() => loadChat(hSession)}
                    className={`history-item ${activeChatId === hSession.id ? "active" : ""}`}
                  >
                    <div className="history-item-info">
                      <span className="history-item-title">{hSession.title}</span>
                      <span className="history-item-time">{hSession.timestamp}</span>
                    </div>
                    <button
                      onClick={(e) => deleteChat(e, hSession.id)}
                      className="delete-history-btn"
                      title="Delete chat session"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Legends */}
          <div>
            <div className="sidebar-section-title">Severity Legend</div>
            <div className="severity-legend">
              <div className="legend-item">
                <span className="legend-dot mild"></span>
                <span>Mild Condition</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot moderate"></span>
                <span>Moderate Condition</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot severe"></span>
                <span>Severe Condition</span>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Info and Profile Card at Bottom */}
        <div className="sidebar-bottom">
          <div className="user-profile-section">
            <div className="user-profile-info">
              <div className="user-avatar">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="user-name-details">
                <span className="user-name">{user.username}</span>
                <span style={{ fontSize: "10px", color: "var(--text-light)" }}>Patient Account</span>
              </div>
            </div>
            <button onClick={handleLogout} className="user-logout-btn" title="Sign Out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>

          <div className="emergency-card">
            <div className="emergency-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="emergency-text">
              <strong>Emergency Information</strong>
              If you feel sudden shortness of breath, chest pain, or severe head pain, call 911 immediately.
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        {/* Sleek Top Header */}
        <header className="app-header">
          <div className="header-meta">
            <h1 className="header-title">AI Symptom Diagnosis Assistant</h1>
            <span className="header-subtitle">Powered by NLP and Machine Learning</span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Theme Toggle Switcher */}
            <button onClick={toggleTheme} className="theme-toggle-btn" title="Toggle color mode">
              {theme === "light" ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                  <span>Bright Mode</span>
                </>
              )}
            </button>

            <div className="system-status">
              <span className="status-dot"></span>
              System Online
            </div>
          </div>
        </header>

        {/* Chat window */}
        <div className="chat-messages">
          {chat.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.9, color: "var(--text-light)" }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "16px", opacity: 0.9 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <h2 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text-dark)", marginBottom: "8px", letterSpacing: "-0.5px" }}>Welcome to MediCare AI</h2>
              <p style={{ fontSize: "14.5px", textAlign: "center", maxWidth: "460px", lineHeight: "1.6", color: "var(--text-muted)" }}>
                Hello, <strong>{user.username}</strong>. Describe what symptoms you are experiencing in plain terms. Our machine learning and NLP engine will analyze your input to provide a preliminary assessment.
              </p>
            </div>
          ) : (
            chat.map((msg, index) => {
              const isUser = msg.sender === "user";
              return (
                <div key={index} className={`chat-message-row ${isUser ? "user" : "bot"}`}>
                  {isUser ? (
                    <div className="user-bubble">{msg.text}</div>
                  ) : msg.data ? (
                    /* Beautiful Diagnostic Dashboard Card */
                    <div className="bot-bubble-diagnosis">
                      <div className="diagnosis-header">
                        <div className="diagnosis-disease-group">
                          <span className="diagnosis-disease-label">Predicted Disease</span>
                          <span className="diagnosis-disease-name">{msg.data.predicted_disease}</span>
                        </div>
                        <div className="diagnosis-confidence-badge">
                          {msg.data.confidence}% Confidence
                        </div>
                      </div>

                      <div className="diagnosis-body">
                        {/* Severity Indicator */}
                        <div className="severity-pill-row">
                          <span className="severity-pill-label">Assessed Severity:</span>
                          <span className={`severity-badge ${msg.data.severity_level?.toLowerCase() || "mild"}`}>
                            {msg.data.severity_level || "Mild"}
                          </span>
                        </div>

                        {/* Symptoms Tags */}
                        <div className="diagnosis-symptoms-section">
                          <span className="symptoms-section-title">Detected Symptoms:</span>
                          <div className="symptoms-tags-container">
                            {msg.data.detected_symptoms.map((symptom, sIdx) => (
                              <span key={sIdx} className="symptom-tag">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                {symptom.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Follow-up Questions */}
                        {msg.data.followup_questions && msg.data.followup_questions.length > 0 && (
                          <div className="diagnosis-followups-section">
                            <span className="followups-title">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                              </svg>
                              Follow-up Questions:
                            </span>
                            <ul className="followups-list">
                              {msg.data.followup_questions.map((q, qIdx) => (
                                <li key={qIdx} className="followups-item">
                                  <span className="followup-bullet">•</span>
                                  <span>{q}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Disclaimer */}
                      <div className="diagnosis-disclaimer-section">
                        <div className="disclaimer-icon">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="16" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12.01" y2="8"/>
                          </svg>
                        </div>
                        <p className="disclaimer-text">{msg.data.medical_disclaimer}</p>
                      </div>
                    </div>
                  ) : (
                    /* Fallback / Text bot response */
                    <div className="bot-bubble-plain">{msg.text}</div>
                  )}
                </div>
              );
            })
          )}
          {/* Loading Indicator */}
          {isLoading && (
            <div className="loading-row">
              <div className="loading-bubble">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 2s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span>Analyzing symptoms...</span>
                <div className="loading-dots">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input box bottom panel */}
        <div className="input-area-container">
          <div className="input-box-wrapper">
            <input
              type="text"
              placeholder={isLoading ? "Analyzing symptoms, please wait..." : "Describe your symptoms (e.g., I have a mild fever, cough, and body aches)..."}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="chat-text-input"
            />
            <button
              onClick={sendMessage}
              disabled={!message.trim() || isLoading}
              className="send-action-btn"
              title="Send symptoms description"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* Animation styling snippet */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;