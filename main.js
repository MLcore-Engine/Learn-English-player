const { app, BrowserWindow, ipcMain, dialog, Menu, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { parseSync } = require('subtitle'); // 引入 subtitle 库
const { extractFrame, cleanupTempFile } = require('./main/videoFrameExtractor'); // 引入主进程帧提取器
const Store = require('electron-store'); // 引入electron-store用于保存配置
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const axios = require('axios');
const express = require('express');
const http = require('http');
const urlModule = require('url');

// 注册为安全协议，支持流媒体加载
protocol.registerSchemesAsPrivileged([{ scheme: 'lep', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, bypassCSP: true } }]);

// 创建配置存储实例
const store = new Store();

// 获取上次打开目录或默认视频目录
const lastVideoDir = store.get('lastVideoDir') || app.getPath('videos');

const algorithm = 'aes-256-cbc';
const encryptionSecret = crypto.createHash('sha256').update('lep-very-secret-key-replace-me').digest('base64').substring(0, 32);
// IV 必须是 16 字节
const iv = Buffer.from('lepinitialvector', 'utf8'); // 固定 IV 也是不推荐的，但简化了演示

// 加密函数
function encrypt(text) {
  try {
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(encryptionSecret), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('加密失败:', error);
    return null;
  }
}

// 解密函数
function decrypt(encryptedHex) {
  try {
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(encryptionSecret), iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('解密失败:', error);
    return null;
  }
}
// --- 结束加密配置 ---

ipcMain.handle('saveApiKey', (event, apiKey) => {
  console.log('【主进程】收到 saveApiKey 请求');
  if (!apiKey) {
      console.log('【主进程】API Key 为空，清除存储');
      store.delete('encryptedApiKey'); // 如果传入空值，则删除 Key
      return { success: true, message: 'API Key 已清除' };
  }
  try {
    const encryptedApiKey = encrypt(apiKey);
    if (encryptedApiKey) {
      store.set('encryptedApiKey', encryptedApiKey);
      console.log('【主进程】加密后的 API Key 已保存');
      return { success: true };
    } else {
      console.error('【主进程】加密 API Key 失败');
      return { success: false, error: '加密失败' };
    }
  } catch (error) {
    console.error('【主进程】保存 API Key 时出错:', error);
    return { success: false, error: error.message };
  }
});

// 获取 API Key
ipcMain.handle('getApiKey', (event) => {
  console.log('【主进程】收到 getApiKey 请求');
  try {
    const encryptedApiKey = store.get('encryptedApiKey');
    if (encryptedApiKey) {
      const decryptedApiKey = decrypt(encryptedApiKey);
      if (decryptedApiKey !== null) {
        console.log('【主进程】成功解密并返回 API Key');
        return { success: true, apiKey: decryptedApiKey };
      } else {
         console.error('【主进程】解密 API Key 失败');
         // 如果解密失败，可能意味着密钥已更改或数据损坏，最好清除它
         store.delete('encryptedApiKey');
         return { success: false, error: '解密失败，Key 已被清除' };
      }
    } else {
      console.log('【主进程】未找到已存储的 API Key');
      return { success: true, apiKey: null }; // 没有存储 Key 不算错误
    }
  } catch (error) {
    console.error('【主进程】获取 API Key 时出错:', error);
    return { success: false, error: error.message };
  }
});
// --- 结束 IPC 处理程序 ---

// 数据存储目录（放在用户目录，避免在 asar 内创建）
const appDataPath = app.getPath('userData');
const DATA_PATH = path.join(appDataPath, 'data');
const DB_PATH = path.join(DATA_PATH, 'userdata.db');

// 设置应用名称，用于 macOS 菜单
app.setName('LEP');

let mainWindow;
let db;

console.log('应用路径信息:', {
  __dirname,
  appDataPath,
  DATA_PATH,
  DB_PATH,
  lastVideoDir
});

// 配置日志
log.transports.file.level = 'info';
autoUpdater.logger = log;

// 配置自动更新
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// ===== 新增：本地HTTP服务器用于视频范围请求 =====
let videoServerPort;
// 启动本地 HTTP 服务用于视频流分段加载
const videoServer = http.createServer((req, res) => {
  // 添加 CORS 支持
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const parsedUrl = urlModule.parse(req.url, true);
  if (parsedUrl.pathname !== '/video') {
    res.statusCode = 404;
    return res.end();
  }
  const fileParam = parsedUrl.query.path;
  const decodedPath = decodeURIComponent(fileParam || '');
  const filePath = path.isAbsolute(decodedPath) ? decodedPath : path.resolve(decodedPath);
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    return res.end();
  }
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' });
    return fs.createReadStream(filePath).pipe(res);
  }
  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  const chunksize = end - start + 1;
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunksize,
    'Content-Type': 'video/mp4'
  });
  return fs.createReadStream(filePath, { start, end }).pipe(res);
});
videoServerPort = 6459;
videoServer.listen(videoServerPort, '127.0.0.1', () => {
  console.log('【主进程】视频 HTTP 服务启动，端口:', videoServerPort);
});
// IPC: 获取视频服务器端口
ipcMain.handle('getVideoServerPort', () => 6459);

// 注册自定义协议 app:// 用于文件直接访问（可选）
protocol.registerSchemesAsPrivileged([{ scheme: 'lep', privileges: { standard: true, secure: true } }]);
// 添加新的 app 协议
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true } }]);

// 应用启动时创建窗口
app.whenReady().then(async () => {
  // 注册 app:// 协议，映射到 videos 目录
  protocol.registerFileProtocol('app', (request, callback) => {
    const urlPath = request.url.replace('app:///', '');
    const decodedPath = decodeURIComponent(urlPath);
    const baseDir = path.join(__dirname, 'videos');
    const filePath = path.join(baseDir, decodedPath);
    // 安全检查，防止越权访问
    if (!filePath.startsWith(baseDir) || !fs.existsSync(filePath)) {
      return callback({ error: -6 });
    }
    return callback({ path: filePath });
  });

  // 确保数据目录存在
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
  }
  
  // 初始化数据库连接，添加错误处理
  try {
    db = new Database(DB_PATH);
    // 创建global_usage表，记录全局使用时间
    console.log('创建global_usage表');
    db.exec(`
      CREATE TABLE IF NOT EXISTS global_usage (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        total_time INTEGER NOT NULL DEFAULT 0
      );
    `);
    // 创建 daily_usage 表，按日期记录当日会话时长
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_usage (
        date TEXT PRIMARY KEY,
        session_time INTEGER NOT NULL DEFAULT 0
      );
    `);
    // 创建 video_progress 表，保存每个视频的播放进度
    db.exec(`
      CREATE TABLE IF NOT EXISTS video_progress (
        video_id TEXT PRIMARY KEY,
        last_position INTEGER,
        last_watched TEXT
      );
    `);
    // 创建 learning_records 表，保存学习记录
    console.log('创建learning_records表');
    db.exec(`
      CREATE TABLE IF NOT EXISTS learning_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT,
        subtitle_id INTEGER,
        content TEXT,
        translation TEXT,
        note TEXT,
        created_at TEXT
      );
    `);
    // 创建 ai_queries 表，用于存储用户的AI查询记录
    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        explanation TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    // 创建查询历史记录表
    db.exec(`
      CREATE TABLE IF NOT EXISTS query_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_text TEXT NOT NULL,
        response_text TEXT,
        query_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        video_id TEXT,
        FOREIGN KEY (video_id) REFERENCES video_progress(video_id)
      );
    `);
    
    // 验证表是否成功创建
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log('数据库中的表:', tables.map(t => t.name).join(', '));
    } catch (err) {
      console.error('获取表列表失败:', err);
    }
  } catch (error) {
    console.error('数据库初始化失败:', error);
    db = null;
    if (mainWindow) {
      mainWindow.webContents.send('databaseInitError', { error: error.message, dbPath: DB_PATH });
    }
  }
  let iconPath;

  if (process.platform === 'win32') {
    iconPath = path.join(__dirname, 'assets', 'icon.ico');
  } else if (process.platform === 'linux') {
    iconPath = path.join(__dirname, 'assets', 'icon.png');
  } else {
    // macOS 通常不需要在 BrowserWindow 中设置图标（使用 .icns + Info.plist）
    iconPath = undefined;
  }
  
  // Create the main window
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
    minWidth: 1200,
    minHeight: 600,
    icon: iconPath, // 你的图标路径
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true, // 启用 webSecurity
    }
  });
  
  // 检查命令行参数获取开发服务器 URL
  const devServerUrlArg = process.argv.find(arg => arg.startsWith('--devServerUrl='));
  const devServerUrl = devServerUrlArg?.split('=')[1] || null;

  const startUrl = devServerUrl || `file://${path.join(__dirname, 'build', 'index.html')}`;

  console.log('最终加载URL:', startUrl); // 保留此关键日志

  mainWindow.loadURL(startUrl)
    .then(() => {
      console.log(`成功加载URL: ${startUrl}`); // 保留
      if (devServerUrl) {
        mainWindow.webContents.executeJavaScript('document.title')
          .then(title => console.log('开发服务器页面标题:', title))
          .catch(e => console.error('无法获取开发服务器页面标题:', e));
      }
      // 设置 CSP 头
      mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        // 跳过自定义 lep 协议的 CSP 限制，直接返回原始头
        if (details.url.startsWith('lep://')) {
          return callback({ responseHeaders: details.responseHeaders });
        }
        // 对其他请求，添加 CSP，允许 lep: 和 media-src
        const csp = "default-src 'self' lep:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; media-src 'self' lep: data: blob: http://127.0.0.1:* http://localhost:*;";
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [csp]
          }
        });
      });
    })
    .catch(err => {
      console.error(`加载URL失败: ${startUrl}`, err); // 保留
    });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('页面加载完成 (did-finish-load)');
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 自动打开 DevTools 与注入 CSS 逻辑已移除
    } else {
       console.warn('尝试在 did-finish-load 中操作，但 mainWindow 已不存在');
    }
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorCode, errorDescription);
  });
  
  mainWindow.on('closed', () => {
    console.log('窗口已关闭');
    mainWindow = null;
  });


  // 打开视频文件函数
  async function openVideoFile() {
    if (!mainWindow) return null;
    
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        defaultPath: store.get('lastVideoDir') || app.getPath('videos'),
        properties: ['openFile'],
        filters: [
          { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov'] }
        ]
      });
      
      console.log('【主进程】文件选择结果:', result);
      
      if (!result.canceled && result.filePaths.length > 0) {
        const videoPath = result.filePaths[0];
        store.set('lastVideoDir', path.dirname(videoPath));
        const videoName = path.basename(videoPath);
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          
          mainWindow.webContents.send('videoSelectedFromMenu', { 
            success: true, 
            path: videoPath, 
            name: videoName 
          });
        } else {
          console.warn('【主进程】尝试发送 videoSelectedFromMenu 时 mainWindow 不可用');
        }
        return videoPath;
      } else {
        
        return null;
      }
    } catch (error) {
      console.error('【主进程】文件选择对话框出错:', error);
      return null;
    }
  }
  // 定义加载字幕菜单项使用的函数
  async function loadSubtitle() {
    if (!mainWindow) return;
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      defaultPath: store.get('lastVideoDir') || app.getPath('videos'),
      properties: ['openFile'],
      filters: [{ name: '字幕文件', extensions: ['srt', 'vtt', 'ass', 'ssa'] }]
    });
    if (canceled || filePaths.length === 0) return;
    // 调用现有的 loadSubtitle 事件处理逻辑
    ipcMain.emit('loadSubtitle', null, { videoPath: null, subtitlePath: filePaths[0] });
  }

  // 在应用就绪后创建菜单前，添加平台判断
  const isMac = process.platform === 'darwin';

  // --- 定义最终的菜单模板 ---
  const finalMenuTemplate = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' }, // 典型的 macOS 服务菜单
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: '文件', 
      submenu: [
        {
          label: '打开视频...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            await openVideoFile(); // 确保 openVideoFile 函数存在并正确工作
          }
        },
        {
          label: '加载字幕', // 确保 loadSubtitle 函数存在
          accelerator: 'CmdOrCtrl+L',
          click: async () => {
            await loadSubtitle(); // 你的加载字幕逻辑
          }
        },
        { type: 'separator' },
        { // <--- 这是新的 API Key 设置菜单项
          label: '设置 API Key...',
          accelerator: 'CmdOrCtrl+Shift+A', // 可以给一个不同的快捷键
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              
              mainWindow.webContents.send('openApiKeySettings');
            } else {
              console.error('【主进程】尝试发送 openApiKeySettings 时 mainWindow 不可用');
            }
          }
        },
        ...(isMac ? [] : [{ type: 'separator' } , { role: 'quit' }]) // Windows/Linux 的退出
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://mlcore-engine.uk');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(finalMenuTemplate);
  Menu.setApplicationMenu(menu);

  // 检查更新(仅在生产环境)
  if (!process.env.DEV_SERVER_URL) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('will-quit', () => {
  console.log('应用即将退出');
  if (db) {
    db.close();
    console.log('数据库连接已关闭');
  }
});

// 选择视频文件
ipcMain.handle('selectVideo', async (event) => {
  console.log('【主进程】收到selectVideo请求');
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: lastVideoDir,
      properties: ['openFile'],
      filters: [
        { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov'] }
      ]
    });
    
    console.log('文件选择结果:', result);
    
    if (!result.canceled && result.filePaths.length > 0) {
      const videoPath = result.filePaths[0];
      store.set('lastVideoDir', path.dirname(videoPath));
      const videoName = path.basename(videoPath);
      const subtitlePath = null; // 不再自动查找字幕，手动加载
      return {
        success: true,
        path: videoPath,
        name: videoName,
        subtitlePath: subtitlePath
      };
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    console.error('文件选择对话框出错:', error);
    return { success: false, error: error.message };
  }
});

// 选择字幕文件
ipcMain.handle('selectSubtitle', async (event, { videoPath }) => {
  console.log('【主进程】收到selectSubtitle请求');
  try {
    const defaultDir = videoPath ? path.dirname(videoPath) : lastVideoDir;
    
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: defaultDir,
      properties: ['openFile'],
      filters: [
        { name: '字幕文件', extensions: ['srt', 'vtt', 'ass', 'ssa'] }
      ]
    });
    
    console.log('字幕文件选择结果:', result);
    
    if (!result.canceled && result.filePaths.length > 0) {
      const subtitlePath = result.filePaths[0];
      return {
        success: true,
        path: subtitlePath
      };
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    console.error('字幕文件选择对话框出错:', error);
    return { success: false, error: error.message };
  }
});

// 加载字幕文件
ipcMain.on('loadSubtitle', (event, { subtitlePath }) => {
  console.log('【主进程】收到 loadSubtitle 请求，手动加载字幕:', subtitlePath);
  if (!subtitlePath || !fs.existsSync(subtitlePath)) {
    console.log('【主进程】无效的字幕路径:', subtitlePath);
    mainWindow.webContents.send('subtitleLoaded', {
      success: false,
      error: '请手动选择有效的字幕文件'
    });
    return;
  }
  try {
    const subtitleContent = fs.readFileSync(subtitlePath, 'utf8');
    const parsedSubtitles = parseSync(subtitleContent);
    console.log(`【主进程】成功解析字幕文件: ${subtitlePath}, 共 ${parsedSubtitles.length} 条`);
    mainWindow.webContents.send('subtitleLoaded', {
      success: true,
      subtitles: parsedSubtitles
    });
  } catch (error) {
    console.error(`【主进程】解析字幕文件失败: ${subtitlePath}`, error);
    mainWindow.webContents.send('subtitleLoaded', {
      success: false,
      error: `解析字幕失败: ${error.message}`
    });
  }
});

// 更新时长统计
ipcMain.on('updateWatchTime', (event, { videoId, totalTime, sessionTime, currentPosition }) => {
  console.log('【主进程】收到updateWatchTime请求:', { videoId, totalTime, sessionTime, currentPosition });
  if (!db) return console.error('数据库未初始化，无法更新观看时长');
  const now = new Date().toISOString();

  // 全局累计总观看时长
  const gu = db.prepare('SELECT total_time FROM global_usage WHERE id = 1').get();
  if (gu) {
    db.prepare('UPDATE global_usage SET total_time = ? WHERE id = 1').run(totalTime);
  } else {
    db.prepare('INSERT INTO global_usage(id, total_time) VALUES(1, ?)').run(totalTime);
  }

  // 当日会话时长
  const today = now.slice(0, 10);
  const du = db.prepare('SELECT session_time FROM daily_usage WHERE date = ?').get(today);
  if (du) {
    db.prepare('UPDATE daily_usage SET session_time = ? WHERE date = ?').run(sessionTime, today);
  } else {
    db.prepare('INSERT INTO daily_usage(date, session_time) VALUES(?, ?)').run(today, sessionTime);
  }

  // 单视频播放进度
  const vp = db.prepare('SELECT last_position FROM video_progress WHERE video_id = ?').get(videoId);
  if (vp) {
    db.prepare('UPDATE video_progress SET last_position = ?, last_watched = ? WHERE video_id = ?')
      .run(currentPosition, now, videoId);
  } else {
    db.prepare('INSERT INTO video_progress(video_id, last_position, last_watched) VALUES(?, ?, ?)')
      .run(videoId, currentPosition, now);
  }

  mainWindow.webContents.send('watchTimeUpdated', { success: true });
});

// 获取视频的观看时长记录
ipcMain.handle('getWatchTime', (event, { videoId }) => {
  console.log('【主进程】收到getWatchTime请求:', { videoId });
  if (!db) return { totalTime: 0, sessionTime: 0, lastPosition: 0 };

  const today = new Date().toISOString().slice(0, 10);
  // 全局累计
  const gu = db.prepare('SELECT total_time FROM global_usage WHERE id = 1').get();
  const totalTime = gu ? gu.total_time : 0;
  // 当日会话
  const du = db.prepare('SELECT session_time FROM daily_usage WHERE date = ?').get(today);
  const sessionTime = du ? du.session_time : 0;
  // 视频进度
  const vp = db.prepare('SELECT last_position FROM video_progress WHERE video_id = ?').get(videoId);
  const lastPosition = vp ? vp.last_position : 0;

  console.log('【主进程】返回观看时长:', { totalTime, sessionTime, lastPosition });
  return { totalTime, sessionTime, lastPosition };
});

// 保存学习记录
ipcMain.handle('saveLearningRecord', (event, { videoId, subtitleId, content, translation, note }) => {
  console.log('【主进程】收到saveLearningRecord请求:', { videoId, subtitleId, content });
  
  if (!db) {
    console.error('【主进程】数据库未初始化，无法保存学习记录');
    return { success: false, error: '数据库未初始化' };
  }
  
  const created_at = new Date().toISOString();
  
  try {
    const stmt = db.prepare(
      'INSERT INTO learning_records (video_id, subtitle_id, content, translation, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(videoId, subtitleId, content, translation, note, created_at);
    console.log('【主进程】保存学习记录成功:', result);
    return { success: true, id: result.lastInsertRowid }; // 返回成功和 ID
  } catch (error) {
    console.error('【主进程】保存学习记录失败:', error);
    return { success: false, error: error.message }; // 返回失败
  }
});

// 获取学习记录
ipcMain.handle('getLearningRecords', (event, { videoId }) => {
  console.log('【主进程】收到getLearningRecords请求:', { videoId });
  
  if (!db) {
    console.error('【主进程】数据库未初始化，返回空学习记录');
    return []; // 直接返回空数组
  }
  
  try {
    const stmt = db.prepare('SELECT * FROM learning_records WHERE video_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(videoId);
    console.log('【主进程】获取学习记录成功，共', rows.length, '条记录');
    return rows; // 直接返回记录数组
  } catch (error) {
    console.error('【主进程】获取学习记录失败:', error);
    return []; // 出错时也返回空数组
  }
});

// 文件选择器对话框
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// 添加新的IPC处理函数，用于检查数据库状态
ipcMain.on('checkDatabaseStatus', (event) => {
  console.log('【主进程】收到检查数据库状态请求');
  
  try {
    if (!db) {
      console.log('【主进程】数据库未初始化');
      mainWindow.webContents.send('databaseStatus', { isConnected: false });
      return;
    }
    
    // 尝试执行简单查询以确认数据库状态正常
    const result = db.prepare('SELECT COUNT(*) as count FROM watch_time').get();
    console.log('【主进程】数据库状态检查结果:', result);
    
    mainWindow.webContents.send('databaseStatus', { 
      isConnected: true,
      recordCount: result.count
    });
  } catch (error) {
    console.error('【主进程】检查数据库状态失败:', error);
    mainWindow.webContents.send('databaseStatus', { 
      isConnected: false,
      error: error.message
    });
  }
});

// 删除学习记录
ipcMain.on('deleteLearningRecord', (event, { recordId }) => {
  console.log('【主进程】收到deleteLearningRecord请求:', { recordId });
  
  if (!db) {
    console.error('【主进程】数据库未初始化，无法删除学习记录');
    mainWindow.webContents.send('error', { message: '数据库未初始化，无法删除学习记录' });
    return;
  }
  
  try {
    const stmt = db.prepare('DELETE FROM learning_records WHERE id = ?');
    const result = stmt.run(recordId);
    
    console.log('【主进程】删除学习记录结果:', result);
    
    if (result.changes > 0) {
      console.log('【主进程】成功删除学习记录');
      mainWindow.webContents.send('learningRecordDeleted', { 
        success: true, 
        recordId 
      });
    } else {
      console.log('【主进程】未找到要删除的记录');
      mainWindow.webContents.send('learningRecordDeleted', { 
        success: false, 
        message: '未找到要删除的记录' 
      });
    }
  } catch (error) {
    console.error('【主进程】删除学习记录失败:', error);
    mainWindow.webContents.send('error', { message: '删除学习记录失败', error: error.message });
  }
});

// 获取学习统计数据
ipcMain.on('getLearningStats', (event) => {
  console.log('【主进程】收到getLearningStats请求');
  
  if (!db) {
    console.error('【主进程】数据库未初始化，无法获取学习统计');
    mainWindow.webContents.send('learningStats', { 
      totalRecords: 0,
      totalVideos: 0,
      recentRecords: []
    });
    return;
  }
  
  try {
    // 获取总记录数
    const totalRecordsStmt = db.prepare('SELECT COUNT(*) as count FROM learning_records');
    const totalRecords = totalRecordsStmt.get().count;
    
    // 获取学习过的视频数量
    const totalVideosStmt = db.prepare('SELECT COUNT(DISTINCT video_id) as count FROM learning_records');
    const totalVideos = totalVideosStmt.get().count;
    
    // 获取最近10条学习记录
    const recentRecordsStmt = db.prepare(
      'SELECT * FROM learning_records ORDER BY created_at DESC LIMIT 10'
    );
    const recentRecords = recentRecordsStmt.all();
    
    console.log('【主进程】学习统计数据:', { 
      totalRecords, 
      totalVideos, 
      recentRecordsCount: recentRecords.length 
    });
    
    mainWindow.webContents.send('learningStats', {
      totalRecords,
      totalVideos,
      recentRecords
    });
  } catch (error) {
    console.error('【主进程】获取学习统计失败:', error);
    mainWindow.webContents.send('error', { message: '获取学习统计失败', error: error.message });
    
    // 发送默认数据
    mainWindow.webContents.send('learningStats', { 
      totalRecords: 0,
      totalVideos: 0,
      recentRecords: []
    });
  }
});

// 获取视频观看统计数据
ipcMain.on('getWatchingStats', (event) => {
  // console.log('【主进程】收到getWatchingStats请求');
  
  if (!db) {
    console.error('【主进程】数据库未初始化，无法获取观看统计数据');
    mainWindow.webContents.send('watchingStats', {
      totalWatchTime: 0,
      videoCount: 0,
      recentWatched: []
    });
    return;
  }
  
  try {
    // 获取总观看时长（秒）
    const totalTimeStmt = db.prepare('SELECT SUM(total_time) as total FROM watch_time');
    const totalResult = totalTimeStmt.get();
    const totalWatchTime = totalResult.total || 0;
    
    // 获取已观看视频数量
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM watch_time');
    const countResult = countStmt.get();
    const videoCount = countResult.count || 0;
    
    // 获取最近观看的5个视频
    const recentStmt = db.prepare(
      'SELECT * FROM watch_time ORDER BY last_watched DESC LIMIT 5'
    );
    const recentWatched = recentStmt.all();
    
    console.log('【主进程】观看统计数据:', {
      totalWatchTime,
      videoCount,
      recentCount: recentWatched.length
    });
    
    mainWindow.webContents.send('watchingStats', {
      totalWatchTime,
      videoCount,
      recentWatched
    });
  } catch (error) {
    console.error('【主进程】获取观看统计数据失败:', error);
    mainWindow.webContents.send('error', { message: '获取观看统计数据失败', error: error.message });
    
    // 发送默认数据
    mainWindow.webContents.send('watchingStats', {
      totalWatchTime: 0,
      videoCount: 0,
      recentWatched: []
    });
  }
});

// 新增: 处理提取视频帧请求
ipcMain.handle('extract-frame', async (event, { videoPath, timestamp }) => {
  console.log(`【主进程】收到 extract-frame 请求: ${videoPath} @ ${timestamp}s`);
  try {
    const framePath = await extractFrame(videoPath, timestamp);
    const imageBuffer = await fs.promises.readFile(framePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    cleanupTempFile(framePath);
    return { success: true, dataUrl: dataUrl };
  } catch (error) {
    console.error('【主进程】处理 extract-frame 请求失败:', error);
    return { success: false, error: error.message };
  }
});

// 读取视频文件的 handler
// ipcMain.handle('readVideo', async (event, videoPath) => {
  
//   try {
//     // 读取完整视频文件为 Buffer
//     const data = await fs.promises.readFile(videoPath);
//     console.log('【主进程】视频文件读取成功，大小:', data.length, '字节');
//     return data; // Buffer 会被序列化
//   } catch (error) {
//     console.error('【主进程】readVideo 读取失败:', error);
//     throw error;
//   }
// });


// IPC 处理：保存 AI 查询记录
ipcMain.handle('saveAiQuery', (event, { query, explanation, timestamp }) => {
  console.log('【主进程】收到 saveAiQuery 请求:', { query });
  if (!db) return { success: false, error: '数据库未初始化' };
  try {
    const stmt = db.prepare('INSERT INTO ai_queries (query, explanation, created_at) VALUES (?, ?, ?)');
    const result = stmt.run(query, explanation, timestamp);
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error('【主进程】保存 AI 查询失败:', error);
    return { success: false, error: error.message };
  }
});

// IPC 处理：保存查询历史记录
ipcMain.handle('saveQueryHistory', (event, { query_text, response_text, query_type, video_id }) => {
  console.log('【主进程】收到 saveQueryHistory 请求:', { query_text });
  if (!db) return { success: false, error: '数据库未初始化' };
  try {
    const stmt = db.prepare(
      'INSERT INTO query_history (query_text, response_text, query_type, video_id, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      query_text,
      response_text,
      query_type,
      video_id,
      new Date().toISOString()
    );
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error('【主进程】保存查询历史失败:', error);
    return { success: false, error: error.message };
  }
});

// 新增: 获取今日 AI 查询记录
ipcMain.handle('getAiQueriesToday', (event) => {
  if (!db) return [];
  try {
    const stmt = db.prepare("SELECT * FROM ai_queries WHERE date(created_at) = date('now','localtime') ORDER BY created_at DESC");
    const rows = stmt.all();
    return rows;
  } catch (error) {
    console.error('【主进程】获取今日 AI 查询记录失败:', error);
    return [];
  }
});

// 监听更新事件
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
});

// 添加IPC处理器让渲染进程可以触发安装更新
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

// IPC：在主进程中发起 AI 请求，避免渲染进程 CORS 限制
ipcMain.handle('performAIRequest', async (event, { requestData, apiUrl, apiKey }) => {
  try {
    const response = await axios.post(
      apiUrl,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        }
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error('【主进程】AI 请求失败:', error);
    return { success: false, error: error.message };
  }
});

// --- 结束 IPC 处理程序 ---
ipcMain.handle('readVideoFile', (event, filePath) => {
  try {
    // 读取视频文件并返回数据
    return fs.readFileSync(filePath);
  } catch (error) {
    console.error('【主进程】读取视频文件失败:', error);
    throw error;
  }
});

// 新增：分段读取视频数据接口，返回指定偏移和长度的 Buffer
ipcMain.handle('readVideoChunk', async (event, videoPath, offset, length) => {
  try {
    const fd = await fs.promises.open(videoPath, 'r');
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await fd.read(buffer, 0, length, offset);
    await fd.close();
    // 如果读取的字节少于请求长度，截断返回
    return bytesRead < length ? buffer.slice(0, bytesRead) : buffer;
  } catch (error) {
    console.error('【主进程】readVideoChunk 错误:', error);
    return null;
  }
});

// --- 继续其他代码 ---
