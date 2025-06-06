import React, { useState, useCallback, useEffect } from 'react';
import TimeStats from './TimeStats';
import OCRContainer from '../containers/OCRContainer';
import AIContainer from '../containers/AIContainer';
import OCRResultModal from '../components/OCRResultModal';
import { useTimeStats, useAI, useVideo } from '../contexts/AppContext';
import { Box } from '@mui/material';
import aiService from '../utils/aiService';
import videojs from 'video.js';

/**
 * 侧边面板组件
 * 集成各个子容器组件
 */
const SidePanel = React.memo(({ hasExternalSubtitles }) => {
  const { totalTime, sessionTime, remainingSeconds, formatTime } = useTimeStats();
  const [width, setWidth] = useState(360); // 默认宽度
  const [isDragging, setIsDragging] = useState(false);
  
  // OCR弹窗相关状态
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrResult, setOcrResult] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);

  // AI解释相关状态
  const [explainLoading, setExplainLoading] = useState(false);
  // AI上下文动作
  const { setSelectedText, setExplanation, setLoading: setAiLoading, addRecord } = useAI();

  // 视频加载状态从 context 获取
  const { isLoaded: isVideoLoaded, videoRef, playerRef } = useVideo();

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
  
  // OCRContainer的回调，识别完成后弹窗
  const handleOCRRecognize = useCallback((recognizedText) => {
    // 如果有外挂字幕，直接使用当前字幕文本
    if (hasExternalSubtitles && playerRef.current) {
      try {
        const player = playerRef.current;
        if (player && player.textTracks) {
          const tracks = player.textTracks();
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (track.label === '外挂字幕' && track.activeCues && track.activeCues.length > 0) {
              const text = track.activeCues[0].text;
              setOcrResult(text);
              setOcrModalOpen(true);
              return;
            }
          }
        }
      } catch (error) {
        console.error('获取字幕轨道失败:', error);
      }
    }

    // 如果没有外挂字幕或获取失败，使用OCR识别
    if (recognizedText === '识别中...') {
      setOcrLoading(true);
      return;
    }
    
    setOcrResult(recognizedText);
    setOcrModalOpen(true);
    setOcrLoading(false);
  }, [hasExternalSubtitles, playerRef]);

  // 解释按钮回调
  const handleExplain = useCallback(async (lang, selectedText) => {
    const text = selectedText || ocrResult;
    if (!text) {
      // 兜底提示
      alert('没有可解释的文字');
      return;
    }
    // 设置模块和上下文的 loading 状态
    setExplainLoading(true);
    setAiLoading(true);
    setSelectedText(text);
    try {
      // 调用前端 AI 服务获取解释
      const explanation = await aiService.getExplanation(text, { language: lang });
      // 上下文中更新解释及记录
      setExplanation(explanation);
      addRecord({ subtitle_text: text, explanation, timestamp: Date.now() });
    } catch (error) {
      console.error('AI解释失败:', error);
      // TODO: 可以弹出错误提示
    } finally {
      // 重置状态，关闭弹窗
      setAiLoading(false);
      setExplainLoading(false);
      setOcrModalOpen(false);
      setOcrResult('');
    }
  }, [ocrResult, setAiLoading, setSelectedText, setExplanation, addRecord]);

  // 关闭弹窗
  const handleCloseModal = useCallback(() => {
    setOcrModalOpen(false);
    setOcrResult(''); // 清空OCR结果
    setExplainLoading(false); // 确保重置loading状态
  }, []);

  return (
    <Box sx={{ 
      width: width, 
      borderLeft: '1px solid #444', 
      backgroundColor: '#111', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      height: '100%'
    }}>
      {/* 拖动条 */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          cursor: 'col-resize',
          backgroundColor: isDragging ? '#666' : 'transparent',
          transition: 'background-color 0.2s',
          '&:hover': {
            backgroundColor: '#666'
          }
        }}
        onMouseDown={handleDragStart}
      />
      {/* 顶部区域加position: relative，模态框绝对定位覆盖 */}
      <Box sx={{
        width: '100%',
        position: 'relative',
        pt: 1.5,
        pb: 0.5,
        px: 2,
        backgroundColor: 'background.paper',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ flex: 1, width: '48%' }}>
            <OCRContainer 
              onRecognize={handleOCRRecognize} 
              isLoading={ocrLoading} 
              videoReady={isVideoLoaded}
              hasExternalSubtitles={hasExternalSubtitles}
            />
          </Box>
          <Box sx={{ flex: 4, display: 'flex', justifyContent: 'flex-end' }}>
            <TimeStats {...timeStatsProps} smallFont horizontal/>
          </Box>
        </Box>
        {/* 绝对定位的模态框 */}
        <Box sx={{ position: 'relative' }}>
          <OCRResultModal
            isOpen={ocrModalOpen}
            result={ocrResult}
            onExplain={handleExplain}
            onClose={handleCloseModal}
            isLoading={explainLoading}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              zIndex: 10
            }}
          />
        </Box>

      </Box>
      
      <Box sx={{ 
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.default'
      }}>
        <AIContainer />
      </Box>
    </Box>
  );
});

export default SidePanel; 