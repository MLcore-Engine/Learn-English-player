// 移除 Node.js 相关导入
// import fs from 'fs';
// import path from 'path';
// import { execFile } from 'child_process';
// import { promisify } from 'util';

// const execFileAsync = promisify(execFile);

/**
 * 视频帧提取客户端 - 与主进程通信提取视频帧
 */
class VideoFrameExtractorClient {

  /**
   * 从视频中提取特定时间点的帧 (调用主进程)
   * @param {string} videoPath - 视频文件路径 (主进程需要能访问)
   * @param {number} timestamp - 时间戳(秒)
   * @returns {Promise<string>} - 提取的帧图像的 Base64 Data URL
   * @throws {Error} 如果主进程返回错误
   */
  async extractFrame(videoPath, timestamp) {
    console.log(`【渲染进程】调用 electronAPI.extractFrame: ${videoPath} @ ${timestamp}s`);
    try {
      const result = await window.electronAPI.extractFrame(videoPath, timestamp);
      if (result.success) {
        return result.dataUrl; // 返回 Base64 Data URL
      } else {
        console.error('【渲染进程】主进程提取帧失败:', result.error);
        throw new Error(result.error || '主进程提取视频帧时发生未知错误');
      }
    } catch (error) {
      console.error('【渲染进程】调用 extractFrame 失败:', error);
      throw error;
    }
  }

  // 注意：清理临时文件的逻辑现在完全在主进程处理，渲染进程不需要调用 cleanup
}

// 创建并导出单例实例
const frameExtractorClient = new VideoFrameExtractorClient();
export default frameExtractorClient; 