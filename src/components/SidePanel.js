import React, { useState, useCallback, useEffect } from 'react';
import TimeStats from './TimeStats';
import OCRContainer from '../containers/OCRContainer';
import AIContainer from '../containers/AIContainer';
import OCRResultModal from '../components/OCRResultModal';
import { useTimeStats, useAI, useVideo } from '../contexts/AppContext';
import { Box } from '@mui/material';
import aiService from '../utils/aiService';

/**
 * 侧边面板组件
 * 集成各个子容器组件
 */
const SidePanel = React.memo(() => {
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

  // 视频加载状态及外部字幕加载从 context 获取
  const { isLoaded: isVideoLoaded, loadExternalSubtitles, externalSubtitles } = useVideo();
  const [loadedSubtitleFileName, setLoadedSubtitleFileName] = useState('');

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
    // 如果收到的是 loading 文本，只更新 loading 状态
    if (recognizedText === '识别中...') {
      setOcrLoading(true);
      return;
    }
    
    // 否则更新结果并显示弹窗
    setOcrResult(recognizedText);
    setOcrModalOpen(true);
    setOcrLoading(false);
  }, []);

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

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        await loadExternalSubtitles(file);
        setLoadedSubtitleFileName(file.name); // Store filename for feedback
        // alert(`Successfully loaded subtitles from ${file.name}`); // Feedback via AppContext
      } catch (error) {
        // Error already handled by alert in loadExternalSubtitles
        setLoadedSubtitleFileName('');
      }
      event.target.value = null; // Allow re-uploading the same file
    }
  }, [loadExternalSubtitles]);

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
        <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
          <Box sx={{ flex: 1, minWidth: '150px' }}> {/* Ensure OCRContainer has enough space */}
            <OCRContainer onRecognize={handleOCRRecognize} isLoading={ocrLoading} videoReady={isVideoLoaded} />
          </Box>
          <Box sx={{ flex: 'auto', display: 'flex', justifyContent: 'flex-end' }}> {/* Allow TimeStats to take available space */}
            <TimeStats {...timeStatsProps} smallFont horizontal/>
          </Box>
        </Box>
        {/* Input for loading external subtitles */}
        <Box sx={{ mt: 1, mb: 0.5 }}>
          <input
            type="file"
            accept=".srt,.vtt"
            onChange={handleFileChange}
            style={{ display: 'block', width: '100%', color: 'white' }}
          />
          {externalSubtitles && loadedSubtitleFileName && (
            <p style={{ color: '#aaa', fontSize: '0.8em', marginTop: '4px', textAlign: 'center' }}>
              Loaded: {loadedSubtitleFileName} ({externalSubtitles.length} cues)
            </p>
          )}
        </Box>
        {/* 绝对定位的模态框 */}
        <Box sx={{ position: 'relative' }}> {/* Ensure this Box allows absolute positioning of children */}
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