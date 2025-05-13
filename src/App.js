import React, { useState, useEffect, useRef, useCallback } from 'react';
import VideoPlayer from './components/VideoPlayer';
import 'video.js/dist/video-js.css';
import LearningAssistant from './components/LearningAssistant';
import TimeStats from './components/TimeStats';
import SubtitleOCR from './components/SubtitleOCR';
import aiService from './utils/aiService';

function App() {
  // OCR 结果模态框显示状态及文本
  const [ocrResult, setOcrResult] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [videoPath, setVideoPath] = useState(null);
  const [timeStats, setTimeStats] = useState({ totalTime: 0, sessionTime: 0 });
  const videoRef = useRef(null);
  // 存储最新的观看时长，避免闭包导致的旧值问题
  const timeStatsRef = useRef({ totalTime: 0, sessionTime: 0 });
  // 定时器引用，用于每分钟更新一次观看时长
  const watchTimerRef = useRef(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false); // 控制输入框显示
  const [apiKey, setApiKey] = useState(''); // 当前输入的 API Key
  const [storedApiKeyStatus, setStoredApiKeyStatus] = useState('正在加载...'); // 显示状态

  // 新增 AI 交互状态
  // 存储用户当前选中的文本，用于发送给AI助手进行解释
  const [assistantSelectedText, setAssistantSelectedText] = useState('');
  // 存储AI助手返回的解释内容，显示在学习助手面板中
  const [assistantExplanation, setAssistantExplanation] = useState('');
  // 标记AI助手是否正在加载中，用于显示加载状态
  const [assistantLoading, setAssistantLoading] = useState(false);
  // 存储用户的学习记录历史，包含查询过的文本及其解释
  const [learningRecords, setLearningRecords] = useState([]);

  // 使用 useCallback 创建稳定的回调，防止 VideoPlayer 不断卸载重挂载
  const handleTimeUpdate = useCallback((currentTime) => {
    // 这里可以处理观看时长更新逻辑
    console.log('[App] 当前播放时间:', currentTime);
  }, []);

  const handleSubtitleSelect = useCallback((text) => {
    // 这里可以处理用户点击字幕的逻辑
    console.log('[App] 用户选中字幕:', text);
  }, []);

  // 处理OCR识别结果，打开模态框并打印日志
  const handleOcrRecognize = (result) => {
    console.log('[App] handleOcrRecognize, result:', result);
    setOcrResult(result);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!window.electronAPI) return;
    const channel = 'openApiKeySettings';
    const handleOpenApiKeySettings = () => { // 原始回调
      fetchApiKey();
      setShowApiKeyInput(true);
    };
    const cleanup = window.electronAPI.on(channel, handleOpenApiKeySettings); // 使用通用的 'on' 方法
    return () => cleanup && cleanup();
    
  }, []);
  const fetchApiKey = async () => {
    if (!window.electronAPI) return;
    setStoredApiKeyStatus('正在获取...');
    try {
        const result = await window.electronAPI.invoke('getApiKey');
        if (result.success) {
            setStoredApiKeyStatus(result.apiKey ? '已设置' : '未设置');
            // 将获取的 API Key 设置到 aiService
            aiService.setApiKey(result.apiKey || '');
            // 通常不在输入框直接显示获取到的 Key，仅用于状态提示
            // setApiKey(result.apiKey || '');
        } else {
            setStoredApiKeyStatus(`获取失败: ${result.error}`);
        }
    } catch (error) {
        setStoredApiKeyStatus(`获取错误: ${error.message}`);
    }
};  

useEffect(() => {
  fetchApiKey();
}, []);

// 保存 API Key
const handleSaveApiKey = async () => {
  if (!window.electronAPI) return;
  console.log('[App] 尝试保存 API Key:', apiKey); // 不打印 Key 本身
  try {
    const result = await window.electronAPI.invoke('saveApiKey', apiKey);
    if (result.success) {
      alert('API Key 保存成功！');
      setApiKey(''); // 清空输入框
      setShowApiKeyInput(false); // 关闭输入区域
      fetchApiKey(); // 重新获取状态
    } else {
      alert(`保存失败: ${result.error}`);
    }
  } catch (error) {
    alert(`保存错误: ${error.message}`);
  }
};

  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanup = window.electronAPI.on('videoSelectedFromMenu', ({ success, path }) => {
      if (success) setVideoPath(path);
    });
    return () => cleanup && cleanup();
  }, []);

  useEffect(() => {
    if (!videoPath || !window.electronAPI) return;
    window.electronAPI.invoke('getWatchTime', { videoId: videoPath })
      .then(data => {
        const total = data.totalTime || 0;
        const session = data.sessionTime || 0;
        setTimeStats({ totalTime: total, sessionTime: session });
        // 同步 ref
        timeStatsRef.current = { totalTime: total, sessionTime: session };
      })
      .catch(err => console.error('获取观看时长失败:', err));
  }, [videoPath]);

  // 监听视频播放/暂停事件，启动或停止每分钟更新观看时长的定时器
  useEffect(() => {
    if (!videoPath || !videoRef.current) return;
    const videoEl = videoRef.current;
    // 启动定时器，每分钟更新一次时长
    const startTimer = () => {
      if (watchTimerRef.current) return;
      watchTimerRef.current = setInterval(() => {
        const newTotal = timeStatsRef.current.totalTime + 60;
        const newSession = timeStatsRef.current.sessionTime + 60;
        const currentPosition = Math.floor(videoEl.currentTime);
        // 更新到数据库
        window.electronAPI.updateWatchTime({ videoId: videoPath, totalTime: newTotal, sessionTime: newSession, currentPosition });
        // 更新本地 state 与 ref
        setTimeStats({ totalTime: newTotal, sessionTime: newSession });
        timeStatsRef.current = { totalTime: newTotal, sessionTime: newSession };
      }, 60000);
    };
    // 停止定时器
    const stopTimer = () => {
      if (watchTimerRef.current) {
        clearInterval(watchTimerRef.current);
        watchTimerRef.current = null;
      }
    };
    videoEl.addEventListener('play', startTimer);
    videoEl.addEventListener('pause', stopTimer);
    videoEl.addEventListener('ended', stopTimer);
    // 如果已经在播放，则立即启动
    if (!videoEl.paused) startTimer();
    return () => {
      stopTimer();
      videoEl.removeEventListener('play', startTimer);
      videoEl.removeEventListener('pause', stopTimer);
      videoEl.removeEventListener('ended', stopTimer);
    };
  }, [videoPath]);

  // 处理 OCR 模态框的中/英解释
  const handleOcrExplain = (language) => {
    const selection = window.getSelection().toString().trim();
    if (!selection) {
      setIsModalOpen(false);
      return;
    }
    setAssistantSelectedText(selection);
    setAssistantLoading(true);
    // 直接传入文本和语言选项，由 aiService 根据 language 添加对应系统提示
    aiService.getExplanation(selection, { language })
      .then(result => {
        setAssistantExplanation(result);
        setLearningRecords(prev => [
          ...prev,
          { subtitle_text: selection, explanation: result, timestamp: Date.now() }
        ]);
      })
      .catch(err => console.error('[App] AI解释失败:', err))
      .finally(() => setAssistantLoading(false));
    setIsModalOpen(false);
  };

  return (
    <>

      {showApiKeyInput && (     
        <div style={{
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            background: '#333', color: '#fff', padding: '20px', borderRadius: '5px',
            zIndex: 2000, boxShadow: '0 5px 15px rgba(0,0,0,0.3)'
        }}>
            <h4>设置大模型 API Key</h4>
            <p>当前状态: {storedApiKeyStatus}</p>
            <input
              type="password" // 使用 password 类型隐藏输入
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入新的 API Key (留空则清除)"
              style={{ width: '300px', marginRight: '10px', padding: '5px' }}
            />
            <button onClick={handleSaveApiKey}>保存</button>
            <button onClick={() => setShowApiKeyInput(false)} style={{ marginLeft: '10px' }}>取消</button>
            <p style={{ fontSize: '0.8em', marginTop: '10px', color: '#aaa' }}>
                API Key 将被加密存储在本地。留空并保存可以清除已存储的 Key。
            </p>
        </div>
      )}
      <div style={{ display: 'flex', width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
        <div style={{ flex: 1, backgroundColor: '#000' }}>
          {videoPath ? (
            <VideoPlayer key={videoPath}
              videoPath={videoPath}
              onTimeUpdate={handleTimeUpdate}
              onSubtitleSelect={handleSubtitleSelect}
              videoRef={videoRef}
            />
          ) : (
            <div style={{ color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <strong>文件 --&gt; 打开视频</strong>
            </div>
          )}
        </div>
        <div style={{ width: 360, borderLeft: '1px solid #444', backgroundColor: '#111', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <SubtitleOCR videoRef={videoRef} onRecognize={handleOcrRecognize} />
            <TimeStats totalTime={timeStats.totalTime} sessionTime={timeStats.sessionTime} />
          </div>
          
          {isModalOpen && (
            <div className="ocr-result-panel" style={{ padding: '10px', backgroundColor: '#222', color: '#fff', margin: '0 10px 10px' }}>
              
              <div style={{ maxHeight: 150, overflowY: 'auto', marginBottom: 8 }}>
                {ocrResult.split('\n').map((line, idx) => <p key={idx} style={{ margin: '4px 0' }}>{line}</p>)}
              </div>
              <div style={{ textAlign: 'right' }}>
                <button onClick={() => handleOcrExplain('zh')} style={{ color: '#fff', backgroundColor: '#555', border: 'none', padding: '4px 8px', borderRadius: 2 }}>
                  中文解释
                </button>
                <button onClick={() => handleOcrExplain('en')} style={{ color: '#fff', backgroundColor: '#555', border: 'none', padding: '4px 8px', borderRadius: 2 }}>
                  英文解释
                </button>
                <button onClick={() => setIsModalOpen(false)} style={{ color: '#fff', backgroundColor: '#555', border: 'none', padding: '4px 8px', borderRadius: 2 }}>
                  关闭
                </button>
              </div>
            </div>
          )}
          <LearningAssistant
            selectedText={assistantSelectedText}
            explanation={assistantExplanation}
            learningRecords={learningRecords}
            isLoading={assistantLoading}
            onQueryExplanation={(text) => {
              setAssistantSelectedText(text);
              setAssistantLoading(true);
              aiService.getExplanation(text)
                .then(result => {
                  setAssistantExplanation(result);
                  setLearningRecords(prev => [
                    ...prev,
                    { subtitle_text: text, explanation: result, timestamp: Date.now() }
                  ]);
                })
                .catch(err => console.error('[App] AI解释失败:', err))
                .finally(() => setAssistantLoading(false));
            }}
          />
        </div>
      </div>
    </>
  );
}

export default App;

