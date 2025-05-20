import React from 'react';
import SubtitleOCR from '../components/SubtitleOCR';
import { useVideo } from '../contexts/AppContext';

/**
 * OCR容器组件
 * 渲染 SubtitleOCR 按钮，由父组件通过 props 管理识别结果和弹窗
 */
const OCRContainer = React.memo(({ onRecognize, isLoading }) => {
  const { videoRef } = useVideo();
  return (
    <SubtitleOCR
      videoRef={videoRef}
      onRecognize={onRecognize}
      isLoading={isLoading}
    />
  );
});

export default OCRContainer; 