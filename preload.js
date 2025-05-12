// preload.js
// 预加载脚本，将Node.js API暴露给渲染进程

console.log('--- Preload script: START ---');

// 引入必要模块
const { contextBridge, ipcRenderer } = require('electron');


// 白名单，列出允许渲染进程调用的IPC通道
const allowedInvokeChannels = [
  'extract-frame',
  'selectSubtitle',
  'getWatchTime',
  'saveLearningRecord',
  'getLearningRecords',
  // 'readVideo',
  'saveApiKey',
  'getApiKey'
];

const allowedSendChannels = [
  'getCategories',
  'getMovies',
  'updateWatchTime',
  'loadSubtitle'
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
];

// 使用 contextBridge 暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 调用主进程函数 (通常用于请求数据或执行操作)
  invoke: (channel, ...args) => {
    if (allowedInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    console.error(`【Preload】阻止调用未授权的 invoke 通道: ${channel}`);
    throw new Error(`Unauthorized invoke channel: ${channel}`);
  },
  
  // 发送消息到主进程 (通常用于触发事件，不一定期望直接返回值)
  send: (channel, ...args) => {
    if (allowedSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
       console.error(`【Preload】阻止发送到未授权的 send 通道: ${channel}`);
    }
  },
  
  // 监听来自主进程的消息
  on: (channel, listener) => {
    if (allowedReceiveChannels.includes(channel)) {
      const wrappedListener = (event, ...args) => {
        console.log(`【Preload】收到IPC消息: ${channel}`, args);
        listener(...args);
      };
      ipcRenderer.on(channel, wrappedListener);
      return () => {
        ipcRenderer.removeListener(channel, wrappedListener);
      };
    } else {
      console.error(`【Preload】阻止监听未授权的 receive 通道: ${channel}`);
      return () => {}; 
    }
  },

  // onOpenApiKeySettings: (callback) => {
  //   const channel = 'openApiKeySettings';
  //   if (allowedReceiveChannels.includes(channel)) {
  //       const listener = (event, ...args) => callback(...args);
  //       ipcRenderer.on(channel, listener);
  //       return () => ipcRenderer.removeListener(channel, listener); // 返回清理函数
  //   } else {
  //       console.error(`[Preload] 阻止监听未授权通道: ${channel}`);
  //       return () => {};
  //   }
  
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

  saveApiKey: (apiKey) => ipcRenderer.invoke('saveApiKey', apiKey),
  getApiKey: () => ipcRenderer.invoke('getApiKey'),


    
  
  // ============== 具体功能 API (简化) ============== 
  
  // 不再暴露 OCR 相关 API 给渲染进程
  // performOCR: (imageData) => ipcRenderer.invoke('perform-ocr', imageData),
  // performOCRFromFrame: (videoPath, timestamp) => ipcRenderer.invoke('perform-ocr-from-frame', { videoPath, timestamp }),
  
  // 帧提取 相关 (仍保留，但可能不由 OCR 使用)
  extractFrame: (videoPath, timestamp) => ipcRenderer.invoke('extract-frame', { videoPath, timestamp }),
  
  // 文件/目录 相关
  selectSubtitle: (videoPath) => ipcRenderer.invoke('selectSubtitle', { videoPath }),
  
  
  // 数据库 相关
  getCategories: () => ipcRenderer.send('getCategories'),
  getMovies: (category_id, page) => ipcRenderer.send('getMovies', { category_id, page }),
  getWatchTime: (videoId) => ipcRenderer.invoke('getWatchTime', videoId),
  updateWatchTime: (watchTimeData) => ipcRenderer.send('updateWatchTime', watchTimeData),
  saveLearningRecord: (record) => ipcRenderer.invoke('saveLearningRecord', record),
  getLearningRecords: (videoId) => ipcRenderer.invoke('getLearningRecords', videoId),
  platform: process.platform
  
});



console.log('--- Preload script: END ---'); 