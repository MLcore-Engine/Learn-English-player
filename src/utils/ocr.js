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
  
  // 优化 Tesseract.js 参数配置
  await worker.setParameters({
    tessedit_pageseg_mode: '7', // PSM 7 = 将图像视为单行文本
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?\'\"“”‘’ ', // 只允许英文字符
    ocr_engine_mode: '1', // OCM 1 = 只使用 LSTM 引擎
    preserve_interword_spaces: '1', // 保留词间空格
    textord_heavy_nr: '1', // 增强降噪
    textord_min_linesize: '2.5', // 最小行高
    textord_max_linesize: '3.5', // 最大行高
    textord_parallel_baselines: '1', // 并行基线检测
    textord_parallel_lines: '1', // 并行线检测
    textord_parallel_scale: '0.5', // 并行缩放
    textord_parallel_skew: '0.5', // 并行倾斜
    textord_parallel_skew_scale: '0.5', // 并行倾斜缩放
    textord_parallel_skew_scale2: '0.5', // 并行倾斜缩放2
    textord_parallel_skew_scale3: '0.5', // 并行倾斜缩放3
    textord_parallel_skew_scale4: '0.5', // 并行倾斜缩放4
    textord_parallel_skew_scale5: '0.5', // 并行倾斜缩放5
    textord_parallel_skew_scale6: '0.5', // 并行倾斜缩放6
    textord_parallel_skew_scale7: '0.5', // 并行倾斜缩放7
    textord_parallel_skew_scale8: '0.5', // 并行倾斜缩放8
    textord_parallel_skew_scale9: '0.5', // 并行倾斜缩放9
    textord_parallel_skew_scale10: '0.5', // 并行倾斜缩放10
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

// 计算块平均值
function calculateBlockAverage(data, x, y, width, height, blockSize) {
  let sum = 0;
  let count = 0;
  const halfBlock = Math.floor(blockSize / 2);
  
  for (let dy = -halfBlock; dy <= halfBlock; dy++) {
    for (let dx = -halfBlock; dx <= halfBlock; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = (ny * width + nx) * 4;
        sum += data[idx];
        count++;
      }
    }
  }
  return sum / count;
}

// 检测噪点
function isNoisePixel(data, x, y, width) {
  const idx = (y * width + x) * 4;
  const center = data[idx];
  
  // 检查周围8个像素
  const neighbors = [
    data[(y-1) * width * 4 + (x-1) * 4],
    data[(y-1) * width * 4 + x * 4],
    data[(y-1) * width * 4 + (x+1) * 4],
    data[y * width * 4 + (x-1) * 4],
    data[y * width * 4 + (x+1) * 4],
    data[(y+1) * width * 4 + (x-1) * 4],
    data[(y+1) * width * 4 + x * 4],
    data[(y+1) * width * 4 + (x+1) * 4]
  ];
  
  // 如果中心像素与周围像素差异太大，认为是噪点
  const threshold = 50;
  const differentNeighbors = neighbors.filter(n => Math.abs(n - center) > threshold).length;
  return differentNeighbors >= 6;
} 