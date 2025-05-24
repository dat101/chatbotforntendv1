import React, { useState, useEffect, useRef } from 'react';

const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const QuickActions = ({ questions, onSelect, onDelete }) => (
  <div className="bg-gray-100 border-t border-gray-200">
    <div className="px-3 py-1 text-xs font-medium text-gray-600">
      💬 Câu hỏi trước:
    </div>
    <div className="flex flex-wrap gap-1 px-3 pb-2 max-h-12 overflow-y-auto">
      {questions.map((question, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <button
            aria-label={`Gửi lại câu hỏi: ${question}`}
            onClick={() => onSelect(question)}
            className="bg-white border border-gray-300 rounded-lg px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-100 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150 truncate max-w-[90px]"
            title={question.endsWith('...') ? 'Nhấn để gửi lại câu hỏi đầy đủ' : question}
          >
            {question}
          </button>
          <button
            aria-label={`Xóa câu hỏi: ${question}`}
            onClick={() => onDelete(question)}
            className="bg-white border border-gray-300 rounded-full w-5 h-5 flex items-center justify-center text-red-500 text-xs hover:bg-red-500 hover:text-white transition-all duration-150"
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

  const resetChat = () => {
    setMessages([]);
    setInput('');
    setIsTyping(false);
    setSessionId(generateSessionId());
    setAllUserQuestions(prev => [...prev]);
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
    <div className="font-sans h-screen bg-white relative overflow-hidden">
      <button
        aria-label={isChatOpen ? "Đóng chat" : "Mở chat"}
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-4 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-red-400 to-orange-500 text-white text-2xl flex items-center justify-center shadow-lg hover:scale-110 hover:shadow-xl transition-all duration-300 z-50"
      >
        {isChatOpen ? '✕' : '💬'}
      </button>

      {isChatOpen && (
        <div className="fixed bottom-20 right-4 w-full max-w-[360px] h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col animate-slide-up z-40 sm:max-w-[400px] sm:h-[600px]">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-4 rounded-t-2xl flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold m-0">Trợ lý Du lịch Khánh Hòa</h3>
              <p className="text-sm opacity-90 m-0">Hỗ trợ bạn mọi lúc</p>
            </div>
            {messages.length > 0 && (
              <button
                aria-label="Làm mới cuộc trò chuyện"
                onClick={resetChat}
                className="bg-white/20 border border-white/30 rounded-lg px-2 py-1 text-xs hover:bg-white/30 transition-all duration-200"
              >
                🔄 Làm mới
              </button>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-600 mt-4">
                <p className="text-sm">👋 Xin chào! Tôi có thể giúp bạn tìm hiểu về:</p>
                <div className="flex flex-col gap-2 mt-3">
                  {suggestions.map((item, idx) => (
                    <button
                      key={idx}
                      aria-label={`Tìm hiểu về ${item.text}`}
                      onClick={() => sendMessage(`Tôi muốn tìm hiểu về ${item.text}`)}
                      className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
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
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3`}
              >
                {msg.sender === 'user' ? (
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-3 rounded-2xl rounded-br-[4px] max-w-[80%] text-sm leading-relaxed">
                    {msg.text}
                  </div>
                ) : msg.locations ? (
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-[4px] max-w-[90%] p-4 text-sm">
                    {msg.isTyped ? (
                      <>
                        <p className="font-semibold text-gray-800 mb-3">
                          Tìm thấy {msg.locations.length} địa điểm:
                        </p>
                        {msg.locations.map((location, locIndex) => (
                          <div
                            key={locIndex}
                            className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2"
                          >
                            <h4 className="text-base font-semibold text-gray-900 m-0 mb-2">
                              {location.name}
                            </h4>
                            {location.address && (
                              <p className="text-xs text-gray-600 m-0 mb-1">📍 {location.address}</p>
                            )}
                            {location.phone && (
                              <p className="text-xs text-gray-600 m-0 mb-1">📞 {location.phone}</p>
                            )}
                            {location.openingHours && (
                              <p className="text-xs text-gray-600 m-0 mb-1">🕒 {location.openingHours}</p>
                            )}
                            {location.highlights && location.highlights.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-semibold text-gray-700 m-0 mb-1">
                                  ✨ Điểm nổi bật:
                                </p>
                                <ul className="list-disc pl-4 text-xs text-gray-600 m-0">
                                  {location.highlights.map((highlight, hIndex) => (
                                    <li key={hIndex}>{highlight}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <button
                              aria-label={`Chọn ${location.name}`}
                              onClick={() => handleLocationSelect(location.name)}
                              className="mt-2 bg-gradient-to-br from-green-500 to-teal-500 text-white rounded-lg px-3 py-1 text-xs hover:bg-green-600 transition-all duration-200"
                            >
                              Chọn địa điểm này
                            </button>
                          </div>
                        ))}
                        <p className="text-xs text-gray-600 mt-2">
                          Bạn muốn chọn địa điểm nào?
                        </p>
                      </>
                    ) : (
                      <p className="font-semibold text-gray-800">
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
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-[4px] max-w-[80%] p-3 text-sm text-gray-800 leading-relaxed">
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
              <div className="flex justify-start mb-3">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-[4px] p-3">
                  <div className="flex gap-1 items-center">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-gray-500 animate-pulse"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
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

          <div className="p-4 bg-white border-t border-gray-200">
            <div className="text-xs text-right text-gray-600 mb-2">
              {input.length}/500
              {input.length > 450 && <span className="text-red-500"> (gần giới hạn)</span>}
            </div>
            <div className="flex gap-2 flex-wrap">
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
                className={`flex-1 border ${input.length > 450 ? 'border-yellow-400' : 'border-gray-300'} rounded-full px-4 py-2 text-sm outline-none focus:border-indigo-500 transition-all duration-200 min-w-[120px]`}
              />
              <button
                aria-label="Gửi tin nhắn"
                onClick={handleSubmit}
                disabled={isTyping || !input.trim()}
                className={`bg-gradient-to-br ${isTyping || !input.trim() ? 'from-gray-500 to-gray-600' : 'from-indigo-500 to-purple-600'} text-white rounded-full px-4 py-2 text-sm ${isTyping || !input.trim() ? 'cursor-not-allowed' : 'hover:bg-indigo-600'} transition-all duration-200`}
              >
                Gửi
              </button>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slide-up 0.3s ease-out;
          }
          .animate-pulse {
            animation: pulse 1.4s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
          }
          .max-h-12::-webkit-scrollbar {
            width: 4px;
          }
          .max-h-12::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
          }
          .max-h-12::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 10px;
          }
          .max-h-12::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
          }
        `}
      </style>
    </div>
  );
};

export default App;
