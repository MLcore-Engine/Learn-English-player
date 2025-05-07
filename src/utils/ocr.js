import { createWorker } from 'tesseract.js';

/**
 * 从 video 元素中截取底部 15% 区域并进行 OCR 识别
 * @param {HTMLVideoElement} videoElement 视频元素引用
 * @returns {Promise<string>} 识别出的英文字幕文本
 */
export async function recognizeSubtitleFromVideo(videoElement) {
  // 确保视频已加载元数据
  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    throw new Error('视频尺寸未就绪');
  }

  const width = videoElement.videoWidth;
  const height = videoElement.videoHeight;
  const cropHeight = Math.floor(height * 0.15);

  // 创建临时 canvas 进行截图
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = cropHeight;
  const ctx = canvas.getContext('2d');
  // 截取底部 15%
  ctx.drawImage(
    videoElement,
    0,
    height - cropHeight,
    width,
    cropHeight,
    0,
    0,
    width,
    cropHeight
  );

  // 转成 dataURL 供 Tesseract.js 识别
  const dataUrl = canvas.toDataURL('image/png');

  // 创建并初始化 Tesseract.js 工作线程
  const worker = await createWorker();
  // 设置参数：使用自动（块）模式并允许识别空格，提高字幕分词准确率
  await worker.setParameters({
    tessedit_pageseg_mode: '6', // PSM 6 = 自动检测多行文本，保留空格
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!? ' // 加入空格
  });

  const { data: { text } } = await worker.recognize(dataUrl);
  await worker.terminate();
  console.log('【OCR】识别结果:', text);
  return text.trim();
} 