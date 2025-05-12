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
  const cropHeight = Math.floor(height * 0.08);

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

  // --- 添加图像预处理：二值化 ---
  const imageData = ctx.getImageData(0, 0, width, cropHeight);
  const data = imageData.data;
  const threshold = 200; // 阈值可以根据实际情况调整

  for (let i = 0; i < data.length; i += 4) {
    // 计算灰度值 (简单的平均法)
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;

    // 二值化：如果灰度值低于阈值，设为黑色；否则设为白色
    const color = avg < threshold ? 0 : 255;
    data[i] = color;     // Red
    data[i + 1] = color; // Green
    data[i + 2] = color; // Blue
    // Alpha (data[i + 3]) 不变
  }

  ctx.putImageData(imageData, 0, 0);
  // -------------------------------

  // 转成 dataURL 供 Tesseract.js 识别
  const dataUrl = canvas.toDataURL('image/png');

  // 创建并初始化 Tesseract.js 工作线程
  const worker = await createWorker();
  // 设置参数：使用自动（块）模式并允许识别空格，提高字幕分词准确率
  await worker.setParameters({
    tessedit_pageseg_mode: '6', // PSM 6 = 自动检测多行文本，保留空格
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?’ ', // 加入空格
    ocr_engine_mode: '1' // OCM 1 = 只使用 LSTM 引擎
  });

  const { data: { text } } = await worker.recognize(dataUrl);
  await worker.terminate();
  console.log('【OCR】识别结果:', text);
  return text.trim();
} 