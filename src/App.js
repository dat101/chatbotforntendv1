/**
 * File: src/App.js
 * Mục đích: Giao diện và xử lý tin nhắn của chatbot
 * Phiên bản: 0.1.5
 * Ngày cập nhật: 2025-05-17
 * Lý do nâng cấp:
 * - Khắc phục lỗi hiệu ứng gõ chữ lặp lại của react-typist cho các tin nhắn cũ.
 * - Tối ưu hóa xử lý lỗi và kết nối với backend.
 * - Giữ react-typist và React 16.14.0 để tương thích với cấu hình hiện tại.
 * Mục đích thay đổi:
 * - Cải thiện trải nghiệm người dùng với hiệu ứng gõ chữ chỉ cho tin nhắn mới nhất.
 * - Đảm bảo triển khai trên Vercel với backend tại https://chatbot-backend-1-ja1c.onrender.com.
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
          timeout: 10000 // 10-second timeout
        });

        const responseText = response.data.response;
        if (responseText.includes('Tìm thấy')) {
          const locations = parseResponse(responseText);
          setMessages((prev) => [...prev, { locations, sender: 'bot', isTyped: false }]);
        } else {
          setMessages((prev) => [...prev, { text: responseText, sender: 'bot', isTyped: false }]);
        }
        break; // Exit loop on success
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

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>Chatbot Văn Hóa & Du Lịch</h1>
      </div>
      <div className="chat-body">
        {messages.map((msg, index) => (
          <div key={index} className={message ${msg.sender}}>
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
                      key={${index}-question}
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
        />
        <button type="submit" disabled={isTyping || !input.trim()}>
          Gửi
        </button>
      </form>
    </div>
  );
};

export default App;
