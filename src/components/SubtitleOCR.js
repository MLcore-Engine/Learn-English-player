import React, { useState } from 'react';
import { recognizeSubtitleFromVideo } from '../utils/ocr';

/**
 * SubtitleOCR 组件
 * Props:
 *   - videoRef: 传入视频元素的 React ref
 *   - onRecognize: 回调函数，用于传递识别结果
 */
const SubtitleOCR = ({ videoRef, onRecognize }) => {
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <div className="subtitle-ocr">
      <button onClick={handleRecognize} disabled={loading}>
        {loading ? '识别中...' : '识别字幕'}
      </button>
    </div>
  );
};

export default SubtitleOCR; 