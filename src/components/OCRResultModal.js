import React from 'react';

/**
 * OCR结果模态框组件
 * 显示OCR识别结果，提供解释功能
 */
const OCRResultModal = React.memo(({ isOpen, result, onExplain, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div className="ocr-result-panel" style={{ 
      padding: '10px', 
      backgroundColor: '#222', 
      color: '#fff', 
      margin: '0 10px 10px' 
    }}>
      <div style={{ maxHeight: 150, overflowY: 'auto', marginBottom: 8 }}>
        {result.split('\n').map((line, idx) => (
          <p key={idx} style={{ margin: '4px 0' }}>{line}</p>
        ))}
      </div>
      <div style={{ textAlign: 'right' }}>
        <button onClick={() => onExplain('zh')}>中文解释</button>
        <button onClick={() => onExplain('en')}>英文解释</button>
        <button onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // 只有在开关状态或结果内容变化时才重新渲染
  return prevProps.isOpen === nextProps.isOpen &&
         prevProps.result === nextProps.result;
  // 不比较onExplain和onClose，它们应该是稳定的回调函数
});

export default OCRResultModal; 