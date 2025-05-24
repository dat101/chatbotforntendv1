import React, { useState, useEffect, useRef } from 'react';

const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const QuickActions = ({ questions, onSelect, onDelete }) => (
  <div className="quick-actions">
    <div className="quick-actions-title">💬 Câu hỏi trước:</div>
    <div className="quick-actions-list">
      {questions.map((question, idx) => (
        <div key={idx} className="quick-action-item">
          <button
            aria-label={`Gửi lại câu hỏi: ${question}`}
            onClick={() => onSelect(question)}
            className="quick-action-button"
            title={question.endsWith('...') ? 'Nhấn để gửi lại câu hỏi đầy đủ' : question}
          >
            {question}
          </button>
          <button
            aria-label={`Xóa câu hỏi: ${question}`}
            onClick={() => onDelete(question)}
            className="quick-action-delete"
          >
            🗑️
          </button>
        </div>
      ))}
    </div>
  </div>
);

const TypewriterText = ({ text, onComplete, delay = 30 }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, delay, onComplete]);

  return <span>{displayText}</span>;
};

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [allUserQuestions, setAllUserQuestions] = useState([]);
  const messagesEndRef = useRef(null);

  const backendUrl = 'https://chatbot-backend-1-ja1c.onrender.com/api/chat';

  const generateSessionId = () => {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  useEffect(() => {
    setSessionId(generateSessionId());
  }, []);

  useEffect(() => {
    return () => sendMessage.cancel();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getPreviousUserQuestions = () => {
    const recentQuestions = allUserQuestions.slice(-6).reverse();
    return recentQuestions
      .map(text => text.length > 20 ? text.substring(0, 17) + '...' : text)
      .filter((item, index, self) => self.indexOf(item) === index);
  };

  const parseResponse = (responseText) => {
    const lines = responseText.split('\n');
    const locations = [];
    let currentLocation = null;

    for (const line of lines) {
      if (line.startsWith('Tìm thấy') || line.startsWith('Bạn muốn chọn') || !line.trim()) {
        continue;
      }

      if (!line.startsWith('Địa chỉ:') && !line.startsWith('Số điện thoại:') && !line.startsWith('Giờ mở cửa:') &&
          !line.startsWith('Bản đồ:') && !line.startsWith('AI Menu:') && !line.startsWith('Điểm nổi bật:') &&
          !line.startsWith('-')) {
        if (currentLocation) {
          locations.push(currentLocation);
        }
        currentLocation = { name: line.trim(), highlights: [] };
      } else if (currentLocation) {
        if (line.startsWith('Địa chỉ:')) {
          currentLocation.address = line.replace('Địa chỉ:', '').trim();
        } else if (line.startsWith('Số điện thoại:')) {
          currentLocation.phone = line.replace('Số điện thoại:', '').trim();
        } else if (line.startsWith('Giờ mở cửa:')) {
          currentLocation.openingHours = line.replace('Giờ mở cửa:', '').trim();
        } else if (line.startsWith('Bản đồ:')) {
          currentLocation.mapLink = line.replace('Bản đồ:', '').trim();
        } else if (line.startsWith('AI Menu:')) {
          currentLocation.aiMenuLink = line.replace('AI Menu:', '').trim();
        } else if (line.startsWith('-')) {
          currentLocation.highlights.push(line.replace('-', '').trim());
        }
      }
    }

    if (currentLocation) {
      locations.push(currentLocation);
    }

    return locations;
  };

  const sendMessage = debounce(async (message, retries = 3) => {
    if (!message.trim() || isTyping || !sessionId) {
      if (!sessionId) {
        setSessionId(generateSessionId());
      }
      return;
    }

    const cleanMessage = message.replace(/[\n\t\r]/g, ' ').trim();
    const limitedMessage = cleanMessage.length > 500 ? cleanMessage.substring(0, 500) + '...' : cleanMessage;

    setAllUserQuestions(prev => [...prev, limitedMessage].slice(-20));
    setMessages(prev => [...prev, { text: limitedMessage, sender: 'user', id: Date.now() }]);
    setInput('');
    setIsTyping(true);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: limitedMessage,
            userId: 'user1',
            sessionId: sessionId
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const responseText = data.response || '';
        const botMessageId = Date.now() + 1;

        if (responseText.includes('Tìm thấy')) {
          const locations = parseResponse(responseText);
          setMessages(prev => [...prev, { 
            locations, 
            sender: 'bot', 
            isTyped: false, 
            id: botMessageId 
          }]);
        } else {
          setMessages(prev => [...prev, { 
            text: responseText, 
            sender: 'bot', 
            isTyped: false, 
            id: botMessageId 
          }]);
        }
        break;
      } catch (error) {
        if (attempt === retries) {
          setMessages(prev => [
            ...prev,
            { text: `Lỗi: ${error.message}. Vui lòng thử lại!`, sender: 'bot', isTyped: true, id: Date.now() + 2 }
          ]);
        }
      }
    }
    setIsTyping(false);
  }, 1000);

  const handleSuggestionClick = (suggestion) => {
    const originalMessage = allUserQuestions.find(msg => {
      const truncated = msg.length > 20 ? msg.substring(0, 17) + '...' : msg;
      return truncated === suggestion;
    }) || suggestion;
    sendMessage(originalMessage);
  };

  const handleDeleteQuestion = (suggestion) => {
    const originalMessage = allUserQuestions.find(msg => {
      const truncated = msg.length > 20 ? msg.substring(0, 17) + '...' : msg;
      return truncated === suggestion;
    }) || suggestion;
    setAllUserQuestions(prev => prev.filter(q => q !== originalMessage));
  };

  const handleLocationSelect = (locationName) => {
    sendMessage(locationName);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const suggestions = [
    { emoji: '🏛️', text: 'văn hóa' },
    { emoji: '🎉', text: 'sự kiện' },
    { emoji: '🏖️', text: 'địa điểm du lịch' },
    { emoji: '🍜', text: 'ẩm thực' },
    { emoji: '🏥', text: 'y tế' },
    { emoji: '🚌', text: 'tour du lịch' }
  ];

  return (
    <div className="app-container">
      <button
        aria-label={isChatOpen ? "Đóng chat" : "Mở chat"}
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="toggle-button"
      >
        {isChatOpen ? '✕' : '💬'}
      </button>

      {isChatOpen && (
        <div className="chat-container">
          <div className="chat-header">
            <div>
              <h3>Trợ lý Du lịch Khánh Hòa</h3>
              <p>Hỗ trợ bạn mọi lúc</p>
            </div>
            {messages.length > 0 && (
              <button
                aria-label="Làm mới cuộc trò chuyện"
                onClick={() => {
                  setMessages([]);
                  setInput('');
                  setIsTyping(false);
                  setSessionId(generateSessionId());
                }}
                className="reset-button"
              >
                🔄 Làm mới
              </button>
            )}
          </div>

          <div className="chat-body">
            {messages.length === 0 && (
              <div className="welcome-message">
                <p>👋 Xin chào! Tôi có thể giúp bạn tìm hiểu về:</p>
                <div className="suggestions">
                  {suggestions.map((item, idx) => (
                    <button
                      key={idx}
                      aria-label={`Tìm hiểu về ${item.text}`}
                      onClick={() => sendMessage(`Tôi muốn tìm hiểu về ${item.text}`)}
                      className="suggestion-button"
                    >
                      {item.emoji} {item.text.charAt(0).toUpperCase() + item.text.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`message ${msg.sender === 'user' ? 'user' : 'bot'}`}
              >
                {msg.sender === 'user' ? (
                  <div className="message-content user">{msg.text}</div>
                ) : msg.locations ? (
                  <div className="message-content bot">
                    {msg.isTyped ? (
                      <>
                        <p className="locations-title">
                          Tìm thấy {msg.locations.length} địa điểm:
                        </p>
                        {msg.locations.map((location, locIndex) => (
                          <div key={locIndex} className="location-card">
                            <h4>{location.name}</h4>
                            {location.address && <p>📍 {location.address}</p>}
                            {location.phone && <p>📞 {location.phone}</p>}
                            {location.openingHours && <p>🕒 {location.openingHours}</p>}
                            {location.highlights && location.highlights.length > 0 && (
                              <div>
                                <p className="highlights-title">✨ Điểm nổi bật:</p>
                                <ul>
                                  {location.highlights.map((highlight, hIndex) => (
                                    <li key={hIndex}>{highlight}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <button
                              aria-label={`Chọn ${location.name}`}
                              onClick={() => handleLocationSelect(location.name)}
                              className="location-button"
                            >
                              Chọn địa điểm này
                            </button>
                          </div>
                        ))}
                        <p className="location-prompt">Bạn muốn chọn địa điểm nào?</p>
                      </>
                    ) : (
                      <p className="locations-title">
                        <TypewriterText
                          text={`Tìm thấy ${msg.locations.length} địa điểm:`}
                          onComplete={() => {
                            setTimeout(() => {
                              setMessages(prev =>
                                prev.map((m, i) =>
                                  i === index ? { ...m, isTyped: true } : m
                                )
                              );
                            }, 1000);
                          }}
                        />
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="message-content bot">
                    {msg.isTyped ? (
                      msg.text
                    ) : (
                      <TypewriterText
                        text={msg.text}
                        onComplete={() => {
                          setMessages(prev =>
                            prev.map((m, i) =>
                              i === index ? { ...m, isTyped: true } : m
                            )
                          );
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="message bot">
                <div className="message-content bot">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {getPreviousUserQuestions().length > 0 && (
            <QuickActions
              questions={getPreviousUserQuestions()}
              onSelect={handleSuggestionClick}
              onDelete={handleDeleteQuestion}
            />
          )}

          <div className="chat-footer">
            <div className="char-count">
              {input.length}/500 {input.length > 450 && <span>(gần giới hạn)</span>}
            </div>
            <div className="input-group">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  const value = e.target.value.replace(/[\n\t\r]/g, ' ');
                  if (value.length <= 500) setInput(value);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Nhập tin nhắn... (tối đa 500 ký tự)"
                className="chat-input"
              />
              <button
                aria-label="Gửi tin nhắn"
                onClick={handleSubmit}
                disabled={isTyping || !input.trim()}
                className="send-button"
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          .app-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            height: 100vh;
            background: #f5f5f5;
            position: relative;
            overflow: hidden;
          }

          .toggle-button {
            position: fixed;
            bottom: 1.5rem;
            right: 1.5rem;
            width: 3.5rem;
            height: 3.5rem;
            border-radius: 50%;
            border: none;
            background: linear-gradient(135deg, #ff6b6b, #ff8e53);
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            box-shadow: 0 6px 20px rgba(0,0,0,0.2);
            transition: transform 0.3s, box-shadow 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .toggle-button:hover {
            transform: scale(1.1);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
          }

          .chat-container {
            position: fixed;
            bottom: 5.5rem;
            right: 1.5rem;
            width: 100%;
            max-width: 380px;
            height: 550px;
            background: white;
            border-radius: 1.5rem;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
            animation: slide-up 0.3s ease-out;
            z-index: 999;
          }
          @media (max-width: 480px) {
            .chat-container {
              max-width: 340px;
              height: 480px;
              bottom: 5rem;
            }
          }

          .chat-header {
            background: linear-gradient(135deg, #6b7280, #4b5563);
            color: white;
            padding: 1rem 1.5rem;
            border-top-left-radius: 1.5rem;
            border-top-right-radius: 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .chat-header h3 {
            margin: 0;
            font-size: 1.125rem;
            font-weight: 600;
          }
          .chat-header p {
            margin: 0.25rem 0 0;
            font-size: 0.75rem;
            opacity: 0.9;
          }
          .reset-button {
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 0.5rem;
            color: white;
            padding: 0.25rem 0.75rem;
            font-size: 0.75rem;
            cursor: pointer;
            transition: background 0.2s;
          }
          .reset-button:hover {
            background: rgba(255,255,255,0.25);
          }

          .chat-body {
            flex: 1;
            padding: 1rem;
            overflow-y: auto;
            background: #fafafa;
          }
          .chat-body::-webkit-scrollbar {
            width: 5px;
          }
          .chat-body::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
          }
          .chat-body::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 10px;
          }
          .chat-body::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
          }

          .welcome-message {
            text-align: center;
            color: #4b5563;
            margin-top: 1rem;
          }
          .welcome-message p {
            font-size: 0.875rem;
            margin: 0 0 0.75rem;
          }
          .suggestions {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
          .suggestion-button {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 0.75rem;
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
            color: #374151;
            cursor: pointer;
            transition: all 0.2s;
          }
          .suggestion-button:hover {
            background: #f3f4f6;
            transform: translateY(-1px);
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          }

          .message {
            display: flex;
            margin-bottom: 0.75rem;
          }
          .message.user {
            justify-content: flex-end;
          }
          .message.bot {
            justify-content: flex-start;
          }
          .message-content {
            max-width: 80%;
            padding: 0.75rem 1rem;
            border-radius: 1rem;
            font-size: 0.875rem;
            line-height: 1.4;
          }
          .message-content.user {
            background: linear-gradient(135deg, #7c3aed, #db2777);
            color: white;
            border-bottom-right-radius: 0.25rem;
          }
          .message-content.bot {
            background: white;
            border: 1px solid #e5e7eb;
            border-bottom-left-radius: 0.25rem;
            color: #374151;
          }

          .locations-title {
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 0.75rem;
          }
          .location-card {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 0.75rem;
            padding: 0.75rem;
            margin-bottom: 0.5rem;
          }
          .location-card h4 {
            margin: 0 0 0.5rem;
            font-size: 1rem;
            color: #1f2937;
          }
          .location-card p {
            margin: 0.125rem 0;
            font-size: 0.75rem;
            color: #6b7280;
          }
          .highlights-title {
            font-weight: 600;
            font-size: 0.75rem;
            color: #374151;
            margin: 0.5rem 0 0.25rem;
          }
          .location-card ul {
            margin: 0;
            padding-left: 1rem;
            font-size: 0.75rem;
            color: #6b7280;
          }
          .location-button {
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: white;
            border: none;
            border-radius: 0.5rem;
            padding: 0.25rem 0.75rem;
            font-size: 0.75rem;
            cursor: pointer;
            margin-top: 0.5rem;
            transition: background 0.2s;
          }
          .location-button:hover {
            background: linear-gradient(135deg, #16a34a, #15803d);
          }
          .location-prompt {
            font-size: 0.75rem;
            color: #6b7280;
            margin: 0.5rem 0 0;
          }

          .typing-indicator {
            display: flex;
            gap: 0.25rem;
            align-items: center;
          }
          .typing-indicator span {
            width: 0.5rem;
            height: 0.5rem;
            border-radius: 50%;
            background: #6b7280;
            animation: pulse 1.4s ease-in-out infinite;
          }
          .typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
          }
          .typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
          }

          .quick-actions {
            background: #f3f4f6;
            padding: 0.25rem 0.75rem;
            border-top: 1px solid #e5e7eb;
          }
          .quick-actions-title {
            font-size: 0.6875rem;
            color: #6b7280;
            font-weight: 500;
            margin-bottom: 0.25rem;
          }
          .quick-actions-list {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
            max-height: 2.5rem;
            overflow-y: auto;
          }
          .quick-actions-list::-webkit-scrollbar {
            width: 4px;
          }
          .quick-actions-list::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
          }
          .quick-actions-list::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 10px;
          }
          .quick-actions-list::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
          }
          .quick-action-item {
            display: flex;
            align-items: center;
            gap: 0.25rem;
          }
          .quick-action-button {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            padding: 0.125rem 0.5rem;
            font-size: 0.6875rem;
            color: #374151;
            cursor: pointer;
            transition: all 0.15s;
            max-width: 5rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            line-height: 1.2;
            height: 1.25rem;
            display: flex;
            align-items: center;
          }
          .quick-action-button:hover {
            background: #f3f4f6;
            transform: translateY(-1px);
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
          }
          .quick-action-delete {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 50%;
            width: 1.125rem;
            height: 1.125rem;
            font-size: 0.625rem;
            color: #ef4444;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s;
          }
          .quick-action-delete:hover {
            background: #ef4444;
            color: white;
          }

          .chat-footer {
            padding: 0.75rem;
            background: white;
            border-top: 1px solid #e5e7eb;
          }
          .char-count {
            font-size: 0.6875rem;
            color: #6b7280;
            text-align: right;
            margin-bottom: 0.25rem;
          }
          .char-count span {
            color: #ef4444;
          }
          .input-group {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
          }
          .chat-input {
            flex: 1;
            border: 1px solid #e5e7eb;
            border-radius: 1.5rem;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            outline: none;
            transition: border-color 0.2s;
            min-width: 120px;
          }
          .chat-input:focus {
            border-color: #7c3aed;
          }
          .chat-input[aria-invalid="true"] {
            border-color: #facc15;
          }
          .send-button {
            background: linear-gradient(135deg, #7c3aed, #db2777);
            color: white;
            border: none;
            border-radius: 1.5rem;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            cursor: pointer;
            transition: background 0.2s;
            white-space: nowrap;
          }
          .send-button:disabled {
            background: #9ca3af;
            cursor: not-allowed;
          }
          .send-button:not(:disabled):hover {
            background: linear-gradient(135deg, #6d28d9, #c026d3);
          }

          @keyframes slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
          }

          @media (max-width: 480px) {
            .toggle-button {
              bottom: 1rem;
              right: 1rem;
              width: 3rem;
              height: 3rem;
              font-size: 1.25rem;
            }
            .chat-header {
              padding: 0.75rem 1rem;
            }
            .chat-body {
              padding: 0.75rem;
            }
            .chat-footer {
              padding: 0.5rem;
            }
            .chat-input {
              min-width: 100px;
            }
          }
        `}
      </style>
    </div>
  );
};

export default App;
