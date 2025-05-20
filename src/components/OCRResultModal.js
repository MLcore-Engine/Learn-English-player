import React from 'react';

const OCRResultModal = React.memo(({ isOpen, result, onExplain, onClose, style, isLoading }) => {
  if (!isOpen) return null;

  const getSelectedText = () => {
    return window.getSelection().toString().trim();
  };

  return (
    <div
      className="ocr-result-modal"
      style={{
        ...style,
        width: '100%',
        boxSizing: 'border-box',
        background: '#fff',
        border: '1px solid #eee',
        borderRadius: 8,
        padding: 16,
        marginTop: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch'
      }}
    >
      <div
        style={{
          marginBottom: 12,
          color: '#222',
          fontSize: 22,
          wordBreak: 'break-all',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          overflow: 'hidden',
          maxWidth: '100%'
        }}
      >
        {result}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
        <button 
          style={{ 
            flex: 1,
            padding: '4px 0',
            borderRadius: 8,
            border: '1px solid #1976d2',
            background: '#fff',
            color: '#1976d2',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: 1,
            boxShadow: '0 1px 4px rgba(25, 118, 210, 0.06)',
            transition: 'all 0.2s ease',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            height: '28px',
            lineHeight: '20px'
          }} 
          disabled={isLoading}
          onClick={() => {
            const txt = getSelectedText();
            if (!txt) {
              alert('请先在上方结果里选中要解释的文字');
              return;
            }
            onExplain('zh', txt);
          }}
          
        >
          {isLoading ? '处理中...' : '中文解释'}
        </button>
        <button 
          style={{ 
            flex: 1,
            padding: '4px 0',
            borderRadius: 8,
            border: '1px solid #1976d2',
            background: '#fff',
            color: '#1976d2',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: 1,
            boxShadow: '0 1px 4px rgba(25, 118, 210, 0.06)',
            transition: 'all 0.2s ease',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            height: '28px',
            lineHeight: '20px'
          }} 
          disabled={isLoading}
          onClick={() => {
            const txt = getSelectedText();
            if (!txt) {
              alert('请先在上方结果里选中要解释的文字');
              return;
            }
            onExplain('en', txt);
          }}
          
        >
          {isLoading ? 'Processing...' : '英文解释'}
        </button>
        <button 
          style={{ 
            flex: 1,
            padding: '4px 0',
            borderRadius: 8,
            border: '1px solid #666',
            background: '#fff',
            color: '#666',
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: 1,
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.2s ease',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1,
            height: '28px',
            lineHeight: '20px'
          }} 
          onClick={onClose}
          disabled={isLoading}
        >
          关闭
        </button>
      </div>
    </div>
  );
});

export default OCRResultModal; 