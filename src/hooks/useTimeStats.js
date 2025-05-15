import { useEffect, useCallback } from 'react';
import { useTimeStats as useTimeStatsContext } from '../contexts/AppContext';
import { useVideo } from '../contexts/AppContext';

/**
 * 时间统计钩子
 * 处理观看时间统计、记录和定时更新逻辑
 */
export const useTimeStats = () => {
  // 使用来自Context的状态和actions
  const {
    totalTime,
    sessionTime,
    updateStats,
    startWatchTimer,
    stopWatchTimer,
    timeStatsRef,
    watchTimerRef
  } = useTimeStatsContext();
  
  const { videoPath, videoRef, isPlaying } = useVideo();

  // 从主进程获取时间统计数据
  const fetchTimeStats = useCallback(async () => {
    if (!window.electronAPI || !videoPath) return;
    
    try {
      const data = await window.electronAPI.invoke('getWatchTime', { videoId: videoPath });
      updateStats({
        totalTime: data.totalTime || 0,
        sessionTime: data.sessionTime || 0
      });
      
      console.log('获取观看时长:', data);
      return data;
    } catch (error) {
      console.error('获取观看时长失败:', error);
      return { totalTime: 0, sessionTime: 0, lastPosition: 0 };
    }
  }, [videoPath, updateStats]);

  // 更新观看时长到主进程
  const updateWatchTime = useCallback((manualData = null) => {
    if (!window.electronAPI || !videoPath || !videoRef.current) return;
    
    const currentPosition = Math.floor(videoRef.current.currentTime);
    const data = manualData || {
      videoId: videoPath,
      totalTime: timeStatsRef.current.totalTime,
      sessionTime: timeStatsRef.current.sessionTime,
      currentPosition
    };
    
    window.electronAPI.updateWatchTime(data);
    console.log('更新观看时长:', data);
  }, [videoPath, videoRef, timeStatsRef]);

  // 根据视频路径变化获取时长统计
  useEffect(() => {
    if (videoPath) {
      fetchTimeStats();
    }
  }, [videoPath, fetchTimeStats]);

  // 监听视频播放/暂停事件，启动或停止时长统计
  useEffect(() => {
    if (!videoPath || !videoRef || !videoRef.current) return;
    
    const videoEl = videoRef.current;
    
    const handlePlay = () => {
      console.log('视频播放，开始计时');
      startWatchTimer(videoPath, videoRef);
    };
    
    const handlePause = () => {
      console.log('视频暂停，停止计时');
      stopWatchTimer();
      // 保存当前的观看进度
      updateWatchTime();
    };
    
    const handleEnded = () => {
      console.log('视频结束，停止计时');
      stopWatchTimer();
      // 保存当前的观看进度
      updateWatchTime();
    };
    
    // 添加事件监听
    videoEl.addEventListener('play', handlePlay);
    videoEl.addEventListener('pause', handlePause);
    videoEl.addEventListener('ended', handleEnded);
    
    // 如果视频已经在播放中，立即启动计时器
    if (!videoEl.paused) {
      handlePlay();
    }
    
    // 清理函数
    return () => {
      stopWatchTimer();
      if (videoEl) {
        videoEl.removeEventListener('play', handlePlay);
        videoEl.removeEventListener('pause', handlePause);
        videoEl.removeEventListener('ended', handleEnded);
      }
    };
  }, [videoPath, videoRef, startWatchTimer, stopWatchTimer, updateWatchTime]);

  // 在组件卸载时保存最后的时长统计
  useEffect(() => {
    return () => {
      if (videoPath && timeStatsRef.current) {
        updateWatchTime();
      }
    };
  }, [videoPath, timeStatsRef, updateWatchTime]);

  // 格式化时间为小时:分钟
  const formatTime = useCallback((seconds) => {
    const totalMinutes = Math.floor((seconds || 0) / 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0')
    ].join(':');
  }, []);

  // 计算距离1000小时还剩余的秒数
  const remainingSeconds = Math.max(0, 1000 * 3600 - totalTime);

  return {
    totalTime,
    sessionTime,
    formatTime,
    remainingSeconds,
    fetchTimeStats,
    updateWatchTime,
    isTimerActive: !!watchTimerRef.current
  };
};

export default useTimeStats; 