const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { parseSync } = require('subtitle'); // 引入 subtitle 库
const { initializeOCR, performOCR, performOCRFromVideoFrame } = require('./main/ocrService'); // 引入主进程OCR服务
const { extractFrame, cleanupTempFile } = require('./main/videoFrameExtractor'); // 引入主进程帧提取器

// =================== 调试代码：进程异常捕获 ===================
process.on('uncaughtException', (error) => {
  console.error('【调试】未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('【调试】未处理的Promise拒绝:', reason);
});
// ============================================================

// 视频和字幕存储路径
const MOVIES_PATH = path.join(__dirname, 'public', 'movies');
const PAGINATION_STEP = 12;

// 数据存储目录（放在用户目录，避免在 asar 内创建）
const appDataPath = app.getPath('userData');
const DATA_PATH = path.join(appDataPath, 'data');
const DB_PATH = path.join(DATA_PATH, 'userdata.db');

// =================== 路径常量 ===================
const MODELS_PATH = app.isPackaged // 模型文件路径 (示例，需要调整)
  ? path.join(process.resourcesPath, 'models') 
  : path.join(__dirname, 'models'); // 开发环境假设在项目根目录下的 models/
const DEFAULT_OCR_MODEL_FILE = 'ocr_model.onnx'; // 默认模型文件名 (需要替换成你的实际模型名)

let mainWindow;
let categories;
let db;

// =================== 调试代码：打印关键路径 ===================
console.log('【调试】应用路径信息:', {
  __dirname,
  appDataPath,
  DATA_PATH,
  DB_PATH,
  MOVIES_PATH
});

// 检查关键目录是否存在
console.log('【调试】MOVIES_PATH存在:', fs.existsSync(MOVIES_PATH));
if (fs.existsSync(MOVIES_PATH)) {
  console.log('【调试】MOVIES_PATH内容:', fs.readdirSync(MOVIES_PATH));
} else {
  console.error('【调试】MOVIES_PATH不存在！这可能导致无法显示视频分类');
}
// ============================================================

// 应用启动时创建窗口
app.whenReady().then(async () => {
  console.log('【调试】应用准备就绪');
  
  // **在创建窗口之前注册自定义协议**
  protocol.registerFileProtocol('safe-file', (request, callback) => {
    // 移除协议前缀 'safe-file:///'
    // 注意：需要处理不同平台和编码，特别是空格和特殊字符
    const url = request.url.substring('safe-file:///'.length);
    const decodedPath = decodeURI(url); // 解码 URL 中的特殊字符，例如 %20 -> 空格
    console.log(`【调试】safe-file protocol: Requested URL=${request.url}, Decoded Path=${decodedPath}`);
    try {
       // 直接返回文件路径
       callback({ path: path.normalize(decodedPath) })
    } catch (error) {
       console.error('【调试】safe-file protocol: Error resolving path:', error);
       callback({ error: -6 }) // FILE_NOT_FOUND or generic error
    }
  });
  
  // 确保数据目录存在
  if (!fs.existsSync(DATA_PATH)) {
    console.log('【调试】创建数据目录:', DATA_PATH);
    fs.mkdirSync(DATA_PATH, { recursive: true });
  }
  
  // 初始化数据库连接，添加错误处理
  try {
    console.log('【调试】尝试连接数据库:', DB_PATH);
    db = new Database(DB_PATH);
    console.log('【调试】成功连接数据库');
  
    // 创建表
    console.log('【调试】创建watch_time表');
    db.exec(`
      CREATE TABLE IF NOT EXISTS watch_time (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT UNIQUE,
        total_time INTEGER,
        session_time INTEGER,
        last_position INTEGER,
        last_watched TEXT
      );
    `);
    
    console.log('【调试】创建learning_records表');
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
      console.log('【调试】数据库中的表:', tables.map(t => t.name).join(', '));
    } catch (err) {
      console.error('【调试】获取表列表失败:', err);
    }
  } catch (error) {
    console.error('【调试】数据库初始化失败:', error);
    // 在数据库初始化失败时设置db为null，确保应用可以优雅降级
    db = null;
    // 通知渲染进程数据库初始化失败
    if (mainWindow) {
      mainWindow.webContents.send('databaseInitError', { 
        error: error.message,
        dbPath: DB_PATH 
      });
    }
  }
  
  // 初始化OCR服务 (在创建窗口之前或之后都可以)
  const ocrModelFullPath = path.join(MODELS_PATH, DEFAULT_OCR_MODEL_FILE);
  console.log('【调试】尝试初始化OCR模型路径:', ocrModelFullPath);
  try {
    const ocrInitialized = await initializeOCR(ocrModelFullPath);
    if (!ocrInitialized) {
      console.error('【主进程】OCR服务初始化失败，功能可能受限。');
      // 可以考虑通知渲染进程
    }
  } catch (initError) {
     console.error('【主进程】初始化OCR时发生异常:', initError);
  }
  
  // 在此创建主窗口
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      // **重要：webSecurity 保持为 true (默认)**
      // webSecurity: false, // 不要禁用！
    }
  });
  
  // =================== 调试代码：检查preload脚本 ===================
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('【调试】preload路径:', preloadPath);
  console.log('【调试】preload存在:', fs.existsSync(preloadPath));
  // ==============================================================
  
  // =================== 调试代码：打开开发者工具 ===================
  // 自动打开开发者工具，便于查看渲染进程日志
  mainWindow.webContents.openDevTools();
  // ==============================================================
  
  mainWindow.setFullScreen(true);

  // 加载开发或生产环境页面
  // 检查命令行参数获取开发服务器 URL
  const devServerUrlArg = process.argv.find(arg => arg.startsWith('--devServerUrl='));
  const devServerUrl = devServerUrlArg ? devServerUrlArg.split('=')[1] : null;
  
  const startUrl = devServerUrl || `file://${path.join(__dirname, 'build', 'index.html')}`;
  console.log('【调试】加载URL:', startUrl); // 确认这里是否正确显示 localhost:3000
  mainWindow.loadURL(startUrl);
  
  // =================== 调试代码：检查窗口加载状态 ===================
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('【调试】页面加载完成');
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('【调试】页面加载失败:', errorCode, errorDescription);
  });
  
  // 延迟检查窗口状态
  setTimeout(() => {
    if (mainWindow) {
      console.log('【调试】窗口URL:', mainWindow.webContents.getURL());
      console.log('【调试】窗口标题:', mainWindow.getTitle());
    }
  }, 3000);
  // ================================================================
  
  // =================== 调试代码：监控IPC通信 ===================
  const originalSend = mainWindow.webContents.send;
  mainWindow.webContents.send = function() {
    console.log('【调试】IPC发送:', arguments[0], JSON.stringify(Array.from(arguments).slice(1)));
    return originalSend.apply(this, arguments);
  };
  // =============================================================
  
  mainWindow.on('closed', () => {
    console.log('【调试】窗口已关闭');
    mainWindow = null;
  });
});

// 应用退出时关闭数据库连接
app.on('will-quit', () => {
  console.log('【调试】应用即将退出');
  if (db) {
    db.close();
    console.log('【调试】数据库连接已关闭');
  }
});

// 获取视频分类
ipcMain.on('getCategories', () => {
  console.log('【调试】收到getCategories请求');
  fs.readdir(MOVIES_PATH, (err, items) => {
    if (err) {
      console.error('【调试】读取视频目录失败:', err);
      mainWindow.webContents.send('error', {message: '无法读取视频目录', error: err.message});
      return;
    }
    console.log('【调试】发送分类数据:', items);
    categories = items;
    mainWindow.webContents.send('categories', categories);
  });
});

// 获取指定分类下的视频
ipcMain.on('getMovies', (event, { category_id, page }) => {
  console.log('【调试】收到getMovies请求:', { category_id, page });
  
  if (!categories || categories.length === 0) {
    console.error('【调试】categories为空或未定义');
    mainWindow.webContents.send('error', {message: '分类数据不可用'});
    return;
  }
  
  const CATEGORY_FOLDER = categories[category_id];
  console.log('【调试】选择的分类文件夹:', CATEGORY_FOLDER);
  
  const FOLDER_PATH = (process.env.ELECTRON_START_URL) 
    ? `/movies/${CATEGORY_FOLDER}` 
    : `file://${path.join(MOVIES_PATH, CATEGORY_FOLDER)}`;
  const PATH = path.join(MOVIES_PATH, CATEGORY_FOLDER, 'image');
  
  console.log('【调试】尝试读取目录:', PATH);
  console.log('【调试】目录存在:', fs.existsSync(PATH));
  
  fs.readdir(PATH, (err, items) => {
    if (err) {
      console.error('【调试】读取视频列表失败:', err);
      mainWindow.webContents.send('error', {message: '无法读取视频列表', error: err.message});
      return;
    }
    
    const length = (items) ? items.length : 0;
    const maxPage = Math.ceil(length / PAGINATION_STEP);
    const movies = (items) ? items.slice((page-1) * PAGINATION_STEP, page * PAGINATION_STEP) : null;
    
    console.log('【调试】发送视频数据:', { 
      movieCount: movies ? movies.length : 0, 
      maxPage, 
      FOLDER_PATH 
    });
    
    mainWindow.webContents.send('movies', { movies, maxPage, FOLDER_PATH });
  });
});

// 选择视频文件 (改为 handle 模式，返回选择结果)
ipcMain.handle('selectVideo', async (event) => { // 修改为 handle
  console.log('【调试】收到selectVideo请求');
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov'] }
      ]
    });
    
    console.log('【调试】文件选择结果:', result);
    
    if (!result.canceled && result.filePaths.length > 0) {
      const videoPath = result.filePaths[0];
      const videoName = path.basename(videoPath);
      const subtitlePath = videoPath.replace(path.extname(videoPath), '.srt');
      const hasSubtitle = fs.existsSync(subtitlePath);
      
      return { // 返回结果给 invoke 调用
        success: true,
        path: videoPath,
        name: videoName,
        subtitlePath: hasSubtitle ? subtitlePath : null
      };
    } else {
      return { success: false, canceled: true }; // 用户取消
    }
  } catch (error) {
    console.error('【调试】文件选择对话框出错:', error);
    return { success: false, error: error.message }; // 返回错误
  }
});

// 加载字幕文件 (保持 on/send 模式，因为它是异步发送结果)
ipcMain.on('loadSubtitle', (event, { videoPath }) => {
  console.log('【调试】收到loadSubtitle请求:', { videoPath });
  // 尝试查找同名字幕文件
  const subtitlePath = videoPath.replace(path.extname(videoPath), '.srt');
  
  if (fs.existsSync(subtitlePath)) {
    try {
      const subtitleContent = fs.readFileSync(subtitlePath, 'utf8');
      const parsedSubtitles = parseSync(subtitleContent); // 解析字幕
      console.log(`【调试】成功解析字幕文件: ${subtitlePath}, 共 ${parsedSubtitles.length} 条`);
      mainWindow.webContents.send('subtitleLoaded', { 
        success: true, 
        subtitles: parsedSubtitles // 发送解析后的数组
      });
    } catch (error) {
      console.error(`【调试】解析字幕文件失败: ${subtitlePath}`, error);
      mainWindow.webContents.send('subtitleLoaded', { 
        success: false, 
        error: `解析字幕失败: ${error.message}` 
      });
    }
  } else {
    console.log('【调试】未找到字幕文件:', subtitlePath);
    mainWindow.webContents.send('subtitleLoaded', { 
      success: false, 
      error: '未找到字幕文件' 
    });
  }
});

// 更新时长统计 (保持 on/send 模式)
ipcMain.on('updateWatchTime', (event, { videoId, totalTime, sessionTime, currentPosition }) => {
  console.log('【调试】收到updateWatchTime请求:', { videoId, totalTime, sessionTime, currentPosition });
  
  if (!db) {
    console.error('【调试】数据库未初始化，无法更新观看时长');
    return;
  }
  
  const now = new Date().toISOString();
  
  try {
    // 使用prepare和run方式替代callback风格，与better-sqlite3兼容
    const stmt = db.prepare('SELECT * FROM watch_time WHERE video_id = ?');
    const row = stmt.get(videoId);
    
    console.log('【调试】查询现有记录结果:', row);
    
    if (row) {
      // 更新现有记录
      const updateStmt = db.prepare(
        'UPDATE watch_time SET total_time = ?, session_time = ?, last_position = ?, last_watched = ? WHERE video_id = ?'
      );
      const updateResult = updateStmt.run(totalTime, sessionTime, currentPosition, now, videoId);
      console.log('【调试】更新记录成功:', updateResult);
    } else {
      // 创建新记录
      const insertStmt = db.prepare(
        'INSERT INTO watch_time (video_id, total_time, session_time, last_position, last_watched) VALUES (?, ?, ?, ?, ?)'
      );
      const insertResult = insertStmt.run(videoId, totalTime, sessionTime, currentPosition, now);
      console.log('【调试】插入新记录成功:', insertResult);
    }
    
    // 向渲染进程发送更新成功的消息
    mainWindow.webContents.send('watchTimeUpdated', { success: true });
  } catch (error) {
    console.error('【调试】更新观看时长失败:', error);
    mainWindow.webContents.send('error', { message: '更新观看时长失败', error: error.message });
  }
});

// 获取视频的观看时长记录 (改为 handle 模式)
ipcMain.handle('getWatchTime', (event, { videoId }) => { // 修改为 handle
  console.log('【调试】收到getWatchTime请求:', { videoId });
  
  if (!db) {
    console.error('【调试】数据库未初始化，返回默认观看时长');
    // 直接 return 值给 invoke 调用
    return { totalTime: 0, sessionTime: 0, lastPosition: 0 }; 
  }
  
  try {
    const stmt = db.prepare('SELECT * FROM watch_time WHERE video_id = ?');
    const row = stmt.get(videoId);
    
    console.log('【调试】查询观看时长结果:', row);
    
    if (!row) {
      console.log('【调试】未找到该视频记录，返回默认值');
      return { totalTime: 0, sessionTime: 0, lastPosition: 0 };
    } else {
      console.log('【调试】返回视频观看记录:', { totalTime: row.total_time, lastPosition: row.last_position });
      return {
        totalTime: row.total_time,
        sessionTime: 0, // 新会话，重置会话时间
        lastPosition: row.last_position
      };
    }
  } catch (error) {
    console.error('【调试】获取观看时长失败:', error);
    // 在 handle 中，可以通过抛出错误或返回包含错误的对象来指示失败
    // return { success: false, error: error.message, totalTime: 0, sessionTime: 0, lastPosition: 0 }; 
    // 或者为了简化客户端处理，即使出错也返回默认值
    return { totalTime: 0, sessionTime: 0, lastPosition: 0 };
  }
});

// 保存学习记录 (改为 handle 模式)
ipcMain.handle('saveLearningRecord', (event, { videoId, subtitleId, content, translation, note }) => { // 修改为 handle
  console.log('【调试】收到saveLearningRecord请求:', { videoId, subtitleId, content });
  
  if (!db) {
    console.error('【调试】数据库未初始化，无法保存学习记录');
    return { success: false, error: '数据库未初始化' };
  }
  
  const created_at = new Date().toISOString();
  
  try {
    const stmt = db.prepare(
      'INSERT INTO learning_records (video_id, subtitle_id, content, translation, note, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(videoId, subtitleId, content, translation, note, created_at);
    console.log('【调试】保存学习记录成功:', result);
    return { success: true, id: result.lastInsertRowid }; // 返回成功和 ID
  } catch (error) {
    console.error('【调试】保存学习记录失败:', error);
    return { success: false, error: error.message }; // 返回失败
  }
});

// 获取学习记录 (改为 handle 模式)
ipcMain.handle('getLearningRecords', (event, { videoId }) => { // 修改为 handle
  console.log('【调试】收到getLearningRecords请求:', { videoId });
  
  if (!db) {
    console.error('【调试】数据库未初始化，返回空学习记录');
    return []; // 直接返回空数组
  }
  
  try {
    const stmt = db.prepare('SELECT * FROM learning_records WHERE video_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(videoId);
    console.log('【调试】获取学习记录成功，共', rows.length, '条记录');
    return rows; // 直接返回记录数组
  } catch (error) {
    console.error('【调试】获取学习记录失败:', error);
    return []; // 出错时也返回空数组
  }
});

// OCR相关事件处理
ipcMain.handle('initOCRModel', async (event, { modelPath }) => {
  try {
    // 确保模型文件存在
    if (!fs.existsSync(modelPath)) {
      return { success: false, error: '模型文件不存在' };
    }
    
    // 在渲染进程中初始化模型
    return { success: true };
  } catch (error) {
    console.error('初始化OCR模型失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('performOCR', async (event, { imagePath }) => {
  try {
    // OCR处理将在渲染进程中执行
    // 这里主要验证文件存在并返回成功
    if (!fs.existsSync(imagePath)) {
      return { success: false, error: '图像文件不存在' };
    }
    
    return { success: true, imagePath };
  } catch (error) {
    console.error('OCR处理失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('extractVideoFrame', async (event, { videoPath, timestamp }) => {
  try {
    // 视频帧提取将在渲染进程中执行
    // 这里主要验证文件存在并返回成功
    if (!fs.existsSync(videoPath)) {
      return { success: false, error: '视频文件不存在' };
    }
    
    return { success: true, videoPath, timestamp };
  } catch (error) {
    console.error('提取视频帧失败:', error);
    return { success: false, error: error.message };
  }
});

// 文件选择器对话框
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// 添加新的IPC处理函数，用于检查数据库状态
ipcMain.on('checkDatabaseStatus', (event) => {
  console.log('【调试】收到检查数据库状态请求');
  
  try {
    if (!db) {
      console.log('【调试】数据库未初始化');
      mainWindow.webContents.send('databaseStatus', { isConnected: false });
      return;
    }
    
    // 尝试执行简单查询以确认数据库状态正常
    const result = db.prepare('SELECT COUNT(*) as count FROM watch_time').get();
    console.log('【调试】数据库状态检查结果:', result);
    
    mainWindow.webContents.send('databaseStatus', { 
      isConnected: true,
      recordCount: result.count
    });
  } catch (error) {
    console.error('【调试】检查数据库状态失败:', error);
    mainWindow.webContents.send('databaseStatus', { 
      isConnected: false,
      error: error.message
    });
  }
});

// 删除学习记录
ipcMain.on('deleteLearningRecord', (event, { recordId }) => {
  console.log('【调试】收到deleteLearningRecord请求:', { recordId });
  
  if (!db) {
    console.error('【调试】数据库未初始化，无法删除学习记录');
    mainWindow.webContents.send('error', { message: '数据库未初始化，无法删除学习记录' });
    return;
  }
  
  try {
    const stmt = db.prepare('DELETE FROM learning_records WHERE id = ?');
    const result = stmt.run(recordId);
    
    console.log('【调试】删除学习记录结果:', result);
    
    if (result.changes > 0) {
      console.log('【调试】成功删除学习记录');
      mainWindow.webContents.send('learningRecordDeleted', { 
        success: true, 
        recordId 
      });
    } else {
      console.log('【调试】未找到要删除的记录');
      mainWindow.webContents.send('learningRecordDeleted', { 
        success: false, 
        message: '未找到要删除的记录' 
      });
    }
  } catch (error) {
    console.error('【调试】删除学习记录失败:', error);
    mainWindow.webContents.send('error', { message: '删除学习记录失败', error: error.message });
  }
});

// 获取学习统计数据
ipcMain.on('getLearningStats', (event) => {
  console.log('【调试】收到getLearningStats请求');
  
  if (!db) {
    console.error('【调试】数据库未初始化，无法获取学习统计');
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
    
    console.log('【调试】学习统计数据:', { 
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
    console.error('【调试】获取学习统计失败:', error);
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
  console.log('【调试】收到getWatchingStats请求');
  
  if (!db) {
    console.error('【调试】数据库未初始化，无法获取观看统计数据');
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
    
    console.log('【调试】观看统计数据:', {
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
    console.error('【调试】获取观看统计数据失败:', error);
    mainWindow.webContents.send('error', { message: '获取观看统计数据失败', error: error.message });
    
    // 发送默认数据
    mainWindow.webContents.send('watchingStats', {
      totalWatchTime: 0,
      videoCount: 0,
      recentWatched: []
    });
  }
});

// 新增: 处理 OCR 请求
ipcMain.handle('perform-ocr', async (event, imageData) => {
  console.log('【主进程】收到 perform-ocr 请求');
  try {
    // 注意：imageData 从渲染进程传来可能是 ArrayBuffer 或其他形式，需要确认
    // main/ocrService 中的 preprocessImage 需要能处理 Buffer
    // 如果传来的是 Data URL 或其他格式，需要在 preload 或这里转换
    const result = await performOCR(imageData); // imageData 应该是 Buffer
    return { success: true, text: result };
  } catch (error) {
    console.error('【主进程】处理 perform-ocr 请求失败:', error);
    return { success: false, error: error.message };
  }
});

// 新增: 处理从视频帧 OCR 请求
ipcMain.handle('perform-ocr-from-frame', async (event, { videoPath, timestamp }) => {
  console.log(`【主进程】收到 perform-ocr-from-frame 请求: ${videoPath} @ ${timestamp}s`);
  try {
    const result = await performOCRFromVideoFrame(videoPath, timestamp);
    return { success: true, text: result };
  } catch (error) {
    console.error('【主进程】处理 perform-ocr-from-frame 请求失败:', error);
    return { success: false, error: error.message };
  }
});

// 新增: 处理提取视频帧请求 (如果需要单独提取的话)
ipcMain.handle('extract-frame', async (event, { videoPath, timestamp }) => {
  console.log(`【主进程】收到 extract-frame 请求: ${videoPath} @ ${timestamp}s`);
  try {
    const framePath = await extractFrame(videoPath, timestamp);
    // 这里返回的是临时文件路径，渲染进程无法直接访问
    // 方案1: 读取文件内容返回 Buffer 或 Base64 Data URL
    // 方案2: 让渲染进程后续通过另一个 IPC 请求 OCR 这个 framePath
    
    // 采用方案1: 返回 Base64 Data URL
    const imageBuffer = await fs.promises.readFile(framePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/jpeg'; // 假设总是输出 jpeg
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    // 清理临时文件
    cleanupTempFile(framePath);
    
    return { success: true, dataUrl: dataUrl };

  } catch (error) {
    console.error('【主进程】处理 extract-frame 请求失败:', error);
    return { success: false, error: error.message };
  }
});
