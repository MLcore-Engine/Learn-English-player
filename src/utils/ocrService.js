// 移除 Node.js 相关导入
// import * as ort from 'onnxruntime-node';
// import Jimp from 'jimp';
// import path from 'path';
// import fs from 'fs';
// import frameExtractor from './videoFrameExtractor'; // 移除对旧 frameExtractor 的依赖

/**
 * OCR服务客户端 - 与主进程通信执行OCR
 */
class OCRServiceClient {
  /**
   * 对图像执行OCR识别 (调用主进程)
   * @param {Buffer|ArrayBuffer|Uint8Array} imageData - 图像数据 (应为Buffer兼容类型)
   * @returns {Promise<string>} - 识别出的文本
   * @throws {Error} 如果主进程返回错误
   */
  async recognizeText(imageData) {
    console.log('【渲染进程】调用 electronAPI.performOCR');
    try {
      // 确保 imageData 是可以序列化传递的类型，如 Uint8Array 或 ArrayBuffer
      // 如果是 Canvas ImageData，需要先转换为 ArrayBuffer/Blob/DataURL
      const result = await window.electronAPI.performOCR(imageData);
      if (result.success) {
        return result.text;
      } else {
        console.error('【渲染进程】主进程OCR失败:', result.error);
        throw new Error(result.error || '主进程执行OCR时发生未知错误');
      }
    } catch (error) {
      console.error('【渲染进程】调用 performOCR 失败:', error);
      throw error;
    }
  }

  /**
   * 从视频帧中识别文本 (调用主进程)
   * @param {string} videoPath - 视频文件路径 (主进程需要能访问)
   * @param {number} timestamp - 时间戳(秒)
   * @returns {Promise<string>} - 识别出的文本
   * @throws {Error} 如果主进程返回错误
   */
  async recognizeFromVideoFrame(videoPath, timestamp) {
    console.log(`【渲染进程】调用 electronAPI.performOCRFromFrame: ${videoPath} @ ${timestamp}s`);
    try {
      const result = await window.electronAPI.performOCRFromFrame(videoPath, timestamp);
      if (result.success) {
        return result.text;
      } else {
        console.error('【渲染进程】主进程帧OCR失败:', result.error);
        throw new Error(result.error || '主进程从视频帧执行OCR时发生未知错误');
      }
    } catch (error) {
      console.error('【渲染进程】调用 performOCRFromFrame 失败:', error);
      throw error;
    }
  }
}

// 创建并导出单例实例
const ocrServiceClient = new OCRServiceClient();
export default ocrServiceClient; 