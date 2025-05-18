# 视频学习播放器项目架构文档

## 项目架构图

```
┌────────────────────────────────────────────────────────────────────────┐
│                           Electron 应用                                 │
│                                                                        |
│  ┌───────────────┐                            ┌────────────────────┐   │
│  │   主进程      │                             │     渲染进程          │  |
│  │  (main.js)    │                            │    (React 应用)     │   │
│  │               │      IPC 通信               │                     │  | 
│  │  系统交互     │◄──────────────────────────►  │    用户界面         │   │
│  │  数据库管理   │      Preload 桥接            │    状态管理         │    │
│  │  文件系统操作 │      (preload.js)            │    业务逻辑         │   │
│  └───────┬───────┘                            └─────────┬──────────┘   │
│          │                                              │              │
│          │                                              │              │
│          ▼                                              ▼              │
│  ┌───────────────┐                            ┌────────────────────┐   │
│  │  外部服务     │                            │  React 组件结构     │   │
│  │               │                            │                     │   │
│  │ SQLite 数据库 │                            │  App                │   │
│  │ 视频文件/字幕 │                            │  ├─ VideoContainer  │   │
│  │ AI 查询服务   │                            │  │  └─ VideoPlayer  │   │
│  │ OCR 识别      │                            │  ├─ SidePanel       │   │
│  └───────────────┘                            │  └─ ApiKeySettings  │   │
│                                               └────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

## 核心组件与文件详细分析

### 主进程部分

#### 1. **main.js** (主进程入口文件)
- **主要功能**：
  - 应用生命周期管理
  - 创建主窗口和加载渲染进程
  - 初始化SQLite数据库
  - 配置IPC通信处理程序
  - 提供文件系统操作功能
  - 处理API密钥的加密存储
  - 帧提取和字幕解析功能

- **关键功能实现**：
  ```javascript
  // 数据库初始化
  db.exec(`CREATE TABLE IF NOT EXISTS global_usage...`)
  
  // 加密功能
  function encrypt(text) {...}
  function decrypt(encryptedHex) {...}
  
  // IPC通信处理
  ipcMain.handle('saveApiKey', (event, apiKey) => {...})
  ipcMain.handle('getApiKey', (event) => {...})
  
  // 文件操作
  async function openVideoFile() {...}
  async function loadSubtitle() {...}
  ```

#### 2. **preload.js** (预加载脚本)
- **主要功能**：
  - 安全桥接主进程和渲染进程
  - 通过contextBridge暴露受限API给渲染进程
  - 定义IPC通信白名单
  - 封装主进程API为易用的函数

- **关键实现**：
  ```javascript
  // 白名单定义
  const allowedInvokeChannels = [...]
  const allowedSendChannels = [...]
  const allowedReceiveChannels = [...]
  
  // API暴露
  contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel, ...args) => {...},
    send: (channel, ...args) => {...},
    on: (channel, listener) => {...},
    // 具体功能API
    extractFrame: (videoPath, timestamp) => {...},
    selectVideo: () => {...},
    ...
  })
  ```

### 渲染进程部分

#### 1. **src/index.js** (React入口)
- **功能**：初始化React应用，挂载到DOM

#### 2. **src/App.js** (应用主组件)
- **功能**：
  - 设置应用布局结构
  - 提供应用全局上下文
  - 显示API密钥设置界面
  
- **关键代码**：
  ```jsx
  // 应用布局
  <AppProvider>
    <AppContent />
  </AppProvider>
  
  // 布局组成
  <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
    <VideoContainer />
    <SidePanel />
  </div>
  ```

#### 3. **src/contexts/AppContext.js** (状态管理)
- **功能**：
  - 使用Context API提供全局状态管理
  - 分离不同功能领域的状态
  - 提供操作状态的方法
  
- **主要部分**：
  - **VideoProvider**：视频播放状态和控制
  - **TimeStatsProvider**：统计观看时长
  - **AIProvider**：处理AI解释和记录
  - **OCRProvider**：OCR相关功能
  - **ApiKeyProvider**：API密钥管理

## 数据存储结构

### SQLite数据库表结构

1. **global_usage表**
   - 功能：记录总观看时长
   - 字段：id, total_time

2. **daily_usage表**
   - 功能：按日期记录会话时长
   - 字段：date, session_time

3. **video_progress表**
   - 功能：保存每个视频的播放进度
   - 字段：video_id, last_position, last_watched

4. **learning_records表**
   - 功能：保存学习记录
   - 字段：id, video_id, subtitle_id, content, translation, note, created_at

5. **ai_queries表**
   - 功能：存储AI查询历史
   - 字段：id, query, explanation, created_at

## 通信流程与数据流

1. **视频加载流程**：
   ```
   用户选择视频文件
   ↓
   渲染进程调用 electronAPI.selectVideo()
   ↓
   主进程通过dialog.showOpenDialog打开文件选择器
   ↓
   用户选择文件后，主进程读取文件信息
   ↓
   主进程返回文件路径到渲染进程
   ↓
   渲染进程更新VideoContext状态
   ↓
   VideoPlayer组件加载视频并开始播放
   ```

2. **字幕同步流程**：
   ```
   视频时间更新
   ↓
   VideoContainer触发handleTimeUpdate方法
   ↓
   查找当前时间对应的字幕
   ↓
   更新字幕文本状态
   ↓
   界面显示当前字幕
   ```

3. **AI解释流程**：
   ```
   用户选择字幕中的文本
   ↓
   触发AI解释请求
   ↓
   调用外部API获取解释
   ↓
   更新AIContext状态
   ↓
   SidePanel显示解释内容
   ↓
   (可选)保存到ai_queries表
   ```

## 特色功能详细实现

1. **视频帧提取**：
   - 主进程使用fluent-ffmpeg从视频中提取指定时间点的帧
   - 用于OCR识别和截图功能

2. **字幕互动学习**：
   - 字幕文本可选择
   - 选中文本后发送到AI服务获取解释
   - 解释结果可保存为学习记录

3. **API密钥安全存储**：
   - 使用AES-256-CBC加密算法
   - API密钥加密后存储在electron-store中
   - 需要时解密并使用

4. **学习数据统计**：
   - 记录总观看时长、当日会话时长
   - 保存每个视频的进度
   - 统计学习记录和查询历史

## 待开发功能清单 (Todo List)

### 1. FFmpeg视频格式转换功能
- [ ] 实现视频格式转换功能
  - [ ] 添加格式转换界面组件
  - [ ] 集成FFmpeg命令行工具
  - [ ] 支持常见视频格式转换（MP4, AVI, MKV等）
  - [ ] 添加转换进度显示
  - [ ] 支持批量转换功能
  - [ ] 添加转换参数配置选项

### 2. 每日学习总结功能
- [ ] 实现每日词汇总结功能
  - [ ] 创建每日词汇统计表
  - [ ] 实现词汇查询记录功能
  - [ ] 添加每日总结生成功能
  - [ ] 设计总结展示界面
  - [ ] 支持导出总结报告
  - [ ] 添加词汇复习提醒功能

### 数据库表结构更新
```sql
-- 新增视频转换记录表
CREATE TABLE video_conversions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_path TEXT NOT NULL,
    converted_path TEXT NOT NULL,
    original_format TEXT NOT NULL,
    target_format TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 新增每日词汇表
CREATE TABLE daily_vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    translation TEXT,
    context TEXT,
    video_id INTEGER,
    query_count INTEGER DEFAULT 1,
    last_queried DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES video_progress(id)
);

-- 新增每日总结表
CREATE TABLE daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    total_words INTEGER DEFAULT 0,
    summary_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 新功能实现计划

1. **FFmpeg视频转换功能**
   - 在主进程中添加FFmpeg相关功能
   - 创建视频转换服务
   - 实现转换进度监控
   - 添加转换队列管理
   - 实现转换参数配置

2. **每日词汇总结功能**
   - 实现词汇记录和统计
   - 创建总结生成服务
   - 设计总结展示界面
   - 实现导出功能
   - 添加复习提醒系统

## 注意事项
1. 确保FFmpeg正确安装和配置
2. 注意视频转换过程中的内存使用
3. 实现适当的错误处理机制
4. 考虑添加转换任务队列管理
5. 注意数据备份和恢复机制  