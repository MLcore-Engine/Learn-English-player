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

### 3. 查询内容存储与优化
- [ ] 查询内容存储功能
  - [ ] 实现查询内容自动保存到数据库
  - [ ] 设计查询历史记录表
  - [ ] 添加查询内容分类功能
  - [ ] 实现查询内容检索功能
  - [ ] 添加查询内容导出功能

### 4. 系统提示词优化
- [ ] Few-shot学习优化
  - [ ] 设计优化后的系统提示词
  - [ ] 实现Few-shot示例管理
  - [ ] 添加提示词模板系统
  - [ ] 实现提示词动态调整功能
  - [ ] 添加提示词效果评估机制

### 5. 界面展示优化
- [ ] 输出页面格式优化
  - [ ] 重新设计输出页面布局
  - [ ] 优化内容展示结构
  - [ ] 添加内容格式化功能
  - [ ] 实现响应式布局适配
  - [ ] 添加自定义主题支持

### 6. API与提示词系统完善
- [ ] 总结API开发
  - [ ] 设计总结生成API
  - [ ] 实现总结内容分析
  - [ ] 添加总结模板系统
  - [ ] 实现总结内容导出
  - [ ] 添加总结质量评估

- [ ] 提示词系统完善
  - [ ] 设计提示词管理界面
  - [ ] 实现提示词版本控制
  - [ ] 添加提示词测试功能
  - [ ] 实现提示词效果分析
  - [ ] 添加提示词优化建议

### 7. OCR识别优化
- [ ] 提升OCR识别准确度
  - [ ] 优化图像预处理流程
    - [ ] 实现自适应图像增强
    - [ ] 添加噪声消除功能
    - [ ] 优化对比度调整
    - [ ] 实现智能裁剪功能
  - [ ] 改进文字识别算法
    - [ ] 实现多模型融合识别
    - [ ] 添加语言模型校正
    - [ ] 优化字符分割算法
    - [ ] 实现上下文关联分析
  - [ ] 添加字幕类型适配
    - [ ] 支持硬字幕识别
    - [ ] 支持软字幕提取
    - [ ] 支持多语言字幕
    - [ ] 支持特效字幕处理
  - [ ] 实现智能后处理
    - [ ] 添加文本纠错功能
    - [ ] 实现时间轴对齐
    - [ ] 优化字幕分段
    - [ ] 添加格式标准化


### 数据库表结构更新
```sql
-- 新增查询历史记录表
CREATE TABLE query_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_text TEXT NOT NULL,
    response_text TEXT,
    query_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    video_id TEXT,
    FOREIGN KEY (video_id) REFERENCES video_progress(video_id)
);

-- 新增提示词模板表
CREATE TABLE prompt_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    version TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 新增Few-shot示例表
CREATE TABLE few_shot_examples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    example_text TEXT NOT NULL,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES prompt_templates(id)
);

-- 新增总结记录表
CREATE TABLE summary_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT,
    summary_type TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES video_progress(video_id)
);

-- 新增OCR识别记录表
CREATE TABLE ocr_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT,
    frame_time REAL,
    original_text TEXT,
    processed_text TEXT,
    confidence_score REAL,
    language TEXT,
    subtitle_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES video_progress(video_id)
);

-- 新增OCR模型配置表
CREATE TABLE ocr_model_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    parameters TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 新增字幕样式配置表
CREATE TABLE subtitle_style_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    style_name TEXT NOT NULL,
    font_family TEXT,
    font_size INTEGER,
    font_color TEXT,
    background_color TEXT,
    position TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 新功能实现计划

1. **查询内容存储系统**
   - 实现查询内容自动保存
   - 设计查询历史管理界面
   - 实现查询内容检索功能
   - 添加查询内容导出功能

2. **提示词优化系统**
   - 实现提示词管理功能
   - 添加Few-shot示例管理
   - 实现提示词效果评估
   - 添加提示词优化建议

3. **界面展示优化**
   - 重新设计输出页面
   - 优化内容展示结构
   - 实现响应式布局
   - 添加主题支持

4. **总结系统开发**
   - 实现总结生成API
   - 设计总结模板系统
   - 添加总结质量评估
   - 实现总结内容导出

5. **OCR系统优化**
   - 实现图像预处理优化
   - 改进文字识别算法
   - 添加字幕类型适配
   - 实现智能后处理
   - 优化识别性能
6.    - [ ] 支持选择加载外挂字幕文件（如.srt/.vtt），当存在外挂字幕时，OCR功能可切换为直接读取当前字幕内容，无需图像识别
## 注意事项
1. 确保数据安全和隐私保护
2. 实现适当的错误处理机制
3. 注意系统性能优化
4. 考虑用户体验和界面交互
5. 注意数据备份和恢复机制
6. 确保OCR识别的准确性和效率
7. 注意不同字幕格式的兼容性
8. 确保数据安全和隐私保护
9. 实现适当的错误处理机制
10. 注意系统性能优化
11. 考虑用户体验和界面交互
12. 注意数据备份和恢复机制  