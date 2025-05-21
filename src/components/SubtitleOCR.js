import React, { useState } from 'react';
import { useVideo } from '../contexts/AppContext';
import { recognizeSubtitleFromVideo } from '../utils/ocr';

/**
 * 字幕OCR组件
 * 提供字幕识别功能
 */
const SubtitleOCR = React.memo(({ videoRef, onRecognize, isLoading: externalLoading }) => {
  // 如果外部没有提供loading状态，使用内部的
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;
  
  // 使用 context 中的 duration 判断视频是否加载完成
  // Также получаем externalSubtitles из контекста
  const { duration, externalSubtitles } = useVideo(); // Removed currentTime
  const isVideoReady = duration > 0;

  const handleRecognize = async () => {
    console.log('SubtitleOCR handleRecognize invoked, videoRef.current:', videoRef.current);

    if (!isVideoReady || !videoRef.current) {
      console.warn('SubtitleOCR: 视频未加载或videoRef无效，无法操作');
      onRecognize?.('请先加载视频');
      return;
    }

    // Check if external subtitles are available
    if (externalSubtitles && externalSubtitles.length > 0) {
      const currentVideoTime = videoRef.current.currentTime;
      const activeSub = externalSubtitles.find(
        (sub) => currentVideoTime >= sub.startTime && currentVideoTime <= sub.endTime
      );

      if (activeSub) {
        onRecognize?.(activeSub.text);
      } else {
        onRecognize?.('当前时间无外部字幕'); // Or an empty string: onRecognize?.('');
      }
      return; // Skip OCR if external subtitles were processed
    }

    // --- Proceed with image-based OCR if no external subtitles ---
    
    // 暂停视频再进行OCR识别
    videoRef.current.pause();
    
    onRecognize?.('识别中...'); // Notify UI that OCR is starting
    
    if (externalLoading === undefined) {
      setInternalLoading(true);
    }
    
    try {
      const result = (await recognizeSubtitleFromVideo(videoRef.current)).trim();
      if (!result) {
        onRecognize?.('未检测到字幕，请重试');
      } else {
        onRecognize?.(result);
      }
    } catch (err) {
      console.error('OCR 识别失败', err);
      onRecognize?.('识别失败，请重试');
    } finally {
      if (externalLoading === undefined) {
        setInternalLoading(false);
      }
    }
  };

  return (
    <div className="subtitle-ocr">
      <button
        onClick={handleRecognize}
        disabled={loading || !isVideoReady}
        style={{
          width: '100%',
          padding: '8px 0',
          borderRadius: 8,
          border: '1px solid #1976d2',
          background: '#fff',
          color: '#1976d2',
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: 1,
          boxShadow: '0 1px 4px rgba(25, 118, 210, 0.06)',
          transition: 'background 0.2s, color 0.2s',
          cursor: (loading || !isVideoReady) ? 'not-allowed' : 'pointer',
          opacity: (loading || !isVideoReady) ? 0.7 : 1,
        }}
      >
        {loading
          ? '识别中...'
          : !isVideoReady
          ? '视频加载...'
          : externalSubtitles && externalSubtitles.length > 0
          ? '提取当前字幕'
          : '识别字幕(OCR)'}
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