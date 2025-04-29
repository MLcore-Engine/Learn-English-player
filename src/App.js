import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import VideoPlayer from './components/VideoPlayer';
import LearningAssistant from './components/LearningAssistant';
import TimeStats from './components/TimeStats';
import OCRTools from './components/OCRTools';
import './App.css';

// 创建暗色主题
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
  },
});

function App() {
  const [videoData, setVideoData] = useState(null);
  const [subtitles, setSubtitles] = useState([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [timeStats, setTimeStats] = useState({
    totalTime: 0,
    sessionTime: 0,
    currentPosition: 0
  });
  const [explanation, setExplanation] = useState('');
  const [learningRecords, setLearningRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 用于存储 useEffect 返回的清理函数
  const cleanupFunctionsRef = React.useRef([]);

  // 监听主进程事件 (使用 window.electronAPI.on)
  useEffect(() => {
    // 清理旧的监听器（如果因为 HMR 或其他原因重新运行）
    cleanupFunctionsRef.current.forEach(cleanup => cleanup());
    cleanupFunctionsRef.current = [];

    const handleSubtitleLoaded = (data) => { // 监听器参数没有 event
      console.log('【App】收到 subtitleLoaded:', data);
      if (data.success && data.subtitles) {
        setSubtitles(data.subtitles);
      } else {
        console.error('加载字幕失败:', data.error);
        setSubtitles([]);
      }
    };

    const handleDatabaseInitError = (data) => {
        console.error('【App】数据库初始化错误:', data);
        // 可以在 UI 上显示错误信息
    };

    const handleError = (data) => {
        console.error('【App】收到主进程错误:', data);
        // 可以在 UI 上显示通用错误信息
    };

    // 注册监听器并保存清理函数
    if (window.electronAPI) { // 确保 API 存在
      let cleanup;
      cleanup = window.electronAPI.on('subtitleLoaded', handleSubtitleLoaded);
      if (cleanup) cleanupFunctionsRef.current.push(cleanup);
      
      cleanup = window.electronAPI.on('databaseInitError', handleDatabaseInitError);
      if (cleanup) cleanupFunctionsRef.current.push(cleanup);
      
      cleanup = window.electronAPI.on('error', handleError);
      if (cleanup) cleanupFunctionsRef.current.push(cleanup);
      
      // 注意：videoSelected, watchTimeData, learningRecords 现在通过 invoke 获取，不需要 on 监听

    } else {
        console.error('【App】window.electronAPI 未定义！IPC 将无法工作。');
        // 可能需要显示一个错误状态给用户
    }

    // 组件卸载时执行最终清理
    return () => {
      console.log('【App】清理 IPC 监听器');
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current = [];
    };
  }, []); // 空依赖数组，只运行一次

  // 加载初始数据 (使用 invoke)
  const loadInitialData = async (selectedVideoPath) => {
      if (!window.electronAPI) return;
      setIsLoading(true);
      try {
          console.log('【App】调用 getWatchTime for:', selectedVideoPath);
          const watchTimeData = await window.electronAPI.invoke('getWatchTime', { videoId: selectedVideoPath });
          console.log('【App】收到 watchTimeData:', watchTimeData);
          setTimeStats({
              totalTime: watchTimeData.totalTime || 0,
              sessionTime: 0,
              currentPosition: watchTimeData.lastPosition || 0
          });

          console.log('【App】调用 getLearningRecords for:', selectedVideoPath);
          const records = await window.electronAPI.invoke('getLearningRecords', { videoId: selectedVideoPath });
          console.log('【App】收到 learningRecords:', records);
          setLearningRecords(records || []);
          
      } catch (error) {
          console.error('【App】加载初始数据失败:', error);
      } finally {
          setIsLoading(false);
      }
  };

  // 处理选择视频文件 (使用 invoke)
  const handleOpenVideo = async () => {
    if (!window.electronAPI) return;
    console.log('【App】调用 selectVideo');
    setIsLoading(true);
    try {
      const result = await window.electronAPI.invoke('selectVideo');
      console.log('【App】selectVideo 结果:', result);
      if (result.success && result.path) {
        setVideoData({ path: result.path, name: result.name }); // 设置视频数据
        
        // 如果有字幕，请求加载字幕 (使用 send)
        if (result.subtitlePath) {
            console.log('【App】请求加载字幕 for:', result.path);
            window.electronAPI.send('loadSubtitle', { videoPath: result.path });
        } else {
            setSubtitles([]);
        }
        // 加载该视频的初始数据
        loadInitialData(result.path);
      } else if (result.canceled) {
          console.log('【App】用户取消选择视频');
      }
    } catch (error) {
      console.error('【App】选择视频失败:', error);
      // 可能需要向用户显示错误
    } finally {
        setIsLoading(false);
    }
  };
  
  // 定时更新观看时长 (使用 send)
  useEffect(() => {
    if (!videoData || !window.electronAPI) return;
    
    const timer = setInterval(() => {
      // 确保 videoData 和 currentTime 有效
      if (videoData.path && currentTime > 0) { 
        const newSessionTime = timeStats.sessionTime + 1;
        const newTotalTime = timeStats.totalTime + 1;
        
        setTimeStats(prev => ({ // 使用函数式更新
          ...prev,
          sessionTime: newSessionTime,
          totalTime: newTotalTime,
          currentPosition: currentTime
        }));
        
        // 每30秒将数据发送到主进程保存
        if (newSessionTime % 30 === 0) {
          console.log('【App】发送 updateWatchTime');
          window.electronAPI.send('updateWatchTime', {
            videoId: videoData.path,
            totalTime: newTotalTime,
            sessionTime: newSessionTime,
            currentPosition: currentTime
          });
        }
      }
    }, 1000);
    
    return () => clearInterval(timer);
  // 依赖项调整：确保 videoData.path 变化时也能正确处理
  }, [videoData?.path, currentTime, timeStats.sessionTime, timeStats.totalTime]); 
  
  // 当视频时间更新时
  const handleTimeUpdate = (time) => {
    setCurrentTime(time);
    
    // 寻找当前时间对应的字幕
    if (subtitles.length > 0) {
      const currentSubtitle = subtitles.find(sub => 
        time >= sub.start / 1000 && time <= sub.end / 1000
      );
      
      if (currentSubtitle && currentSubtitle !== selectedSubtitle) {
        setSelectedSubtitle(currentSubtitle);
      }
    }
  };
  
  // 处理字幕选择
  const handleSubtitleSelect = (text) => {
    setSelectedSubtitle({ text });
    queryExplanation(text);
  };
  
  // 查询AI解释 (使用 invoke 保存记录)
  const queryExplanation = async (text) => {
    try {
      // 模拟 AI API 调用
      setExplanation(`解释内容将在这里显示: "${text}"`);
      
      // 保存学习记录 (使用 invoke)
      if (videoData && window.electronAPI) {
        console.log('【App】调用 saveLearningRecord');
        const saveResult = await window.electronAPI.invoke('saveLearningRecord', {
          videoId: videoData.path,
          subtitleId: selectedSubtitle?.id || null, // 假设 subtitle 对象有 id
          content: text,
          translation: `解释内容将在这里显示: "${text}"`, // 示例翻译
          note: '' // 示例笔记
        });
        console.log('【App】saveLearningRecord 结果:', saveResult);
        if (saveResult.success) {
           // 可以在保存成功后重新加载学习记录，或者乐观更新UI
           loadInitialData(videoData.path); // 重新加载数据以更新列表
        }
      }
    } catch (error) {
      console.error('【App】获取解释或保存记录失败:', error);
      setExplanation('处理失败，请重试');
    }
  };
  
  // 处理OCR结果
  const handleOCRResult = (text) => {
    if (text) {
      // 将OCR识别结果用于查询解释
      queryExplanation(text);
    }
  };
  
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ height: '100vh', py: 2 }}>
        <Typography variant="h3" component="h1" align="center" gutterBottom>
          视频学习播放器
        </Typography>
        
        {!videoData ? (
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '70vh'
            }}
          >
            <Typography variant="h5" gutterBottom>
              请先选择视频文件
            </Typography>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleOpenVideo}
              size="large"
              disabled={isLoading}
            >
              {isLoading ? '加载中...' : '选择视频文件'}
            </Button>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {/* 左侧视频播放区 */}
            <Grid item xs={12} md={8}>
              <VideoPlayer 
                videoPath={videoData.path} 
                subtitles={subtitles}
                currentSubtitle={selectedSubtitle}
                onTimeUpdate={handleTimeUpdate}
                onSubtitleSelect={handleSubtitleSelect}
                initialTime={timeStats.currentPosition}
              />
              
              {/* 时长统计 */}
              <TimeStats 
                totalTime={timeStats.totalTime}
                sessionTime={timeStats.sessionTime}
                currentPosition={currentTime}
              />
            </Grid>
            
            {/* 右侧学习助手 */}
            <Grid item xs={12} md={4}>
              <LearningAssistant 
                selectedText={selectedSubtitle ? selectedSubtitle.text : ''}
                explanation={explanation}
                learningRecords={learningRecords}
                onQueryExplanation={queryExplanation}
              />
              
              {/* 添加OCR工具组件 */}
              {videoData && (
                <OCRTools 
                  videoPath={videoData.path}
                  currentTime={currentTime}
                  onOCRResult={handleOCRResult}
                />
              )}
            </Grid>
          </Grid>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;

