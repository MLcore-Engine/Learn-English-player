import { createWorker } from 'tesseract.js';

/**
 * 从 video 元素中截取底部 15% 区域并进行 OCR 识别
 * todo 未来版本考虑引入 OpenCV.js 提供图像分析算法所需的底层工具 利用二值化、灰度化、高斯模糊等算法提高识别准确率
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

  // --- 图像预处理 ---
  const imageData = ctx.getImageData(0, 0, width, cropHeight);
  const data = imageData.data;

  // 1. 灰度化
  const grayscaleData = new Uint8ClampedArray(width * cropHeight);
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    grayscaleData[i / 4] = avg;
  }

  // 2. 应用3x3中值滤波 (简化版，跳过边缘)
  const medianFilteredData = new Uint8ClampedArray(grayscaleData.length);
  for (let y = 0; y < cropHeight; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (x === 0 || x === width - 1 || y === 0 || y === cropHeight - 1) {
        medianFilteredData[index] = grayscaleData[index]; // 边缘像素直接复制
        continue;
      }
      const neighborhood = [];
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          neighborhood.push(grayscaleData[(y + j) * width + (x + i)]);
        }
      }
      neighborhood.sort((a, b) => a - b);
      medianFilteredData[index] = neighborhood[4]; // 取中值
    }
  }

  // 3. 直方图均衡化 (Contrast Adjustment)
  const heHistogram = new Array(256).fill(0);
  for (let i = 0; i < medianFilteredData.length; i++) {
    heHistogram[medianFilteredData[i]]++;
  }

  const cdf = new Array(256).fill(0);
  cdf[0] = heHistogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + heHistogram[i];
  }

  const cdfMin = cdf.find(val => val > 0) || 0; // 找到第一个非零的CDF值
  const totalPixelsForHE = medianFilteredData.length;
  const equalizedData = new Uint8ClampedArray(totalPixelsForHE);
  for (let i = 0; i < totalPixelsForHE; i++) {
    const pixelValue = medianFilteredData[i];
    equalizedData[i] = Math.round(((cdf[pixelValue] - cdfMin) / (totalPixelsForHE - cdfMin)) * 255);
  }
  
  // 4. Otsu's 二值化 (使用均衡化后的数据)
  // 计算直方图
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < equalizedData.length; i++) {
    histogram[equalizedData[i]]++;
  }

  let totalPixels = equalizedData.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0; // 背景像素数
  let wF = 0; // 前景像素数
  let varMax = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;

    wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];

    let mB = sumB / wB; // 背景平均灰度
    let mF = (sum - sumB) / wF; // 前景平均灰度

    // 类间方差
    let varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }

  // 应用Otsu阈值进行二值化
  for (let i = 0; i < data.length; i += 4) {
    const grayValue = equalizedData[i / 4]; // 使用均衡化后的数据
    const color = grayValue > threshold ? 255 : 0;
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
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?’‘” ', // 加入空格
    ocr_engine_mode: '1' // OCM 1 = 只使用 LSTM 引擎
  });

  const { data: { text } } = await worker.recognize(dataUrl);
  await worker.terminate();
  console.log('【OCR】识别结果:', text);
  return text.trim();
} 