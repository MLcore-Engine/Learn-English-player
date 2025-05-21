import React, { createContext, useContext, useReducer, useRef, useCallback } from 'react';
import {
  videoReducer,
  timeStatsReducer,
  aiReducer,
  ocrReducer,
  apiKeyReducer
} from '../reducers';
import { parseSrt, parseVtt } from '../utils/subtitleParser.js';

// 创建各个功能模块的上下文
const VideoContext = createContext();
const TimeStatsContext = createContext();
const AIContext = createContext();
const OCRContext = createContext();
const ApiKeyContext = createContext();

// 导出自定义钩子，便于组件使用
export const useVideo = () => {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error('useVideo must be used within a VideoProvider');
  }
  return context;
};

export const useTimeStats = () => {
  const context = useContext(TimeStatsContext);
  if (!context) {
    throw new Error('useTimeStats must be used within a TimeStatsProvider');
  }
  return context;
};

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within a AIProvider');
  }
  return context;
};

export const useOCR = () => {
  const context = useContext(OCRContext);
  if (!context) {
    throw new Error('useOCR must be used within a OCRProvider');
  }
  return context;
};

export const useApiKey = () => {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error('useApiKey must be used within a ApiKeyProvider');
  }
  return context;
};

// 视频相关Provider
export const VideoProvider = ({ children }) => {
  const [state, dispatch] = useReducer(videoReducer, {
    videoPath: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    subtitleText: '',
    isLoaded: false, // 视频加载状态
    externalSubtitles: null, // 新增：外部字幕数据
  });

  const videoRef = useRef(null);

  const setVideoPath = useCallback((path) => dispatch({ type: 'SET_VIDEO_PATH', payload: path }), []);
  const setCurrentTime = useCallback((time) => dispatch({ type: 'SET_CURRENT_TIME', payload: time }), []);
  const setDuration = useCallback((duration) => dispatch({ type: 'SET_DURATION', payload: duration }), []);
  const setIsPlaying = useCallback((isPlaying) => dispatch({ type: 'SET_IS_PLAYING', payload: isPlaying }), []);
  const setSubtitleText = useCallback((text) => dispatch({ type: 'SET_SUBTITLE_TEXT', payload: text }), []);
  const setVideoLoaded = useCallback((loaded) => dispatch({ type: 'SET_VIDEO_LOADED', payload: loaded }), []);
  const setExternalSubtitles = useCallback((subtitles) => dispatch({ type: 'SET_EXTERNAL_SUBTITLES', payload: subtitles }), []);

  const loadExternalSubtitles = useCallback(async (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target.result;
      try {
        let parsedSubtitles;
        if (file.name.endsWith('.srt')) {
          parsedSubtitles = parseSrt(content);
        } else if (file.name.endsWith('.vtt')) {
          parsedSubtitles = parseVtt(content);
        } else {
          console.error('Unsupported file type');
          alert('Unsupported file type. Please select .srt or .vtt');
          return;
        }
        setExternalSubtitles(parsedSubtitles);
        console.log('External subtitles loaded:', parsedSubtitles);
        alert(`Subtitles loaded from ${file.name}`);
      } catch (error) {
        console.error('Error parsing subtitle file:', error);
        alert(`Error parsing subtitle file: ${error.message}`);
        setExternalSubtitles(null);
      }
    };
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      alert(`Error reading file: ${error.message}`);
      setExternalSubtitles(null);
    };
    reader.readAsText(file);
  }, [setExternalSubtitles]);
  
  const contextValue = React.useMemo(() => ({
    ...state,
    setVideoPath,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    setSubtitleText,
    setVideoLoaded,
    setExternalSubtitles, // 暴露 setExternalSubtitles
    loadExternalSubtitles, // 暴露 loadExternalSubtitles
    videoRef
  }), [state, setVideoPath, setCurrentTime, setDuration, setIsPlaying, setSubtitleText, setVideoLoaded, setExternalSubtitles, loadExternalSubtitles]);

  return (
    <VideoContext.Provider value={contextValue}>
      {children}
    </VideoContext.Provider>
  );
};

// 时间统计Provider
export const TimeStatsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(timeStatsReducer, {
    totalTime: 0,
    sessionTime: 0
  });
  
  // 存储最新的观看时长引用，避免闭包陷阱
  const timeStatsRef = useRef({ totalTime: 0, sessionTime: 0 });
  // 保存定时器引用
  const watchTimerRef = useRef(null);

  // 同步ref和state
  React.useEffect(() => {
    timeStatsRef.current = state;
  }, [state]);

  const actions = {
    updateStats: (stats) => {
      dispatch({ type: 'UPDATE_STATS', payload: stats });
    },
    incrementSessionTime: (seconds = 60) => {
      dispatch({ type: 'INCREMENT_SESSION_TIME', payload: seconds });
    },
    incrementTotalTime: (seconds = 60) => {
      dispatch({ type: 'INCREMENT_TOTAL_TIME', payload: seconds });
    },
    resetSessionTime: () => {
      dispatch({ type: 'RESET_SESSION_TIME' });
    },
    // 启动观看时长定时器
    startWatchTimer: (videoPath, videoRef) => {
      if (watchTimerRef.current || !videoPath || !videoRef.current) return;
      
      watchTimerRef.current = setInterval(() => {
        const newTotal = timeStatsRef.current.totalTime + 60;
        const newSession = timeStatsRef.current.sessionTime + 60;
        const currentPosition = Math.floor(videoRef.current.currentTime);
        
        // 更新到数据库
        if (window.electronAPI) {
          window.electronAPI.updateWatchTime({
            videoId: videoPath,
            totalTime: newTotal,
            sessionTime: newSession,
            currentPosition
          });
        }
        
        // 更新本地状态
        dispatch({ 
          type: 'UPDATE_STATS', 
          payload: { totalTime: newTotal, sessionTime: newSession } 
        });
      }, 60000);
    },
    // 停止观看时长定时器
    stopWatchTimer: () => {
      if (watchTimerRef.current) {
        clearInterval(watchTimerRef.current);
        watchTimerRef.current = null;
      }
    }
  };

  return (
    <TimeStatsContext.Provider value={{ 
      ...state, 
      ...actions,
      timeStatsRef,
      watchTimerRef
    }}>
      {children}
    </TimeStatsContext.Provider>
  );
};

// AI助手Provider
export const AIProvider = ({ children }) => {
  const [state, dispatch] = useReducer(aiReducer, {
    selectedText: '',
    explanation: '',
    loading: false,
    records: []
  });

  const actions = {
    setSelectedText: (text) => {
      dispatch({ type: 'SET_SELECTED_TEXT', payload: text });
    },
    setExplanation: (explanation) => {
      dispatch({ type: 'SET_EXPLANATION', payload: explanation });
    },
    setLoading: (loading) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    },
    addRecord: (record) => {
      dispatch({ type: 'ADD_RECORD', payload: record });
      
      // 可选：保存到数据库
      if (window.electronAPI) {
        window.electronAPI.saveAiQuery({
          query: record.subtitle_text,
          explanation: record.explanation,
          timestamp: new Date().toISOString()
        });
      }
    },
    clearRecords: () => {
      dispatch({ type: 'CLEAR_RECORDS' });
    },
    removeRecord: (index) => {
      dispatch({ type: 'REMOVE_RECORD', payload: index });
    }
  };

  return (
    <AIContext.Provider value={{ ...state, ...actions }}>
      {children}
    </AIContext.Provider>
  );
};

// OCR识别Provider
export const OCRProvider = ({ children }) => {
  const [state, dispatch] = useReducer(ocrReducer, {
    result: '',
    isModalOpen: false,
    loading: false
  });

  const actions = {
    setResult: (result) => {
      dispatch({ type: 'SET_RESULT', payload: result });
    },
    setModalOpen: (isOpen) => {
      dispatch({ type: 'SET_MODAL_OPEN', payload: isOpen });
    },
    setLoading: (loading) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    },
    clearResult: () => {
      dispatch({ type: 'CLEAR_RESULT' });
    }
  };

  return (
    <OCRContext.Provider value={{ ...state, ...actions }}>
      {children}
    </OCRContext.Provider>
  );
};

// API Key设置Provider
export const ApiKeyProvider = ({ children }) => {
  const [state, dispatch] = useReducer(apiKeyReducer, {
    apiKey: '',
    showInput: false,
    status: '正在加载...'
  });

  const actions = {
    setApiKey: (apiKey) => {
      dispatch({ type: 'SET_API_KEY', payload: apiKey });
    },
    setShowInput: (show) => {
      dispatch({ type: 'SET_SHOW_INPUT', payload: show });
    },
    setStatus: (status) => {
      dispatch({ type: 'SET_STATUS', payload: status });
    }
  };

  return (
    <ApiKeyContext.Provider value={{ ...state, ...actions }}>
      {children}
    </ApiKeyContext.Provider>
  );
};

// 组合所有Provider的便捷组件
export const AppProvider = ({ children }) => {
  return (
    <VideoProvider>
      <TimeStatsProvider>
        <AIProvider>
          <OCRProvider>
            <ApiKeyProvider>
              {children}
            </ApiKeyProvider>
          </OCRProvider>
        </AIProvider>
      </TimeStatsProvider>
    </VideoProvider>
  );
};
