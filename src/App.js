import React, { useState, useEffect, useRef, useCallback } from 'react';

const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
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

  const sendMessage = useCallback(
    debounce(async (message, retries = 3) => {
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
    }, 1000),
    [sessionId, isTyping]
  );

  useEffect(() => {
    return () => sendMessage.cancel();
  }, [sendMessage]);

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
  const hasQuickActions = previousQuestions.length > 0 || messages.length === 0;

  return (
    <div className="font-sans relative h-screen bg-white overflow-hidden">
      <button
        aria-label={isChatOpen ? "Đóng chat" : "Mở chat"}
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-[2vh] right-[2vw] w-[clamp(50px,10vw,60px)] h-[clamp(50px,10vw,60px)] rounded-full border-none bg-gradient-to-br from-[#ff6b6b] to-[#ee5a24] text-white text-[clamp(20px,4vw,24px)] cursor-pointer shadow-lg z-[1000] transition-all duration-300 flex items-center justify-center hover:scale-110 hover:shadow-xl"
      >
        {isChatOpen ? '✕' : '💬'}
      </button>

      {isChatOpen && (
        <div
          className={`fixed bottom-[calc(2vh+clamp(50px,10vw,60px)+1vh)] right-[2vw] w-[clamp(280px,90vw,400px)] ${
            hasQuickActions ? 'h-[clamp(400px,80vh,600px)]' : 'h-[clamp(300px,60vh,450px)]'
          } bg-white rounded-2xl shadow-2xl z-[999] flex flex-col overflow-hidden animate-slideUp`}
        >
          <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white p-[clamp(12px,3vw,20px)] rounded-t-2xl flex justify-between items-center">
            <div>
              <h3 className="m-0 text-[clamp(16px,3vw,18px)] font-semibold">
                Trợ lý Du lịch Khánh Hòa
              </h3>
              <p className="mt-1 text-[clamp(12px,2.5vw,14px)] opacity-90">
                Luôn sẵn sàng hỗ trợ bạn
              </p>
            </div>
            {messages.length > 0 && (
              <button
                aria-label="Làm mới cuộc trò chuyện"
                onClick={resetChat}
                className="bg-white/20 border border-white/30 rounded-lg text-white px-[clamp(8px,2vw,12px)] py-[clamp(4px,1vw,6px)] text-[clamp(10px,2vw,12px)] cursor-pointer hover:bg-white/30 transition-all duration-200"
              >
                🔄 Làm mới
              </button>
            )}
          </div>

          <div
            role="log"
            aria-live="polite"
            className="flex-1 p-[clamp(12px,3vw,16px)] overflow-y-auto bg-gray-100 custom-scrollbar"
            style={{ paddingBottom: messages.length === 0 ? '8px' : 'clamp(12px,3vw,16px)' }}
          >
            {messages.length === 0 && (
              <div className="text-center text-gray-600 mt-[clamp(16px,4vw,20px)]">
                <p className="text-[clamp(14px,3vw,16px)]">
                  👋 Xin chào! Tôi có thể giúp bạn tìm hiểu về:
                </p>
                <div className="flex flex-col gap-[clamp(6px,1.5vw,8px)] mt-[clamp(8px,2vw,12px)]">
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
                      className="text-[clamp(12px,2.5vw,14px)] p-[clamp(6px,1.5vw,8px)_clamp(8px,2vw,12px)] bg-white border border-gray-200 rounded-xl cursor-pointer text-gray-800 hover:bg-gray-50 hover:-translate-y-[1px] hover:shadow-md transition-all duration-200"
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
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-[clamp(8px,2vw,12px)]`}
              >
                {msg.sender === 'user' ? (
                  <div className="bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white p-[clamp(8px,2vw,12px)_clamp(12px,3vw,16px)] rounded-[18px_18px_4px_18px] max-w-[80%] text-[clamp(12px,2.5vw,14px)] leading-relaxed">
                    {msg.text}
                  </div>
                ) : msg.locations ? (
                  <div className="bg-white border border-gray-200 rounded-[18px_18px_18px_4px] max-w-[90%] p-[clamp(12px,3vw,16px)] text-[clamp(12px,2.5vw,14px)]">
                    {msg.isTyped ? (
                      <>
                        <p className="m-0 mb-[clamp(8px,2vw,12px)] font-semibold text-gray-800">
                          Tìm thấy {msg.locations.length} địa điểm:
                        </p>
                        {msg.locations.map((location, locIndex) => (
                          <div
                            key={locIndex}
                            className="bg-gray-50 border border-gray-200 rounded-xl p-[clamp(8px,2vw,12px)] mb-[clamp(6px,1.5vw,8px)]"
                          >
                            <h4 className="m-0 mb-[clamp(6px,1.5vw,8px)] text-[clamp(14px,3vw,16px)] text-gray-900">
                              {location.name}
                            </h4>
                            {location.address && (
                              <p className="m-[clamp(2px,0.5vw,4px)_0] text-[clamp(11px,2.2vw,13px)] text-gray-600">
                                📍 {location.address}
                              </p>
                            )}
                            {location.phone && (
                              <p className="m-[clamp(2px,0.5vw,4px)_0] text-[clamp(11px,2.2vw,13px)] text-gray-600">
                                📞 {location.phone}
                              </p>
                            )}
                            {location.openingHours && (
                              <p className="m-[clamp(2px,0.5vw,4px)_0] text-[clamp(11px,2.2vw,13px)] text-gray-600">
                                🕒 {location.openingHours}
                              </p>
                            )}
                            {location.highlights && location.highlights.length > 0 && (
                              <div className="mt-[clamp(6px,1.5vw,8px)]">
                                <p className="m-0 mb-[clamp(2px,0.5vw,4px)] font-semibold text-[clamp(11px,2.2vw,13px)] text-gray-800">
                                  ✨ Điểm nổi bật:
                                </p>
                                <ul className="m-0 pl-[clamp(12px,3vw,16px)] text-[clamp(11px,2.2vw,13px)] text-gray-600">
                                  {location.highlights.map((highlight, hIndex) => (
                                    <li key={hIndex}>{highlight}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <button
                              aria-label={`Chọn ${location.name}`}
                              onClick={() => handleLocationSelect(location.name)}
                              className="mt-[clamp(6px,1.5vw,8px)] bg-gradient-to-br from-green-500 to-teal-400 text-white border-none rounded-lg px-[clamp(8px,2vw,12px)] py-[clamp(4px,1vw,6px)] text-[clamp(10px,2vw,12px)] cursor-pointer"
                            >
                              Chọn địa điểm này
                            </button>
                          </div>
                        ))}
                        <p className="mt-[clamp(6px,1.5vw,8px)] text-[clamp(11px,2.2vw,13px)] text-gray-600">
                          Bạn muốn chọn địa điểm nào?
                        </p>
                      </>
                    ) : (
                      <div>
                        <p className="m-0 mb-[clamp(8px,2vw,12px)] font-semibold text-gray-800">
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
                  <div className="bg-white border border-gray-200 rounded-[18px_18px_18px_4px] max-w-[80%] p-[clamp(8px,2vw,12px)_clamp(12px,3vw,16px)] text-[clamp(12px,2.5vw,14px)] leading-relaxed text-gray-800">
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
              <div className="flex justify-start mb-[clamp(8px,2vw,12px)]">
                <div className="bg-white border border-gray-200 rounded-[18px_18px_18px_4px] p-[clamp(8px,2vw,12px)_clamp(12px,3vw,16px)]">
                  <div className="flex gap-[clamp(3px,0.8vw,4px)] items-center">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-[clamp(6px,1.5vw,8px)] h-[clamp(6px,1.5vw,8px)] rounded-full bg-gray-600 animate-pulse"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {previousQuestions.length > 0 && (
            <div className="bg-gray-100 border-t border-gray-200">
              <div className="p-[clamp(6px,1.5vw,8px)_clamp(12px,3vw,16px)_clamp(2px,0.5vw,4px)] text-[clamp(10px,2vw,11px)] text-gray-600 font-medium">
                💬 Câu hỏi trước:
              </div>
              <div className="p-[0_clamp(8px,2vw,12px)_clamp(6px,1.5vw,8px)] flex flex-wrap gap-[clamp(3px,0.8vw,4px)] max-h-[clamp(50px,15vw,60px)] overflow-y-auto custom-scrollbar">
                {previousQuestions.slice(0, 8).map((question, idx) => (
                  <div key={idx} className="flex items-center gap-[clamp(3px,0.8vw,4px)]">
                    <button
                      aria-label={`Gửi lại câu hỏi: ${question}`}
                      onClick={() => handleSuggestionClick(question)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSuggestionClick(question)}
                      className="bg-white border border-gray-200 rounded-[10px] px-[clamp(6px,1.5vw,8px)] py-[clamp(3px,0.8vw,4px)] text-[clamp(10px,2vw,11px)] cursor-pointer text-gray-800 hover:bg-gray-200 hover:-translate-y-[1px] hover:shadow-sm transition-all duration-150 whitespace-nowrap max-w-[clamp(80px,25vw,100px)] overflow-hidden text-ellipsis leading-[1.2] h-[clamp(18px,5vw,22px)] flex items-center flex-shrink-0"
                      title={question.endsWith('...') ? 'Nhấn để gửi lại câu hỏi đầy đủ' : question}
                    >
                      {question}
                    </button>
                    <button
                      aria-label={`Xóa câu hỏi: ${question}`}
                      onClick={() => handleDeleteQuestion(question)}
                      onKeyDown={(e) => e.key === 'Enter' && handleDeleteQuestion(question)}
                      className="bg-white border border-gray-200 rounded-full w-[clamp(16px,4vw,20px)] h-[clamp(16px,4vw,20px)] text-[clamp(8px,2vw,10px)] cursor-pointer text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-all duration-150"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`p-[clamp(12px,3vw,16px)] bg-white ${previousQuestions.length > 0 ? '' : 'border-t border-gray-200'}`}>
            <div className={`text-right mb-[clamp(6px,1.5vw,8px)] text-[clamp(10px,2vw,11px)] ${input.length > 450 ? 'text-red-600' : 'text-gray-600'}`}>
              {input.length}/500
            </div>
            <div className="flex gap-[clamp(6px,1.5vw,8px)] flex-wrap">
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
                className={`flex-1 border ${input.length > 450 ? 'border-yellow-500' : 'border-gray-200'} rounded-[clamp(16px,4vw,20px)] p-[clamp(8px,2vw,10px)_clamp(12px,3vw,16px)] text-[clamp(12px,2.5vw,14px)] outline-none transition-colors duration-200 min-w-[150px] focus:border-indigo-500`}
              />
              <button
                aria-label="Gửi tin nhắn"
                onClick={handleSubmit}
                disabled={isTyping || !input.trim()}
                className={`bg-gradient-to-br ${isTyping || !input.trim() ? 'bg-gray-600' : 'from-[#667eea] to-[#764ba2]'} text-white border-none rounded-[clamp(16px,4vw,20px)] px-[clamp(12px,3vw,16px)] py-[clamp(8px,2vw,10px)] text-[clamp(12px,2.5vw,14px)] ${isTyping || !input.trim() ? 'cursor-not-allowed' : 'cursor-pointer'} transition-all duration-200 whitespace-nowrap`}
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
