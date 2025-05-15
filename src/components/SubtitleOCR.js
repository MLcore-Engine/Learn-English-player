import React, { useState } from 'react';
import { recognizeSubtitleFromVideo } from '../utils/ocr';

/**
 * 字幕OCR组件
 * 提供字幕识别功能
 */
const SubtitleOCR = React.memo(({ videoRef, onRecognize, isLoading: externalLoading }) => {
  // 如果外部没有提供loading状态，使用内部的
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;

  const handleRecognize = async () => {
    console.log('SubtitleOCR handleRecognize invoked, videoRef.current:', videoRef.current);
    // 暂停视频再进行OCR识别
    if (videoRef.current) {
      videoRef.current.pause();
    }
    
    onRecognize && onRecognize('识别中...');
    
    if (!videoRef?.current) {
      console.warn('SubtitleOCR: videoRef.current is null，无法进行OCR识别');
      return;
    }
    
    if (externalLoading === undefined) {
      setInternalLoading(true);
    }
    
    try {
      const result = (await recognizeSubtitleFromVideo(videoRef.current)).trim();
      // 处理未识别到文本的情况
      if (!result) {
        onRecognize && onRecognize('未检测到字幕，请重试');
      } else {
        onRecognize && onRecognize(result);
      }
    } catch (err) {
      console.error('OCR 识别失败', err);
      onRecognize && onRecognize('识别失败，请重试');
    } finally {
      if (externalLoading === undefined) {
        setInternalLoading(false);
      }
    }
  };

  return (
    <div className="subtitle-ocr">
      <button onClick={handleRecognize} disabled={loading}>
        {loading ? '识别中...' : '识别字幕'}
      </button>
    </div>
  );
}, (prevProps, nextProps) => {
  // 只有在关键props变化时才重新渲染
  return prevProps.videoRef === nextProps.videoRef &&
         prevProps.isLoading === nextProps.isLoading;
  // 不比较onRecognize，它应该是一个稳定的回调函数
});

export default SubtitleOCR; 