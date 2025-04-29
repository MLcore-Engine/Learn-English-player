const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { app } = require('electron'); // 需要 app 来获取路径

const execFileAsync = promisify(execFile);

// 临时文件存储路径 (使用 userData 目录更可靠)
const tempDir = path.join(app.getPath('userData'), 'tempFrames');

// 确保临时目录存在
if (!fs.existsSync(tempDir)) {
  try {
    fs.mkdirSync(tempDir, { recursive: true });
  } catch (err) {
     console.error('【主进程】创建临时帧目录失败:', err);
     // 如果目录创建失败，后续操作会出错，但至少记录错误
  }
}

/**
 * 获取ffmpeg可执行文件路径 (只能在主进程调用)
 * @returns {string} ffmpeg路径
 */
function getFfmpegPath() {
  // 优先使用环境变量，方便调试和覆盖
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }
  
  // 生产环境中，ffmpeg通常会打包到应用资源目录
  // 注意：需要在 electron-builder 配置中包含 ffmpeg
  // 例如，在 build.extraResources 中配置
  const resourcesPath = app.isPackaged 
    ? process.resourcesPath 
    : path.join(__dirname, '..'); // 开发环境下假设在项目根目录附近
    
  const ffmpegExecutable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  
  // 尝试在不同位置查找
  const pathsToTry = [
    path.join(resourcesPath, 'bin', ffmpegExecutable), // 建议的打包位置
    path.join(resourcesPath, 'ffmpeg', ffmpegExecutable), // 旧的可能位置
    ffmpegExecutable // 最后尝试系统路径 (主要用于开发)
  ];
  
  for (const p of pathsToTry) {
     // 检查文件是否存在且可执行 (在非 Windows 上)
     try {
       fs.accessSync(p, fs.constants.X_OK);
       console.log('【主进程】找到ffmpeg路径:', p);
       return p;
     } catch (err) {
       // 忽略错误，继续尝试下一个路径
     }
  }
  
  console.error('【主进程】未找到ffmpeg可执行文件！请确保已正确配置或安装。');
  throw new Error('未找到ffmpeg');
}

/**
 * 将秒数格式化为 HH:MM:SS.mmm 格式 (内部函数)
 * @param {number} seconds - 秒数
 * @returns {string} - 格式化的时间字符串
 */
function formatTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * 从视频中提取特定时间点的帧 (通过IPC调用)
 * @param {string} videoPath - 视频文件路径
 * @param {number} timestamp - 时间戳(秒)
 * @returns {Promise<string>} - 提取的帧图像临时文件路径
 */
async function extractFrame(videoPath, timestamp) {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`视频文件不存在: ${videoPath}`);
  }

  // 生成唯一的输出文件名
  const outputFileName = `frame_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
  const outputPath = path.join(tempDir, outputFileName);
  
  try {
    const ffmpegPath = getFfmpegPath();
    const timeStr = formatTimestamp(timestamp);
    
    console.log(`【主进程】执行ffmpeg: ${ffmpegPath} -ss ${timeStr} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`);
    
    const { stdout, stderr } = await execFileAsync(ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error', // 只输出错误信息
      '-ss', timeStr,
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2', // JPEG质量 (1最好, 31最差)
      '-y', // 覆盖输出文件
      outputPath
    ]);
    
    if (stderr) {
      console.error('【主进程】ffmpeg提取帧时出错:', stderr);
      // 即使有 stderr，有时文件也可能成功创建，所以继续检查
    }
    
    if (!fs.existsSync(outputPath)) {
      throw new Error('提取帧失败: 输出文件不存在。ffmpeg stderr: ' + stderr);
    }
    
    console.log('【主进程】成功提取帧:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('【主进程】提取视频帧异常:', error);
    // 尝试删除可能已创建的不完整文件
    cleanupTempFile(outputPath);
    throw error;
  }
}

/**
 * 清理临时文件 (通过IPC调用或内部使用)
 * @param {string} filePath - 要删除的文件路径
 */
function cleanupTempFile(filePath) {
  // 基本的路径检查，防止删除临时目录外的文件
  if (!filePath || !filePath.startsWith(tempDir)) {
     console.warn('【主进程】尝试清理无效或非临时的文件路径:', filePath);
     return;
  }
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('【主进程】清理临时文件:', filePath);
    }
  } catch (error) {
    console.error('【主进程】清理临时文件失败:', filePath, error);
  }
}

// 应用退出时可以考虑清理整个临时目录
app.on('will-quit', () => {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('【主进程】清理整个临时帧目录:', tempDir);
    }
  } catch (error) {
    console.error('【主进程】退出时清理临时目录失败:', error);
  }
});

module.exports = {
  extractFrame,
  cleanupTempFile,
}; 