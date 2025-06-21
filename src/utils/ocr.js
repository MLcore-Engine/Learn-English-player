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
  // 减小识别区域，只取底部10%
  const cropHeight = Math.floor(height * 0.1);

  // 创建临时 canvas 进行截图
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = cropHeight;
  const ctx = canvas.getContext('2d');
  
  // 截取底部区域，稍微上移一点
  ctx.drawImage(
    videoElement,
    0,
    height - cropHeight - Math.floor(height * 0.02), // 上移2%
    width,
    cropHeight,
    0,
    0,
    width,
    cropHeight
  );

  // --- 图像预处理 ---
  // 1. 提升图像分辨率 (放大2倍)
  // Tesseract.js 在处理更高分辨率的图像时通常表现更好，尤其是当原始字幕较小时。
  const scaleFactor = 2;
  const scaledCanvas = document.createElement('canvas');
  const scaledWidth = width * scaleFactor;
  const scaledHeight = cropHeight * scaleFactor;
  scaledCanvas.width = scaledWidth;
  scaledCanvas.height = scaledHeight;
  const scaledCtx = scaledCanvas.getContext('2d');
  scaledCtx.imageSmoothingEnabled = false; // 禁用平滑以保持边缘清晰
  scaledCtx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);

  // 2. 图像二值化
  // 注意：这是一个简单的固定阈值方法。对于不同颜色或亮度的字幕，效果可能不稳定。
  // 更高级的方法是"自适应阈值"，但这在前端 Canvas 中实现复杂。
  // 这里的阈值(200)是基于"亮色文字、暗色背景"的常见假设。
  const imageData = scaledCtx.getImageData(0, 0, scaledWidth, scaledHeight);
  const data = imageData.data;
  const threshold = 200; 

  for (let i = 0; i < data.length; i += 4) {
    // 使用加权平均法计算灰度值，更符合人眼感知
    const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    
    // 如果灰度值低于阈值，设为黑色；否则设为白色
    const color = avg < threshold ? 0 : 255;
    data[i] = color;     // Red
    data[i + 1] = color; // Green
    data[i + 2] = color; // Blue
  }

  scaledCtx.putImageData(imageData, 0, 0);
  // --- 预处理结束 ---

  // 转成 dataURL 供 Tesseract.js 识别
  const dataUrl = scaledCanvas.toDataURL('image/png');

  // 创建并初始化 Tesseract.js 工作线程
  // 性能提示: 在实际应用中，建议初始化一个worker并复用，而不是每次调用都创建新的。
  // 这需要调整应用架构，例如在组件挂载时创建，在卸载时销毁。
  const worker = await createWorker();
  
  // 简化 Tesseract.js 参数配置，保留核心设置
  // 移除了过于具体和可能产生冲突的 `textord_*` 参数，依赖 Tesseract 的通用算法。
  await worker.setParameters({
    tessedit_pageseg_mode: '7', // PSM 7 = 将图像视为单行文本，适合字幕
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?\'" ', // 简化的白名单
    preserve_interword_spaces: '1', // 保留词间空格，对句子很重要
  });

  const { data: { text } } = await worker.recognize(dataUrl);
  await worker.terminate();
  
  // 后处理：清理识别结果
  let cleanedText = text
    .replace(/\s+/g, ' ') // 合并多个空格
    .trim();

  // 过滤掉常见的干扰内容
  cleanedText = cleanedText
    // 移除常见的字幕编号和时间码
    .replace(/^\d+\s*/, '') // 移除开头的数字
    .replace(/^\d{1,2}:\d{2}(:\d{2})?\s*/, '') // 移除时间码 (如 "01:23" 或 "01:23:45")
    // 移除常见的标识符
    .replace(/^(PR|CC|SD|HD|SUB|CAP)\s*/i, '') // 移除常见的字幕标识
    .replace(/^[A-Z]{2,3}\s+/, '') // 移除2-3个大写字母（如 "PR"）
    .replace(/^ie\s*/i, '') // 移除 "ie" 前缀
    // 移除其他可能的干扰内容
    .replace(/^[^a-zA-Z]+/, '') // 移除开头的非字母字符
    .trim();

  console.log('【OCR】原始识别结果:', text);
  console.log('【OCR】清理后结果:', cleanedText);
  return cleanedText;
}