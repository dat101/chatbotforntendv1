import React, { useState, useEffect, useRef } from 'react';

const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const [typingStates, setTypingStates] = useState({});
  const [allUserQuestions, setAllUserQuestions] = useState([]);

  const backendUrl = 'https://chatbot-backend-1-ja1c.onrender.com/api/chat';

  const generateSessionId = () => {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  useEffect(() => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
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
    console.log('allUserQuestions:', allUserQuestions);
    const recentQuestions = allUserQuestions.slice(-6).reverse();
    const truncatedMessages = recentQuestions
      .map((text, index) => ({
        original: text,
        truncated: text.length > 20 ? text.substring(0, 17) + '...' : text,
        index
      }))
      .filter((item, index, self) => 
        self.findIndex(t => t.original === item.original) === index
      )
      .map(item => item.truncated);
    console.log('truncatedMessages:', truncatedMessages);
    return truncatedMessages;
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
        } else if (line.startsWith('Điểm nổi bật:')) {
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

  const sendMessage = debounce(async (message, retries = 3) => {
    if (!message.trim() || isTyping || !sessionId) {
      if (!sessionId) {
        setSessionId(generateSessionId());
      }
      return;
    }

    const cleanMessage = message.replace(/[\n\t\r]/g, ' ').trim();
    const limitedMessage = cleanMessage.length > 500 ? cleanMessage.substring(0, 500) + '...' : cleanMessage;

    setAllUserQuestions(prev => {
      const updated = [...prev, limitedMessage];
      return updated.slice(-20);
    });

    const newMessage = { text: limitedMessage, sender: 'user', id: Date.now() };
    setMessages((prev) => [...prev, newMessage]);

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
          setMessages((prev) => [...prev, { 
            locations, 
            sender: 'bot', 
            isTyped: false, 
            id: botMessageId 
          }]);
        } else {
          setMessages((prev) => [...prev, { 
            text: responseText, 
            sender: 'bot', 
            isTyped: false, 
            id: botMessageId 
          }]);
        }
        break;
      } catch (error) {
        if (attempt === retries) {
          setMessages((prev) => [
            ...prev,
            { text: `Lỗi: ${error.message}. Vui lòng thử lại!`, sender: 'bot', isTyped: true, id: Date.now() + 2 },
          ]);
        }
      }
    }
    setIsTyping(false);
  }, 1000);

  const handleSuggestionClick = (suggestion) => {
    console.log('Suggestion clicked:', suggestion);
    const originalMessage = allUserQuestions.find(msg => {
      const truncated = msg.length > 20 ? msg.substring(0, 17) + '...' : msg;
      return truncated === suggestion;
    }) || suggestion;
    console.log('Original message:', originalMessage);
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setInput('');
    setIsTyping(false);
    setTypingStates({});
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setAllUserQuestions(prev => [...prev]);
  };

  const previousQuestions = getPreviousUserQuestions();

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      position: 'relative',
      height: '100vh',
      backgroundColor: '#ffffff'
    }}>
      <button
        aria-label={isChatOpen ? "Đóng chat" : "Mở chat"}
        onClick={() => setIsChatOpen(!isChatOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
          color: 'white',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
          zIndex: 1000,
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.1)';
          e.target.style.boxShadow = '0 12px 35px rgba(0,0,0,0.4)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
        }}
      >
        {isChatOpen ? '✕' : '💬'}
      </button>

      {isChatOpen && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '24px',
          width: '400px',
          height: '600px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            color: 'white',
            padding: '20px',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                Trợ lý Du lịch Khánh Hòa
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                Luôn sẵn sàng hỗ trợ bạn
              </p>
            </div>
            {messages.length > 0 && (
              <button
                aria-label="Làm mới cuộc trò chuyện"
                onClick={resetChat}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.2)';
                }}
              >
                🔄 Làm mới
              </button>
            )}
          </div>

          <div role="log" aria-live="polite" style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            backgroundColor: '#f8f9fa',
            paddingBottom: messages.length === 0 ? '8px' : '16px'
          }}>
            {messages.length === 0 && (
              <div style={{
                textAlign: 'center',
                color: '#6c757d',
                marginTop: '20px'
              }}>
                <p>👋 Xin chào! Tôi có thể giúp bạn tìm hiểu về:</p>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '12px'
                }}>
                  {[
                    { emoji: '🏛️', text: 'văn hóa' },
                    { emoji: '🎉', text: 'sự kiện' },
                    { emoji: '🏖️', text: 'địa điểm du lịch' },
                    { emoji: '🍜', text: 'ẩm thực' },
                    { emoji: '🏥', text: 'y tế' },
                    { emoji: '🚌', text: 'tour du lịch' }
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      aria-label={`Tìm hiểu về ${item.text}`}
                      onClick={() => handleSuggestionClick(`Tôi muốn tìm hiểu về ${item.text}`)}
                      style={{
                        fontSize: '14px',
                        padding: '8px 12px',
                        backgroundColor: 'white',
                        border: '1px solid #dee2e6',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        color: '#495057'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#f8f9fa';
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'white';
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = 'none';
                      }}
                    >
                      {item.emoji} {item.text.charAt(0).toUpperCase() + item.text.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={msg.id || index} style={{
                display: 'flex',
                justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '12px'
              }}>
                {msg.sender === 'user' ? (
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    padding: '12px 16px',
                    borderRadius: '18px 18px 4px 18px',
                    maxWidth: '80%',
                    fontSize: '14px',
                    lineHeight: 1.4
                  }}>
                    {msg.text}
                  </div>
                ) : msg.locations ? (
                  <div style={{
                    background: 'white',
                    border: '1px solid #e9ecef',
                    borderRadius: '18px 18px 18px 4px',
                    maxWidth: '90%',
                    padding: '16px',
                    fontSize: '14px'
                  }}>
                    {msg.isTyped ? (
                      <>
                        <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#495057' }}>
                          Tìm thấy {msg.locations.length} địa điểm:
                        </p>
                        {msg.locations.map((location, locIndex) => (
                          <div key={locIndex} style={{
                            background: '#f8f9fa',
                            border: '1px solid #dee2e6',
                            borderRadius: '12px',
                            padding: '12px',
                            marginBottom: '8px'
                          }}>
                            <h4 style={{ margin: '0 0 8px 0', color: '#343a40', fontSize: '16px' }}>
                              {location.name}
                            </h4>
                            {location.address && (
                              <p style={{ margin: '4px 0', fontSize: '13px', color: '#6c757d' }}>
                                📍 {location.address}
                              </p>
                            )}
                            {location.phone && (
                              <p style={{ margin: '4px 0', fontSize: '13px', color: '#6c757d' }}>
                                📞 {location.phone}
                              </p>
                            )}
                            {location.openingHours && (
                              <p style={{ margin: '4px 0', fontSize: '13px', color: '#6c757d' }}>
                                🕒 {location.openingHours}
                              </p>
                            )}
                            {location.highlights && location.highlights.length > 0 && (
                              <div style={{ margin: '8px 0' }}>
                                <p style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '13px', color: '#495057' }}>
                                  ✨ Điểm nổi bật:
                                </p>
                                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '13px', color: '#6c757d' }}>
                                  {location.highlights.map((highlight, hIndex) => (
                                    <li key={hIndex}>{highlight}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <button
                              aria-label={`Chọn ${location.name}`}
                              onClick={() => handleLocationSelect(location.name)}
                              style={{
                                background: 'linear-gradient(135deg, #28a745, #20c997)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '6px 12px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                marginTop: '8px'
                              }}
                            >
                              Chọn địa điểm này
                            </button>
                          </div>
                        ))}
                        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#6c757d' }}>
                          Bạn muốn chọn địa điểm nào?
                        </p>
                      </>
                    ) : (
                      <div>
                        <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#495057' }}>
                          <TypewriterText
                            text={`Tìm thấy ${msg.locations.length} địa điểm:`}
                            onComplete={() => {
                              setTimeout(() => {
                                setMessages((prev) =>
                                  prev.map((m, i) =>
                                    i === index ? { ...m, isTyped: true } : m
                                  )
                                );
                              }, 1000);
                            }}
                          />
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: 'white',
                    border: '1px solid #e9ecef',
                    borderRadius: '18px 18px 18px 4px',
                    maxWidth: '80%',
                    padding: '12px 16px',
                    fontSize: '14px',
                    lineHeight: 1.4,
                    color: '#495057'
                  }}>
                    {msg.isTyped ? (
                      msg.text
                    ) : (
                      <TypewriterText
                        text={msg.text}
                        onComplete={() => {
                          setMessages((prev) =>
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
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                marginBottom: '12px'
              }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #e9ecef',
                  borderRadius: '18px 18px 18px 4px',
                  padding: '12px 16px'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center'
                  }}>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#6c757d',
                          animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {previousQuestions.length > 0 && (
            <>
              <div style={{
                padding: '8px 16px 4px 16px',
                borderTop: '1px solid #e9ecef',
                fontSize: '11px',
                color: '#6c757d',
                backgroundColor: '#f8f9fa',
                fontWeight: 500
              }}>
                💬 Câu hỏi trước:
              </div>
              <div style={{
                padding: '0 12px 8px 12px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                backgroundColor: '#f8f9fa',
                maxHeight: '60px',
                overflowY: 'auto'
              }}>
                {previousQuestions.slice(0, 8).map((question, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      aria-label={`Gửi lại câu hỏi: ${question}`}
                      tabIndex={0}
                      onClick={() => handleSuggestionClick(question)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSuggestionClick(question)}
                      style={{
                        background: '#fff',
                        border: '1px solid #dee2e6',
                        borderRadius: '10px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        color: '#495057',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                        maxWidth: '100px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: '1.2',
                        height: '22px',
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#e9ecef';
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = '#fff';
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = 'none';
                      }}
                      title={question.endsWith('...') ? 'Nhấn để gửi lại câu hỏi đầy đủ' : question}
                    >
                      {question}
                    </button>
                    <button
                      aria-label={`Xóa câu hỏi: ${question}`}
                      tabIndex={0}
                      onClick={() => handleDeleteQuestion(question)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDeleteQuestion(question)}
                      style={{
                        background: '#fff',
                        border: '1px solid #dee2e6',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        color: '#dc3545',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#dc3545';
                        e.target.style.color = '#fff';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = '#fff';
                        e.target.style.color = '#dc3545';
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{
            padding: '16px',
            borderTop: '1px solid #e9ecef',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{
              fontSize: '11px',
              color: input.length > 450 ? '#dc3545' : '#6c757d',
              textAlign: 'right',
              margin: 0
            }}>
              {input.length}/500
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  const value = e.target.value.replace(/[\n\t\r]/g, ' ');
                  if (value.length <= 500) {
                    setInput(value);
                  }
                }}
                onKeyPress={handleKeyPress}
                placeholder="Nhập tin nhắn... (tối đa 500 ký tự)"
                style={{
                  flex: 1,
                  border: `1px solid ${input.length > 450 ? '#ffc107' : '#dee2e6'}`,
                  borderRadius: '20px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = input.length > 450 ? '#ffc107' : '#667eea';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = input.length > 450 ? '#ffc107' : '#dee2e6';
                }}
              />
              <button
                aria-label="Gửi tin nhắn"
                onClick={handleSubmit}
                disabled={isTyping || !input.trim()}
                style={{
                  background: isTyping || !input.trim() ? '#6c757d' : 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  cursor: isTyping || !input.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes pulse {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
          }
          
          div::-webkit-scrollbar {
            width: 6px;
          }
          
          div::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
          }
          
          div::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 10px;
          }
          
          div::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
          }
        `}
      </style>
    </div>
  );
};

export default App;
