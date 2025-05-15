import React, { useCallback } from 'react';
import SubtitleOCR from '../components/SubtitleOCR';
import OCRResultModal from '../components/OCRResultModal';
import { useOCR, useAI, useVideo } from '../contexts/AppContext';
import aiService from '../utils/aiService';

/**
 * OCR容器组件
 * 管理OCR识别相关的状态和逻辑，渲染SubtitleOCR和OCRResultModal组件
 */
const OCRContainer = React.memo(() => {
  const { videoRef } = useVideo();
  const { 
    result, 
    isModalOpen, 
    loading, 
    setResult, 
    setModalOpen, 
    setLoading,
    clearResult 
  } = useOCR();
  
  const { 
    setSelectedText, 
    setExplanation, 
    setLoading: setAILoading,
    addRecord 
  } = useAI();

  // 处理OCR识别结果
  const handleRecognize = useCallback((recognizedText) => {
    console.log('OCR识别结果:', recognizedText);
    setResult(recognizedText);
    setModalOpen(true);
  }, [setResult, setModalOpen]);

  // 处理OCR结果的解释请求
  const handleExplain = useCallback((language) => {
    const selection = window.getSelection().toString().trim();
    const textToExplain = selection || result;
    
    if (!textToExplain) {
      setModalOpen(false);
      return;
    }
    
    setSelectedText(textToExplain);
    setAILoading(true);
    setModalOpen(false);
    
    // 请求AI解释
    aiService.getExplanation(textToExplain, { language })
      .then(explanation => {
        setExplanation(explanation);
        
        // 添加到学习记录
        addRecord({
          subtitle_text: textToExplain,
          explanation: explanation,
          timestamp: Date.now()
        });
      })
      .catch(err => {
        console.error('AI解释失败:', err);
        // 可以添加错误处理UI
      })
      .finally(() => {
        setAILoading(false);
      });
  }, [result, setSelectedText, setExplanation, setAILoading, setModalOpen, addRecord]);

  // 关闭模态框
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
  }, [setModalOpen]);

  return (
    <>
      <SubtitleOCR 
        videoRef={videoRef} 
        onRecognize={handleRecognize} 
        isLoading={loading}
      />
      
      <OCRResultModal
        isOpen={isModalOpen}
        result={result}
        onExplain={handleExplain}
        onClose={handleCloseModal}
      />
    </>
  );
});

export default OCRContainer; 