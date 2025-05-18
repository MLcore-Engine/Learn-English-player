// preload.js
// 预加载脚本，将Node.js API暴露给渲染进程

console.log('--- Preload script: START ---');

// 引入必要模块
const { contextBridge, ipcRenderer } = require('electron');

// 白名单，列出允许渲染进程调用的IPC通道
const allowedInvokeChannels = [
  'extract-frame',
  'selectSubtitle',
  'selectVideo',
  'getWatchTime',
  'saveLearningRecord',
  'saveAiQuery',
  'getLearningRecords',
  'saveApiKey',
  'getApiKey',
  'install-update'  // 新增：用于触发更新安装
];

const allowedSendChannels = [
  'getCategories',
  'getMovies',
  'updateWatchTime',
  'loadSubtitle',
  'checkDatabaseStatus',  // 新增：检查数据库状态
  'deleteLearningRecord', // 新增：删除学习记录
  'getLearningStats',     // 新增：获取学习统计
  'getWatchingStats'      // 新增：获取观看统计
];

const allowedReceiveChannels = [
  'categories',
  'movies',
  'watchTime',
  'error',
  'databaseInitError',
  'learningRecords',
  'subtitleLoaded',
  'videoSelectedFromMenu',
  'openApiKeySettings',
  'update-available',     // 新增：更新可用通知
  'update-downloaded',    // 新增：更新已下载通知
  'watchTimeUpdated',     // 新增：观看时间更新通知
  'learningRecordDeleted', // 新增：学习记录删除通知
  'learningStats',        // 新增：学习统计信息
  'watchingStats',        // 新增：观看统计信息
  'databaseStatus'        // 新增：数据库状态
];

// 请求频率限制
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 1000; // 1秒
const MAX_REQUESTS_PER_WINDOW = 10;

// 检查请求频率
function checkRateLimit(channel) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimits.has(channel)) {
    rateLimits.set(channel, []);
  }
  
  const requests = rateLimits.get(channel);
  const validRequests = requests.filter(time => time > windowStart);
  rateLimits.set(channel, validRequests);
  
  if (validRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new Error(`Rate limit exceeded for channel: ${channel}`);
  }
  
  validRequests.push(now);
}

// 使用 contextBridge 暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 调用主进程函数 (通常用于请求数据或执行操作)
  invoke: (channel, ...args) => {
    if (allowedInvokeChannels.includes(channel)) {
      try {
        checkRateLimit(channel);
        console.log(`【Preload】调用 invoke 通道: ${channel}`, args);
        return ipcRenderer.invoke(channel, ...args);
      } catch (error) {
        console.error(`【Preload】invoke 调用失败: ${channel}`, error);
        throw error;
      }
    }
    console.error(`【Preload】阻止调用未授权的 invoke 通道: ${channel}`);
    throw new Error(`Unauthorized invoke channel: ${channel}`);
  },
  
  // 发送消息到主进程 (通常用于触发事件，不一定期望直接返回值)
  send: (channel, ...args) => {
    if (allowedSendChannels.includes(channel)) {
      try {
        checkRateLimit(channel);
        console.log(`【Preload】发送到 send 通道: ${channel}`, args);
        ipcRenderer.send(channel, ...args);
      } catch (error) {
        console.error(`【Preload】send 发送失败: ${channel}`, error);
      }
    } else {
      console.error(`【Preload】阻止发送到未授权的 send 通道: ${channel}`);
    }
  },
  
  // 监听来自主进程的消息
  on: (channel, listener) => {
    if (allowedReceiveChannels.includes(channel)) {
      // 使用唯一的包装函数来避免重复注册问题
      const wrappedListener = (event, ...args) => {
        console.log(`【Preload】收到IPC消息: ${channel}`, args);
        listener(...args);
      };
      
      // 存储包装函数的引用，以便后续可以移除
      ipcRenderer.on(channel, wrappedListener);
      
      // 返回清理函数
      return () => {
        ipcRenderer.removeListener(channel, wrappedListener);
      };
    } else {
      console.error(`【Preload】阻止监听未授权的 receive 通道: ${channel}`);
      return () => {}; 
    }
  },
  
  // 移除特定监听器
  removeListener: (channel, listener) => {
     if (allowedReceiveChannels.includes(channel)) {
       ipcRenderer.removeListener(channel, listener);
     } else {
        console.error(`【Preload】尝试移除未授权通道的监听器: ${channel}`);
     }
  },
  
  // 移除某个通道的所有监听器
  removeAllListeners: (channel) => {
     if (allowedReceiveChannels.includes(channel)) {
       ipcRenderer.removeAllListeners(channel);
     } else {
        console.error(`【Preload】尝试移除未授权通道的所有监听器: ${channel}`);
     }
  },

  // API Key相关
  saveApiKey: (apiKey) => ipcRenderer.invoke('saveApiKey', apiKey),
  getApiKey: () => ipcRenderer.invoke('getApiKey'),
  
  // ============== 具体功能 API (简化) ============== 
  
  // 帧提取相关
  extractFrame: (videoPath, timestamp) => ipcRenderer.invoke('extract-frame', { videoPath, timestamp }),
  
  // 文件/目录相关
  selectVideo: () => ipcRenderer.invoke('selectVideo'),
  selectSubtitle: (videoPath) => ipcRenderer.invoke('selectSubtitle', { videoPath }),
  
  // 数据库相关
  getCategories: () => ipcRenderer.send('getCategories'),
  getMovies: (category_id, page) => ipcRenderer.send('getMovies', { category_id, page }),
  getWatchTime: (videoId) => ipcRenderer.invoke('getWatchTime', videoId),
  updateWatchTime: (watchTimeData) => ipcRenderer.send('updateWatchTime', watchTimeData),
  saveLearningRecord: (record) => ipcRenderer.invoke('saveLearningRecord', record),
  saveAiQuery: (data) => ipcRenderer.invoke('saveAiQuery', data),
  getLearningRecords: (videoId) => ipcRenderer.invoke('getLearningRecords', videoId),
  
  // 系统信息
  platform: process.platform
});

console.log('--- Preload script: END ---'); 