import React, { useEffect, useCallback } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import { useVideo, useTimeStats } from '../contexts/AppContext';
import { useElectronIPC } from '../hooks/useElectronIPC';
import { useSubtitle } from '../hooks/useSubtitle';
import videojs from 'video.js';

/**
 * 视频容器组件
 * 管理视频播放相关的状态和逻辑，渲染VideoPlayer组件
 */
const VideoContainer = React.memo(() => {
  const { 
    videoPath, 
    videoRef, 
    setCurrentTime, 
    setDuration, 
    setIsPlaying, 
    setSubtitleText,
    setVideoLoaded
  } = useVideo();
  
  const { startWatchTimer, stopWatchTimer } = useTimeStats();
  const { selectVideo } = useElectronIPC();
  const { subtitles } = useSubtitle();

  // 处理视频时间更新
  const handleTimeUpdate = useCallback((currentTime) => {
    setCurrentTime(currentTime);
    
    // 查找并显示当前时间对应的字幕
    if (subtitles && subtitles.length > 0) {
      const currentSubtitle = subtitles.find(
        sub => currentTime >= sub.start && currentTime <= sub.end
      );
      
      if (currentSubtitle) {
        setSubtitleText(currentSubtitle.text);
      } else {
        setSubtitleText('');
      }
    }
  }, [subtitles, setCurrentTime, setSubtitleText]);

  // 处理字幕选择
  const handleSubtitleSelect = useCallback((text) => {
    console.log('字幕选择:', text);
    // 用户点击字幕时的处理逻辑
  }, []);

  // 监听视频播放/暂停事件以启动/停止时间统计
  useEffect(() => {
    if (!videoPath || !videoRef.current) return;
    
    // 新视频加载，重置加载状态
    setVideoLoaded(false);
    
    const player = videojs(videoRef.current);
    
    // 定义事件处理函数
    const handlePlay = () => {
      setIsPlaying(true);
      startWatchTimer(videoPath, videoRef);
    };
    const handlePause = () => {
      setIsPlaying(false);
      stopWatchTimer();
    };
    const handleEnded = () => {
      setIsPlaying(false);
      stopWatchTimer();
    };
    const handleLoadedMetadata = () => {
      setDuration(player.duration());
      setVideoLoaded(true);
    };
    const handleErrorEvent = () => {
      setVideoLoaded(false);
    };
    
    // 使用 video.js 的事件监听
    player.on('play', handlePlay);
    player.on('pause', handlePause);
    player.on('ended', handleEnded);
    player.on('loadedmetadata', handleLoadedMetadata);
    player.on('error', handleErrorEvent);
    
    // 初始化时，如果视频已经在播放，则启动计时器
    if (!player.paused()) {
      setIsPlaying(true);
      startWatchTimer(videoPath, videoRef);
    }
    
    return () => {
      // 移除事件监听
      player.off('play', handlePlay);
      player.off('pause', handlePause);
      player.off('ended', handleEnded);
      player.off('loadedmetadata', handleLoadedMetadata);
      player.off('error', handleErrorEvent);
      stopWatchTimer();
      // 不再销毁播放器，VideoPlayer 会处理 dispose
    };
  }, [videoPath, videoRef, setIsPlaying, setDuration, startWatchTimer, stopWatchTimer, setVideoLoaded]);

  // 如果没有视频路径，显示提示
  if (!videoPath) {
    return (
      <div style={{ 
        flex: 1, 
        backgroundColor: '#000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        color: '#fff'
      }}>
        <strong>文件 → 打开视频</strong>
        <button 
          onClick={selectVideo} 
          style={{ 
            marginTop: '20px', 
            padding: '10px 20px',
            backgroundColor: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          选择视频文件
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, backgroundColor: '#000' }}>
      <VideoPlayer
        key={videoPath}
        videoPath={videoPath}
        onTimeUpdate={handleTimeUpdate}
        onSubtitleSelect={handleSubtitleSelect}
        videoRef={videoRef}
      />
    </div>
  );
});

export default VideoContainer; 