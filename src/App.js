import React, { useEffect } from 'react';
import 'video.js/dist/video-js.css';
import { AppProvider } from './contexts/AppContext';
import VideoContainer from './containers/VideoContainer';
import SidePanel from './components/SidePanel';
import ApiKeySettings from './components/ApiKeySettings';
import { useApiKey } from './hooks/useApiKey';
import { useElectronIPC } from './hooks/useElectronIPC';

/**
 * 应用主容器组件
 * 使用钩子处理全局功能，不包含任何业务逻辑
 */
const AppContent = () => {
  const { 
    apiKey, 
    showInput: showApiKeyInput, 
    status: storedApiKeyStatus, 
    setApiKey, 
    setShowInput: setShowApiKeyInput, 
    saveApiKey 
  } = useApiKey();
  
  // 使用IPC钩子处理与主进程通信
  useElectronIPC();
  
  // API密钥设置属性
  const apiKeyProps = {
    isVisible: showApiKeyInput,
    apiKey,
    storedApiKeyStatus,
    onApiKeyChange: setApiKey,
    onSave: saveApiKey,
    onCancel: () => setShowApiKeyInput(false)
  };

  return (
    <>
      {/* API密钥设置对话框 */}
      <ApiKeySettings {...apiKeyProps} />
      
      {/* 主应用布局 */}
      <div style={{ 
        display: 'flex', 
        width: '100vw', 
        height: '100vh', 
        margin: 0, 
        padding: 0,
        overflow: 'hidden'
      }}>
        {/* 视频区域 */}
        <VideoContainer />
        
        {/* 侧边面板 */}
        <SidePanel />
      </div>
    </>
  );
};

/**
 * 应用根组件
 * 提供所有Provider上下文
 */
function App() {
  // 设置页面标题
  useEffect(() => {
    document.title = "learn-english-player";
  }, []);

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;