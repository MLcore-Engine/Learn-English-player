import React, { useState, useCallback, useEffect } from 'react';
import TimeStats from './TimeStats';
import OCRContainer from '../containers/OCRContainer';
import AIContainer from '../containers/AIContainer';
import { useTimeStats } from '../contexts/AppContext';

/**
 * 侧边面板组件
 * 集成各个子容器组件
 */
const SidePanel = React.memo(() => {
  const { totalTime, sessionTime, remainingSeconds, formatTime } = useTimeStats();
  const [width, setWidth] = useState(360); // 默认宽度
  const [isDragging, setIsDragging] = useState(false);
  
  // 从localStorage加载保存的宽度
  useEffect(() => {
    const savedWidth = localStorage.getItem('sidePanelWidth');
    if (savedWidth) {
      setWidth(parseInt(savedWidth, 10));
    }
  }, []);

  // 处理拖动开始
  const handleDragStart = useCallback((e) => {
    setIsDragging(true);
    e.preventDefault();
  }, []);

  // 处理拖动
  const handleDrag = useCallback((e) => {
    if (!isDragging) return;
    
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 200 && newWidth <= 800) { // 限制最小和最大宽度
      setWidth(newWidth);
    }
  }, [isDragging]);

  // 处理拖动结束
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    localStorage.setItem('sidePanelWidth', width.toString());
  }, [width]);

  // 添加和移除全局事件监听
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, handleDrag, handleDragEnd]);
  
  const timeStatsProps = {
    totalTime,
    sessionTime,
    remainingSeconds,
    formatTime
  };
  
  return (
    <div style={{ 
      width: width, 
      borderLeft: '1px solid #444', 
      backgroundColor: '#111', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* 拖动条 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          cursor: 'col-resize',
          backgroundColor: isDragging ? '#666' : 'transparent',
          transition: 'background-color 0.2s'
        }}
        onMouseDown={handleDragStart}
      />
      
      <div style={{ 
        padding: '10px', 
        flexShrink: 0, 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <OCRContainer />
        <TimeStats {...timeStatsProps} />
      </div>
      
      <div style={{ 
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <AIContainer />
      </div>
    </div>
  );
});

export default SidePanel; 