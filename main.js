const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { parseSync } = require('subtitle'); // 引入 subtitle 库
const { extractFrame, cleanupTempFile } = require('./main/videoFrameExtractor'); // 引入主进程帧提取器
const Store = require('electron-store'); // 引入electron-store用于保存配置

// 创建配置存储实例
const store = new Store();

// 获取上次打开目录或默认视频目录
const lastVideoDir = store.get('lastVideoDir') || app.getPath('videos');

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

// 应用启动时创建窗口
app.whenReady().then(async () => {
  
  // 确保数据目录存在
  if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
  }
  
  // 初始化数据库连接，添加错误处理
  try {
    db = new Database(DB_PATH);
    // 创建表
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
  
  // Create the main window
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
    minWidth: 1200,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // 允许加载本地资源
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

  // 在应用就绪后创建菜单前，添加平台判断
  const isMac = process.platform === 'darwin';

  // 定义通用菜单模板
  const menuTemplate = [
    // macOS 下，首个菜单为应用程序菜单
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
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
            await openVideoFile();
          }
        },
        { type: 'separator' },
        { role: 'quit' }
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
            await shell.openExternal('https://electronjs.org');
          }
        }
      ]
    }
  ];

  // 构建并设置应用菜单
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
});

app.on('will-quit', () => {
  console.log('应用即将退出');
  if (db) {
    db.close();
    console.log('数据库连接已关闭');
  }
});

// 自动查找字幕文件
function findSubtitleFile(videoPath) {
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const dirName = path.dirname(videoPath);
  
  const subtitleExts = ['.srt', '.vtt', '.ass', '.ssa'];
  for (const ext of subtitleExts) {
    const potentialPath = path.join(dirName, baseName + ext);
    if (fs.existsSync(potentialPath)) {
      return potentialPath;
    }
  }
  return null;
}

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
      const subtitlePath = findSubtitleFile(videoPath);
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
ipcMain.on('loadSubtitle', (event, { videoPath, subtitlePath }) => {
  console.log('【主进程】收到 loadSubtitle 请求:', { videoPath, subtitlePath });

  let finalSubtitlePath = null;

  // 1. 检查传入的 subtitlePath 是否有效
  if (subtitlePath && fs.existsSync(subtitlePath)) {
    console.log(`【主进程】使用传入的字幕路径: ${subtitlePath}`);
    finalSubtitlePath = subtitlePath;
  } else {
    // 2. 如果传入路径无效或未提供，则尝试自动查找
    console.log(`【主进程】传入字幕路径无效或未提供，尝试自动查找 for: ${videoPath}`);
    const foundPath = findSubtitleFile(videoPath);
    if (foundPath) {
      console.log(`【主进程】自动查找到字幕文件: ${foundPath}`);
      finalSubtitlePath = foundPath;
    } else {
      console.log('【主进程】未找到字幕文件 (自动查找失败)');
      mainWindow.webContents.send('subtitleLoaded', {
        success: false,
        error: '未找到匹配的字幕文件'
      });
      return; // 结束处理
    }
  }

  // 3. 读取并解析最终确定的字幕文件路径
  if (finalSubtitlePath) {
    try {
      const subtitleContent = fs.readFileSync(finalSubtitlePath, 'utf8');
      const parsedSubtitles = parseSync(subtitleContent);
      console.log(`【主进程】成功解析字幕文件: ${finalSubtitlePath}, 共 ${parsedSubtitles.length} 条`);
      mainWindow.webContents.send('subtitleLoaded', {
        success: true,
        subtitles: parsedSubtitles
      });
    } catch (error) {
      console.error(`【主进程】解析字幕文件失败: ${finalSubtitlePath}`, error);
      mainWindow.webContents.send('subtitleLoaded', {
        success: false,
        error: `解析字幕失败: ${error.message}`
      });
    }
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
  console.log('【主进程】收到getWatchingStats请求');
  
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
ipcMain.handle('readVideo', async (event, videoPath) => {
  console.log('【主进程】收到 readVideo 请求:', videoPath);
  try {
    // 读取完整视频文件为 Buffer
    console.log('【主进程】开始读取视频文件:', videoPath);
    const data = await fs.promises.readFile(videoPath);
    console.log('【主进程】视频文件读取成功，大小:', data.length, '字节');
    return data; // Buffer 会被序列化
  } catch (error) {
    console.error('【主进程】readVideo 读取失败:', error);
    throw error;
  }
});

// 打开视频文件函数
async function openVideoFile() {
  if (!mainWindow) return null;
  console.log('【主进程】触发打开视频文件对话框');
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
        console.log('【主进程】通过 videoSelectedFromMenu 发送路径:', videoPath);
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
      console.log('【主进程】用户取消了视频文件选择');
      return null;
    }
  } catch (error) {
    console.error('【主进程】文件选择对话框出错:', error);
    return null;
  }
}
