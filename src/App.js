/**
 * File: src/App.js
 * Mục đích: Giao diện widget chatbot có thể thu gọn/mở rộng
 * Phiên bản: 0.2.0
 * Ngày cập nhật: 2025-05-22
 * Lý do nâng cấp:
 * - Thay đổi giao diện từ chatbox full screen thành widget có thể thu gọn
 * - Thêm floating action button để mở/đóng chat
 * - Tối ưu trải nghiệm người dùng với animation mượt mà
 * - Giữ nguyên tất cả tính năng backend và xử lý tin nhắn
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Typist from 'react-typist';
import { debounce } from 'lodash';
import './App.css';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000/api/chat';

  const generateSessionId = () => {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  useEffect(() => {
    const storedSessionId = localStorage.getItem('sessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      localStorage.setItem('sessionId', newSessionId);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

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
          // Start of highlights list
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
    if (!message.trim() || isTyping) return;

    const cleanMessage = message.replace(/[\n\t\r]/g, ' ').trim();
    setMessages((prev) => [...prev, { text: cleanMessage, sender: 'user' }]);
    setInput('');
    setIsTyping(true);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.post(backendUrl, {
          message: cleanMessage,
          userId: 'user1',
          sessionId: sessionId
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        const responseText = response.data.response;
        if (responseText.includes('Tìm thấy')) {
          const locations = parseResponse(responseText);
          setMessages((prev) => [...prev, { locations, sender: 'bot', isTyped: false }]);
        } else {
          setMessages((prev) => [...prev, { text: responseText, sender: 'bot', isTyped: false }]);
        }
        
        // Increase unread count if chat is closed
        if (!isOpen) {
          setUnreadCount(prev => prev + 1);
        }
        
        break;
      } catch (error) {
        if (attempt === retries) {
          let errorMessage = 'Đã xảy ra lỗi. Vui lòng thử lại!';
          if (error.response) {
            if (error.response.status === 400) {
              errorMessage = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại!';
            } else if (error.response.status === 500) {
              errorMessage = 'Lỗi máy chủ. Vui lòng thử lại sau!';
            } else {
              errorMessage = error.response.data?.error || error.message;
            }
          }
          setMessages((prev) => [
            ...prev,
            { text: errorMessage, sender: 'bot', isTyped: true },
          ]);
          
          if (!isOpen) {
            setUnreadCount(prev => prev + 1);
          }
        }
      }
    }
    setIsTyping(false);
  }, 1000);

  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion);
  };

  const handleLocationSelect = (locationName) => {
    sendMessage(locationName);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleMinimize = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Chat Widget */}
      <div className={`chat-widget ${isOpen ? 'open' : 'closed'}`}>
        {isOpen && (
          <div className="chat-container">
            <div className="chat-header">
              <div className="header-content">
                <div className="header-info">
                  <h1>Chatbot Văn Hóa & Du Lịch</h1>
                  <span className="status-indicator">Đang hoạt động</span>
                </div>
                <button className="minimize-btn" onClick={handleMinimize}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M19 13H5v-2h14v2z" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="chat-body">
              {messages.length === 0 && (
                <div className="welcome-message">
                  <div className="welcome-avatar">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19Z" fill="currentColor"/>
                    </svg>
                  </div>
                  <h3>Xin chào! 👋</h3>
                  <p>Tôi là trợ lý ảo về văn hóa và du lịch Khánh Hòa. Hãy hỏi tôi về:</p>
                  <div className="welcome-features">
                    <span>🏛️ Văn hóa địa phương</span>
                    <span>🎉 Sự kiện</span>
                    <span>🏖️ Địa điểm du lịch</span>
                    <span>🍜 Ẩm thực</span>
                    <span>🏥 Dịch vụ y tế</span>
                    <span>🚌 Tour du lịch</span>
                  </div>
                </div>
              )}
              
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.sender}`}>
                  {msg.sender === 'user' ? (
                    <div className="user-message">{msg.text}</div>
                  ) : msg.locations ? (
                    <div className="bot-message">
                      {msg.isTyped ? (
                        <>
                          <p>Tìm thấy {msg.locations.length} địa điểm:</p>
                          <div className="location-cards">
                            {msg.locations.map((location, locIndex) => (
                              <div key={locIndex} className="location-card">
                                <h3>{location.name}</h3>
                                {location.address && <p><strong>Địa chỉ:</strong> {location.address}</p>}
                                {location.phone && <p><strong>Số điện thoại:</strong> {location.phone}</p>}
                                {location.openingHours && <p><strong>Giờ mở cửa:</strong> {location.openingHours}</p>}
                                {location.mapLink && (
                                  <p>
                                    <strong>Bản đồ:</strong>{' '}
                                    <a href={location.mapLink} target="_blank" rel="noopener noreferrer">
                                      {location.mapLink}
                                    </a>
                                  </p>
                                )}
                                {location.aiMenuLink && (
                                  <p>
                                    <strong>AI Menu:</strong>{' '}
                                    <a href={location.aiMenuLink} target="_blank" rel="noopener noreferrer">
                                      {location.aiMenuLink}
                                    </a>
                                  </p>
                                )}
                                {location.highlights && location.highlights.length > 0 && (
                                  <div>
                                    <p><strong>Điểm nổi bật:</strong></p>
                                    <ul>
                                      {location.highlights.map((highlight, hIndex) => (
                                        <li key={hIndex}>{highlight}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                <button onClick={() => handleLocationSelect(location.name)}>
                                  Chọn địa điểm này
                                </button>
                              </div>
                            ))}
                          </div>
                          <p>Bạn muốn chọn địa điểm nào?</p>
                        </>
                      ) : (
                        <>
                          <Typist
                            key={index}
                            avgTypingDelay={20}
                            stdTypingDelay={10}
                            cursor={{ show: false }}
                            onTypingDone={() => {
                              setMessages((prev) =>
                                prev.map((m, i) =>
                                  i === index ? { ...m, isTyped: true } : m
                                )
                              );
                            }}
                          >
                            <p>Tìm thấy {msg.locations.length} địa điểm:</p>
                          </Typist>
                          <div className="location-cards">
                            {msg.locations.map((location, locIndex) => (
                              <div key={locIndex} className="location-card">
                                <h3>{location.name}</h3>
                                {location.address && <p><strong>Địa chỉ:</strong> {location.address}</p>}
                                {location.phone && <p><strong>Số điện thoại:</strong> {location.phone}</p>}
                                {location.openingHours && <p><strong>Giờ mở cửa:</strong> {location.openingHours}</p>}
                                {location.mapLink && (
                                  <p>
                                    <strong>Bản đồ:</strong>{' '}
                                    <a href={location.mapLink} target="_blank" rel="noopener noreferrer">
                                      {location.mapLink}
                                    </a>
                                  </p>
                                )}
                                {location.aiMenuLink && (
                                  <p>
                                    <strong>AI Menu:</strong>{' '}
                                    <a href={location.aiMenuLink} target="_blank" rel="noopener noreferrer">
                                      {location.aiMenuLink}
                                    </a>
                                  </p>
                                )}
                                {location.highlights && location.highlights.length > 0 && (
                                  <div>
                                    <p><strong>Điểm nổi bật:</strong></p>
                                    <ul>
                                      {location.highlights.map((highlight, hIndex) => (
                                        <li key={hIndex}>{highlight}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                <button onClick={() => handleLocationSelect(location.name)}>
                                  Chọn địa điểm này
                                </button>
                              </div>
                            ))}
                          </div>
                          <Typist
                            key={`${index}-question`}
                            avgTypingDelay={20}
                            stdTypingDelay={10}
                            cursor={{ show: false }}
                            startDelay={500}
                            onTypingDone={() => {
                              setMessages((prev) =>
                                prev.map((m, i) =>
                                  i === index ? { ...m, isTyped: true } : m
                                )
                              );
                            }}
                          >
                            <p>Bạn muốn chọn địa điểm nào?</p>
                          </Typist>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="bot-message">
                      {msg.isTyped ? (
                        msg.text
                      ) : (
                        <Typist
                          key={index}
                          avgTypingDelay={20}
                          stdTypingDelay={10}
                          cursor={{ show: false }}
                          onTypingDone={() => {
                            setMessages((prev) =>
                              prev.map((m, i) =>
                                i === index ? { ...m, isTyped: true } : m
                              )
                            );
                          }}
                        >
                          {msg.text}
                        </Typist>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {isTyping && (
                <div className="message bot">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="suggestions">
              <button onClick={() => handleSuggestionClick('Tôi muốn tìm hiểu về văn hóa Khánh Hòa')}>
                Văn hóa
              </button>
              <button onClick={() => handleSuggestionClick('Tôi muốn tìm sự kiện ở Nha Trang')}>
                Sự kiện
              </button>
              <button onClick={() => handleSuggestionClick('Tôi muốn tìm địa điểm tham quan ở Nha Trang')}>
                Địa điểm du lịch
              </button>
              <button onClick={() => handleSuggestionClick('Tôi tìm nhà hàng')}>
                Ẩm thực
              </button>
              <button onClick={() => handleSuggestionClick('Tôi tìm bệnh viện')}>
                Y tế
              </button>
              <button onClick={() => handleSuggestionClick('Tôi tìm tour')}>
                Tour du lịch
              </button>
            </div>
            
            <form className="chat-input" onSubmit={handleSubmit}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/[\n\t\r]/g, ' '))}
                placeholder="Nhập tin nhắn..."
                autoComplete="off"
              />
              <button type="submit" disabled={isTyping || !input.trim()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z" fill="currentColor"/>
                </svg>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="chat-fab" onClick={toggleChat}>
        {!isOpen && unreadCount > 0 && (
          <div className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</div>
        )}
        <div className={`fab-content ${isOpen ? 'open' : ''}`}>
          {isOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" fill="currentColor"/>
            </svg>
          )}
        </div>
      </div>
    </>
  );
};

export default App;
