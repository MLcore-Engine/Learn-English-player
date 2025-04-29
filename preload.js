// preload.js
// 预加载脚本，将Node.js API暴露给渲染进程

// 引入必要模块
const { contextBridge, ipcRenderer } = require('electron');
// 移除未使用的 Node.js 模块导入
// const path = require('path');
// const fs = require('fs');
// const os = require('os');

// 白名单，列出允许渲染进程调用的IPC通道
const allowedInvokeChannels = [
  'perform-ocr', 
  'perform-ocr-from-frame', 
  'extract-frame',
  'selectVideo', // 已有
  'getWatchTime', // 已有
  'saveLearningRecord', // 已有
  'getLearningRecords' // 已有
];

const allowedSendChannels = [
  'getCategories', // 已有
  'getMovies', // 已有
  'updateWatchTime', // 已有
  'loadSubtitle' // 添加，因为 App.js 调用 send('loadSubtitle')
];

const allowedReceiveChannels = [
  'categories', // 已有
  'movies', // 已有
  'watchTime', // 已有 (虽然现在是 invoke，但可能仍有其他地方用)
  'error', // 已有
  'databaseInitError', // 已有
  'learningRecords', // 已有 (虽然现在是 invoke)
  'subtitleLoaded' // <--- 添加这个
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
      // 创建一个新的包装函数，在调用原始监听器之前进行日志记录
      const wrappedListener = (event, ...args) => {
        console.log(`【Preload】收到IPC消息: ${channel}`, args);
        listener(...args);
      };
      ipcRenderer.on(channel, wrappedListener);
      
      // 返回一个移除监听器的函数，确保正确移除包装后的监听器
      return () => {
        ipcRenderer.removeListener(channel, wrappedListener);
      };
    } else {
      console.error(`【Preload】阻止监听未授权的 receive 通道: ${channel}`);
      // 返回一个无操作函数，以保持API一致性
      return () => {}; 
    }
  },
  
  // 移除特定监听器 (如果需要精确移除的话)
  removeListener: (channel, listener) => {
     if (allowedReceiveChannels.includes(channel)) {
       // 注意：这种方式可能无法移除用 wrappedListener 包装的监听器
       // 如果需要精确移除，需要保存原始 listener 和 wrappedListener 的映射
       // 或者，上面 on 方法返回的函数是更可靠的移除方式
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
  
  // ============== 具体功能 API ============== 
  
  // OCR 相关
  performOCR: (imageData) => ipcRenderer.invoke('perform-ocr', imageData),
  performOCRFromFrame: (videoPath, timestamp) => ipcRenderer.invoke('perform-ocr-from-frame', { videoPath, timestamp }),
  
  // 帧提取 相关
  extractFrame: (videoPath, timestamp) => ipcRenderer.invoke('extract-frame', { videoPath, timestamp }),
  
  // 文件/目录 相关
  selectVideo: () => ipcRenderer.invoke('selectVideo'),
  
  // 数据库 相关
  getCategories: () => ipcRenderer.send('getCategories'), // 假设 getCategories 是 send/on 模式
  getMovies: (category_id, page) => ipcRenderer.send('getMovies', { category_id, page }), // 假设 getMovies 是 send/on 模式
  getWatchTime: (videoId) => ipcRenderer.invoke('getWatchTime', videoId),
  updateWatchTime: (watchTimeData) => ipcRenderer.send('updateWatchTime', watchTimeData), // 假设是 send/on 模式
  saveLearningRecord: (record) => ipcRenderer.invoke('saveLearningRecord', record),
  getLearningRecords: (videoId) => ipcRenderer.invoke('getLearningRecords', videoId)
  
  // 可以继续添加其他需要的API...
});

console.log('【Preload】electronAPI 已注入到 window 对象');

// 标记preload脚本已加载
console.log('【preload】预加载脚本已执行');

// 为不支持contextBridge的环境提供fallback (应该避免在生产环境中使用)
if (process.env.NODE_ENV === 'development') {
  window.require = require;
} 