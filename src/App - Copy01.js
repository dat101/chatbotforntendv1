import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Typist from 'react-typist';
import { debounce } from 'lodash';
import './App.css';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000/api/chat';

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
          // Bắt đầu danh sách điểm nổi bật
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

  const sendMessage = debounce(async (message) => {
    if (!message.trim()) return;

    const cleanMessage = message.replace(/[\n\t\r]/g, ' ').trim();
    setMessages((prev) => [...prev, { text: cleanMessage, sender: 'user' }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await axios.post(backendUrl, {
        message: cleanMessage,
        userId: 'user1',
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      const responseText = response.data.response;
      if (responseText.includes('Tìm thấy')) {
        const locations = parseResponse(responseText);
        setMessages((prev) => [...prev, { locations, sender: 'bot' }]);
      } else {
        setMessages((prev) => [...prev, { text: responseText, sender: 'bot' }]);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setMessages((prev) => [
        ...prev,
        { text: `Đã xảy ra lỗi: ${errorMessage}. Vui lòng thử lại!`, sender: 'bot' },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, 500);

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
        <h1>Chatbot Du Lịch</h1>
      </div>
      <div className="chat-body">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            {msg.sender === 'user' ? (
              <div className="user-message">{msg.text}</div>
            ) : msg.locations ? (
              <div className="bot-message">
                <Typist
                  avgTypingDelay={50}
                  stdTypingDelay={20}
                  cursor={{ show: false }}
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
                  avgTypingDelay={50}
                  stdTypingDelay={20}
                  cursor={{ show: false }}
                  startDelay={500}
                >
                  <p>Bạn muốn chọn địa điểm nào?</p>
                </Typist>
              </div>
            ) : (
              <Typist
                className="bot-message"
                avgTypingDelay={50}
                stdTypingDelay={20}
                cursor={{ show: false }}
              >
                {msg.text}
              </Typist>
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
        <button type="submit">Gửi</button>
      </form>
    </div>
  );
};

export default App;