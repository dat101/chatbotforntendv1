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

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000/api/chat';
  if (!process.env.REACT_APP_BACKEND_URL) {
    console.warn('Warning: REACT_APP_BACKEND_URL is not defined. Using fallback: http://localhost:3000/api/chat');
  }

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
      if (!sessionId) setSessionId(generateSessionId());
      return;
    }

    const cleanMessage = message.replace(/[\n\t\r]/g, ' ').trim();
    const limitedMessage = cleanMessage.length > 500 ? cleanMessage.substring(0, 500) + '...' : cleanMessage;

    setAllUserQuestions(prev => [...prev, limitedMessage]);
    setMessages((prev) => [...prev, { text: limitedMessage, sender: 'user', id: Date.now() }]);
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
            sessionId
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
      backgroundColor: '#ffffff',
      overflow: 'hidden'
    }}>
      <button
        aria-label={isChatOpen ? "Đóng chat" : "Mở chat"}
        onClick={() => setIsChatOpen(!isChatOpen)}
        style={{
          position: 'fixed',
          bottom: '2vh',
          right: '2vw',
          width: 'clamp(50px, 10vw, 60px)',
          height: 'clamp(50px, 10vw, 60px)',
          borderRadius: '50%',
          border: 'none',
          background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
          color: 'white',
          fontSize: 'clamp(22px, 4.5vw, 26px)',
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
        <div className={`chat-box ${previousQuestions.length === 0 ? 'no-quick-actions' : ''}`} style={{
          position: 'fixed',
          bottom: 'calc(2vh + clamp(50px, 10vw, 60px) + 1vh)',
          right: '2vw',
          width: 'clamp(300px, 90vw, 420px)',
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
            padding: 'clamp(10px, 2.5vw, 14px)',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ 
                margin: 0, 
                fontSize: 'clamp(16px, 3vw, 18px)', 
                fontWeight: 600 
              }}>
                Trợ lý Du lịch Khánh Hòa
              </h3>
              <p style={{ 
                margin: '4px 0 0 0', 
                fontSize: 'clamp(12px, 2.5vw, 14px)', 
                opacity: 0.9 
              }}>
                Luôn sẵn sàng hỗ trợ bạn
              </p>
            </div>
            <div style={{
              width: 'clamp(32px, 6vw, 36px)',
              height: 'clamp(32px, 6vw, 36px)'
            }}>
              <img 
                src="https://travelwithfnb.vn/wp-content/uploads/2025/04/z6437356296263_1d47f2fae248475a8350d2daf5bc858d-removebg-preview.png" 
                alt="Logo Trợ lý Du lịch Khánh Hòa" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain' 
                }} 
              />
            </div>
          </div>

          <div role="log" aria-live="polite" style={{
            flex: 1,
            padding: 'clamp(8px, 2vw, 12px)',
            overflowY: 'auto',
            backgroundColor: '#f8f9fa',
            paddingBottom: messages.length === 0 ? '6px' : 'clamp(8px, 2vw, 12px)',
            position: 'relative'
          }}>
            {messages.length === 0 && (
              <div style={{
                textAlign: 'center',
                color: '#6c757d',
                marginTop: 'clamp(8px, 2vw, 12px)'
              }}>
                <p style={{ fontSize: 'clamp(14px, 2.8vw, 16px)' }}>
                  👋 Xin chào! Tôi có thể giúp bạn tìm hiểu về:
                </p>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'clamp(4px, 1vw, 6px)',
                  marginTop: 'clamp(6px, 1.5vw, 8px)'
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
                        fontSize: 'clamp(12px, 2.5vw, 14px)',
                        padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 10px)',
                        backgroundColor: 'white',
                        border: '1px solid #dee2e6',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        color: '#495057',
                        minHeight: 'clamp(32px, 7vw, 36px)'
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
                marginBottom: 'clamp(6px, 1.5vw, 8px)'
              }}>
                {msg.sender === 'user' ? (
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 14px)',
                    borderRadius: '16px 16px 4px 16px',
                    maxWidth: '80%',
                    fontSize: 'clamp(12px, 2.5vw, 14px)',
                    lineHeight: 1.4
                  }}>
                    {msg.text}
                  </div>
                ) : msg.locations ? (
                  <div style={{
                    background: 'white',
                    border: '1px solid #e9ecef',
                    borderRadius: '16px 16px 16px 4px',
                    maxWidth: '90%',
                    padding: 'clamp(8px, 2vw, 12px)',
                    fontSize: 'clamp(12px, 2.5vw, 14px)'
                  }}>
                    {msg.isTyped ? (
                      <>
                        <p style={{ 
                          margin: '0 0 clamp(6px, 1.5vw, 8px) 0', 
                          fontWeight: 600, 
                          color: '#495057' 
                        }}>
                          Tìm thấy {msg.locations.length} địa điểm:
                        </p>
                        {msg.locations.map((location, locIndex) => (
                          <div key={locIndex} style={{
                            background: '#f8f9fa',
                            border: '1px solid #dee2e6',
                            borderRadius: '10px',
                            padding: 'clamp(6px, 1.5vw, 8px)',
                            marginBottom: 'clamp(4px, 1vw, 6px)'
                          }}>
                            <h4 style={{ 
                              margin: '0 0 clamp(4px, 1vw, 6px) 0', 
                              color: '#343a40', 
                              fontSize: 'clamp(14px, 3vw, 16px)' 
                            }}>
                              {location.name}
                            </h4>
                            {location.address && (
                              <p style={{ 
                                margin: 'clamp(1px, 0.3vw, 2px) 0', 
                                fontSize: 'clamp(11px, 2.3vw, 13px)', 
                                color: '#6c757d' 
                              }}>
                                📍 {location.address}
                              </p>
                            )}
                            {location.phone && (
                              <p style={{ 
                                margin: 'clamp(1px, 0.3vw, 2px) 0', 
                                fontSize: 'clamp(11px, 2.3vw, 13px)', 
                                color: '#6c757d' 
                              }}>
                                📞 {location.phone}
                              </p>
                            )}
                            {location.openingHours && (
                              <p style={{ 
                                margin: 'clamp(1px, 0.3vw, 2px) 0', 
                                fontSize: 'clamp(11px, 2.3vw, 13px)', 
                                color: '#6c757d' 
                              }}>
                                🕒 {location.openingHours}
                              </p>
                            )}
                            {location.highlights && location.highlights.length > 0 && (
                              <div style={{ margin: 'clamp(4px, 1vw, 6px) 0' }}>
                                <p style={{ 
                                  margin: '0 0 clamp(1px, 0.3vw, 2px) 0', 
                                  fontWeight: 600, 
                                  fontSize: 'clamp(11px, 2.3vw, 13px)', 
                                  color: '#495057' 
                                }}>
                                  ✨ Điểm nổi bật:
                                </p>
                                <ul style={{ 
                                  margin: 0, 
                                  paddingLeft: 'clamp(8px, 2vw, 12px)', 
                                  fontSize: 'clamp(11px, 2.3vw, 13px)', 
                                  color: '#6c757d' 
                                }}>
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
                                padding: 'clamp(5px, 1.2vw, 7px) clamp(8px, 2vw, 10px)',
                                fontSize: 'clamp(11px, 2.3vw, 13px)',
                                cursor: 'pointer',
                                marginTop: 'clamp(4px, 1vw, 6px)'
                              }}
                            >
                              Chọn địa điểm này
                            </button>
                          </div>
                        ))}
                        <p style={{ 
                          margin: 'clamp(4px, 1vw, 6px) 0 0 0', 
                          fontSize: 'clamp(11px, 2.3vw, 13px)', 
                          color: '#6c757d' 
                        }}>
                          Bạn muốn chọn địa điểm nào?
                        </p>
                      </>
                    ) : (
                      <div>
                        <p style={{ 
                          margin: '0 0 clamp(6px, 1.5vw, 8px) 0', 
                          fontWeight: 600, 
                          color: '#495057' 
                        }}>
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
                    borderRadius: '16px 16px 16px 4px',
                    maxWidth: '80%',
                    padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 14px)',
                    fontSize: 'clamp(12px, 2.5vw, 14px)',
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
                marginBottom: 'clamp(6px, 1.5vw, 8px)'
              }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #e9ecef',
                  borderRadius: '16px 16px 16px 4px',
                  padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 14px)'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: 'clamp(4px, 1vw, 6px)',
                    alignItems: 'center'
                  }}>
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          width: 'clamp(6px, 1.5vw, 8px)',
                          height: 'clamp(6px, 1.5vw, 8px)',
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
            {messages.length > 0 && (
              <div style={{
                position: 'sticky',
                bottom: 0,
                backgroundColor: '#f8f9fa',
                zIndex: 10,
                padding: 'clamp(8px, 2vw, 12px) 0',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <button
                  aria-label="Làm mới cuộc trò chuyện"
                  onClick={resetChat}
                  style={{
                    background: 'linear-gradient(45deg, #667eea, #764ba2)',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'white',
                    padding: 'clamp(8px, 1.5vw, 10px) clamp(12px, 2.5vw, 14px)',
                    fontSize: 'clamp(11px, 2.3vw, 13px)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                  }}
                >
                  🔄 Làm mới
                </button>
              </div>
            )}
          </div>

          {previousQuestions.length > 0 && (
            <div style={{
              backgroundColor: '#f8f9fa',
              borderTop: '1px solid #e9ecef'
            }}>
              <div style={{
                padding: 'clamp(4px, 1vw, 6px) clamp(8px, 2vw, 10px) clamp(2px, 0.5vw, 4px)',
                fontSize: 'clamp(11px, 2.3vw, 13px)',
                color: '#6c757d',
                fontWeight: 500
              }}>
                💬 Câu hỏi trước:
              </div>
              <div style={{
                padding: '0 clamp(6px, 1.5vw, 8px) clamp(4px, 1vw, 6px)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'clamp(3px, 0.8vw, 5px)',
                maxHeight: 'clamp(35px, 10vw, 45px)',
                overflowY: 'auto'
              }}>
                {previousQuestions.slice(0, 8).map((question, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 'clamp(3px, 0.8vw, 5px)' 
                  }}>
                    <button
                      aria-label={`Gửi lại câu hỏi: ${question}`}
                      tabIndex={0}
                      onClick={() => handleSuggestionClick(question)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSuggestionClick(question)}
                      style={{
                        background: '#fff',
                        border: '1px solid #dee2e6',
                        borderRadius: '10px',
                        padding: 'clamp(3px, 0.8vw, 5px) clamp(6px, 1.5vw, 8px)',
                        fontSize: 'clamp(11px, 2.3vw, 13px)',
                        cursor: 'pointer',
                        color: '#495057',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                        maxWidth: 'clamp(80px, 24vw, 100px)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: '1.4',
                        height: 'clamp(18px, 4.5vw, 22px)',
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
                        width: 'clamp(16px, 3.5vw, 20px)',
                        height: 'clamp(16px, 3.5vw, 20px)',
                        fontSize: 'clamp(9px, 2vw, 11px)',
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
            </div>
          )}

          <div style={{
            padding: 'clamp(8px, 2vw, 12px)',
            backgroundColor: '#ffffff',
            borderTop: previousQuestions.length === 0 ? 'none' : '1px solid #e9ecef'
          }}>
            <div style={{
              fontSize: 'clamp(11px, 2.3vw, 13px)',
              color: input.length > 450 ? '#dc3545' : '#6c757d',
              textAlign: 'right',
              marginBottom: 'clamp(4px, 1vw, 6px)'
            }}>
              {input.length}/500
            </div>
            <div style={{ 
              display: 'flex', 
              gap: 'clamp(4px, 1vw, 6px)',
              flexWrap: 'wrap' 
            }}>
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
                  borderRadius: 'clamp(12px, 3vw, 16px)',
                  padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 14px)',
                  fontSize: 'clamp(12px, 2.5vw, 14px)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  minWidth: '160px'
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
                  borderRadius: 'clamp(12px, 3vw, 16px)',
                  padding: 'clamp(6px, 1.5vw, 8px) clamp(10px, 2.5vw, 14px)',
                  fontSize: 'clamp(12px, 2.5vw, 14px)',
                  cursor: isTyping || !input.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  minWidth: 'clamp(60px, 15vw, 80px)'
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
            width: clamp(4px, 1vw, 6px);
          }
          
          div::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 8px;
          }
          
          div::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 8px;
          }
          
          div::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
          }

          .chat-box {
            height: clamp(400px, 75vh, 520px);
          }
          .no-quick-actions {
            height: clamp(370px, 70vh, 480px);
          }

          @media (max-width: 1024px) {
            .chat-box {
              height: clamp(360px, 80vh, 500px);
            }
            .no-quick-actions {
              height: clamp(340px, 75vh, 480px);
            }
          }

          @media (max-width: 767px) {
            button[aria-label="Đóng chat"], button[aria-label="Mở chat"] {
              bottom: 1vh;
              right: 1vw;
              width: clamp(48px, 12vw, 56px);
              height: clamp(48px, 12vw, 56px);
              font-size: clamp(20px, 5vw, 24px);
            }
            .chat-box {
              bottom: calc(1vh + clamp(48px, 12vw, 56px) + 0.5vh);
              right: 1vw;
              width: clamp(280px, 95vw, 380px);
              height: clamp(330px, 85vh, 460px);
            }
            .no-quick-actions {
              height: clamp(320px, 80vh, 440px);
            }
            div[style*="padding: clamp(8px, 2vw, 12px); background-color: #ffffff"] {
              padding: clamp(6px, 1.5vw, 10px);
            }
            div[style*="margin-top: clamp(8px, 2vw, 12px)"] {
              margin-top: clamp(6px, 1.5vw, 10px);
            }
            p[style*="font-size: clamp(14px, 2.8vw, 16px)"] {
              font-size: clamp(13px, 3vw, 15px);
            }
            button[style*="font-size: clamp(12px, 2.5vw, 14px)"] {
              font-size: clamp(11px, 2.8vw, 13px);
              padding: clamp(5px, 1.2vw, 7px) clamp(6px, 1.5vw, 8px);
              min-height: clamp(28px, 6vw, 32px);
            }
            input[style*="font-size: clamp(12px, 2.5vw, 14px)"] {
              font-size: clamp(11px, 2.8vw, 13px);
              padding: clamp(5px, 1.2vw, 7px) clamp(8px, 2vw, 12px);
              min-width: 140px;
            }
            button[aria-label="Gửi tin nhắn"] {
              font-size: clamp(11px, 2.8vw, 13px);
              padding: clamp(5px, 1.2vw, 7px) clamp(8px, 2vw, 12px);
              min-width: clamp(56px, 14vw, 72px);
            }
          }

          @media (max-width: 479px) {
            button[aria-label="Đóng chat"], button[aria-label="Mở chat"] {
              bottom: 0.5vh;
              right: 0.5vw;
              width: clamp(44px, 14vw, 52px);
              height: clamp(44px, 14vw, 52px);
              font-size: clamp(18px, 5.5vw, 22px);
            }
            .chat-box {
              bottom: calc(0.5vh + clamp(44px, 14vw, 52px) + 0.3vh);
              right: 0.5vw;
              width: clamp(260px, 96vw, 340px);
              height: clamp(330px, 90vh, 420px);
            }
            .no-quick-actions {
              height: clamp(280px, 85vh, 400px);
            }
            div[style*="flex: 1; padding: clamp(8px, 2vw, 12px)"] {
              padding: clamp(6px, 1.5vw, 10px);
            }
            div[style*="padding: clamp(8px, 2vw, 12px); background-color: #ffffff"] {
              padding: clamp(6px, 1.5vw, 10px);
            }
            div[style*="margin-top: clamp(8px, 2vw, 12px)"] {
              margin-top: clamp(6px, 1.5vw, 10px);
            }
            p[style*="font-size: clamp(14px, 2.8vw, 16px)"] {
              font-size: clamp(12px, 3.5vw, 14px);
            }
            button[style*="font-size: clamp(12px, 2.5vw, 14px)"] {
              font-size: clamp(11px, 3vw, 13px);
              padding: clamp(4px, 1vw, 6px) clamp(6px, 1.5vw, 8px);
              min-height: clamp(26px, 5.5vw, 30px);
            }
            input[style*="font-size: clamp(12px, 2.5vw, 14px)"] {
              font-size: clamp(11px, 3vw, 13px);
              padding: clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px);
              min-width: 120px;
            }
            button[aria-label="Gửi tin nhắn"] {
              font-size: clamp(11px, 3vw, 13px);
              padding: clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px);
              min-width: clamp(52px, 14vw, 68px);
            }
            div[style*="height: clamp(18px, 4.5vw, 22px)"] {
              height: clamp(16px, 4vw, 20px);
            }
            button[style*="font-size: clamp(11px, 2.3vw, 13px)"] {
              font-size: clamp(10px, 2.8vw, 12px);
              padding: clamp(3px, 0.8vw, 5px) clamp(5px, 1.2vw, 7px);
            }
            button[style*="width: clamp(16px, 3.5vw, 20px)"] {
              width: clamp(14px, 3vw, 18px);
              height: clamp(14px, 3vw, 18px);
              font-size: clamp(8px, 1.8vw, 10px);
            }
          }
        `}
      </style>
    </div>
  );
};

export default App;
