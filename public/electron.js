const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// 导入主进程逻辑
const mainProcess = require('../index');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      preload: path.join(__dirname, '../preload.js')
    }
  });

  win.setFullScreen(true);
  
  // 加载生产环境的静态文件
  win.loadFile(path.join(__dirname, '../build/index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
