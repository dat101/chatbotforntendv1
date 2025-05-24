const [quickActions, setQuickActions] = useState([
  { emoji: '🏛️', text: 'văn hóa' },
  { emoji: '🎉', text: 'sự kiện' },
  { emoji: '🏖️', text: 'địa điểm du lịch' },
  { emoji: '🍜', text: 'ẩm thực' },
  { emoji: '🏥', text: 'y tế' },
  { emoji: '🚌', text: 'tour du lịch' }
]);

// Trong phần render quick actions, thêm nút xóa:
{quickActions.map((item, idx) => (
  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, 6px)' }}>
    <button
      aria-label={`Tìm hiểu về ${item.text}`}
      onClick={() => {
        handleSuggestionClick(`Tôi muốn tìm hiểu về ${item.text}`);
        setQuickActions(prev => prev.filter((_, i) => i !== idx)); // Xóa quick action
      }}
      style={{
        fontSize: 'clamp(12px, 2.5vw, 14px)',
        padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
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
    <button
      aria-label={`Xóa gợi ý ${item.text}`}
      onClick={() => setQuickActions(prev => prev.filter((_, i) => i !== idx))}
      style={{
        background: '#fff',
        border: '1px solid #dee2e6',
        borderRadius: '50%',
        width: 'clamp(16px, 4vw, 20px)',
        height: 'clamp(16px, 4vw, 20px)',
        fontSize: 'clamp(8px, 2vw, 10px)',
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
