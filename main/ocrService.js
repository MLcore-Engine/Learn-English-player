const ort = require('onnxruntime-node');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');
const { extractFrame, cleanupTempFile } = require('./videoFrameExtractor'); // 假设 videoFrameExtractor 也在 main/ 下

let session = null;
let isInitialized = false;
let modelPath = ''; // 存储模型路径

/**
 * 初始化OCR模型 (只能在主进程调用)
 * @param {string} providedModelPath - ONNX模型文件路径
 * @returns {Promise<boolean>} - 初始化是否成功
 */
async function initializeOCR(providedModelPath) {
  try {
    // TODO: 考虑模型文件应该放在哪里？asar打包后可能无法直接访问外部文件
    // 也许需要将模型复制到 userData 目录
    modelPath = providedModelPath; // 保存路径供后续使用
    if (!fs.existsSync(modelPath)) {
      console.error('【主进程】OCR模型文件不存在:', modelPath);
      return false;
    }

    const options = {
      executionProviders: ['cpu'],
      graphOptimizationLevel: 'all'
    };

    session = await ort.InferenceSession.create(modelPath, options);
    isInitialized = true;
    console.log('【主进程】OCR模型初始化成功');
    return true;
  } catch (error) {
    console.error('【主进程】初始化OCR模型失败:', error);
    isInitialized = false;
    return false;
  }
}

/**
 * 预处理图像 (内部函数)
 * @param {Buffer|string} imageData - 图像数据Buffer或图像文件路径
 * @returns {Promise<Float32Array>} - 预处理后的图像数据
 */
async function preprocessImage(imageData) {
  // ... (与原 src/utils/ocrService.js 中的 preprocessImage 逻辑相同，使用 Jimp) ...
  // 注意：Jimp.read 可能需要处理 Buffer 和文件路径两种情况
   try {
      // 加载图像
      let image;
      if (typeof imageData === 'string') {
        // 从文件路径加载
        image = await Jimp.read(imageData);
      } else {
        // 从Buffer加载
        image = await Jimp.read(imageData);
      }

      // 调整尺寸 (根据模型要求调整)
      image.resize(224, 224);

      // 转换为RGB格式
      const width = image.bitmap.width;
      const height = image.bitmap.height;

      // 创建输入张量数据
      const tensorData = new Float32Array(width * height * 3);
      let tensorIdx = 0; // 使用单独的索引

      // 遍历图像像素并归一化
      image.scan(0, 0, width, height, function(x, y, idx) {
        const red = this.bitmap.data[idx + 0] / 255.0;
        const green = this.bitmap.data[idx + 1] / 255.0;
        const blue = this.bitmap.data[idx + 2] / 255.0;

        // RGB顺序的张量数据 (具体顺序根据模型要求调整)
        // 假设模型需要 [batch, channels, height, width] 即 CHW
        // (需要根据实际模型调整)
        tensorData[tensorIdx] = red;          // R channel
        tensorData[tensorIdx + width * height] = green; // G channel
        tensorData[tensorIdx + 2 * width * height] = blue; // B channel

        tensorIdx += 1; // 移动到下一个像素位置
      });

      return tensorData;
    } catch (error) {
      console.error('【主进程】图像预处理失败:', error);
      throw error; // 向上抛出错误
    }
}

/**
 * 后处理OCR模型输出结果 (内部函数)
 * @param {Array} outputData - 模型输出数据
 * @returns {string} - 解析后的文本
 */
function postprocessResult(outputData) {
  // ... (与原 src/utils/ocrService.js 中的 postprocessResult 逻辑相同) ...
  // 这里的实现取决于您的OCR模型的具体输出格式
  // 需要根据您的模型文档来实现正确的后处理逻辑

  // 示例实现 (仅用于说明，需要根据实际模型调整)
  let text = '【主进程】后处理未实现'; // 占位符
  // ... 处理逻辑

  return text;
}


/**
 * 对图像执行OCR识别 (通过IPC调用)
 * @param {Buffer|string} imageData - 图像数据Buffer或图像文件路径
 * @returns {Promise<string>} - 识别出的文本
 */
async function performOCR(imageData) {
  if (!isInitialized) {
     // 尝试重新初始化？或者返回错误
     console.warn('【主进程】OCR未初始化，尝试重新初始化...');
     const success = await initializeOCR(modelPath); // 使用之前保存的路径
     if (!success) {
       throw new Error('OCR模型尚未初始化且无法重新初始化');
     }
  }

  try {
    const preprocessedData = await preprocessImage(imageData);
    const inputTensor = new ort.Tensor('float32', preprocessedData, [1, 3, 224, 224]); // Shape [batch, channels, height, width]
    const feeds = { input: inputTensor }; // 输入名称需根据模型调整
    const results = await session.run(feeds);
    const outputData = results.output.data; // 输出名称需根据模型调整
    let recognizedText = postprocessResult(outputData);
    return recognizedText;
  } catch (error) {
    console.error('【主进程】OCR识别失败:', error);
    throw error; // 让错误传递给IPC调用者
  }
}


/**
 * 从视频帧中识别文本 (通过IPC调用)
 * @param {string} videoPath - 视频文件路径
 * @param {number} timestamp - 时间戳(秒)
 * @returns {Promise<string>} - 识别出的文本
 */
async function performOCRFromVideoFrame(videoPath, timestamp) {
  let frameImagePath = null;
  try {
    frameImagePath = await extractFrame(videoPath, timestamp);
    const recognizedText = await performOCR(frameImagePath); // 调用上面的 performOCR
    return recognizedText;
  } catch (error) {
    console.error('【主进程】从视频帧识别文本失败:', error);
    throw error;
  } finally {
    // 无论成功失败，都尝试清理临时文件
    if (frameImagePath) {
      cleanupTempFile(frameImagePath);
    }
  }
}


module.exports = {
  initializeOCR,
  performOCR,
  performOCRFromVideoFrame,
}; 