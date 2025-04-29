import React, { useRef, useEffect, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css'; // 导入 Video.js CSS
import { 
  Box, 
  Paper, 
  Typography, 
  Slider, 
  IconButton, 
  Grid
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  VolumeUp,
  VolumeOff,
  FullscreenRounded,
  SpeedRounded
} from '@mui/icons-material';

// 辅助函数：生成安全的本地文件 URL
const createSafeFileUrl = (filePath) => {
  if (!filePath) return '';
  // 1. 标准化路径分隔符 (可选，通常 Node path 会处理)
  // 2. 移除可能的协议头 (如 file://)
  const cleanedPath = filePath.replace(/^file:\/\//, '');
  // 3. 对路径进行 URL 编码 (处理空格、特殊字符)
  const encodedPath = encodeURI(cleanedPath).replace(/#/g, '%23'); // encodeURI 不编码 #
  // 4. 添加自定义协议前缀
  return `safe-file:///${encodedPath}`; // 使用三个斜杠
};

const VideoPlayer = ({ 
  videoPath, 
  subtitles, // 保持期望格式
  // currentSubtitle, // 不再直接使用，由 video.js 处理
  onTimeUpdate, 
  // onSubtitleSelect, // 点击字幕交互暂时移除，用 video.js 默认显示
  initialTime 
}) => {
  const videoNodeRef = useRef(null);
  const playerRef = useRef(null); // 用于存储 videojs 播放器实例

  // 使用 state 来驱动 UI 更新
  const [playerState, setPlayerState] = useState({
    playing: false,
    volume: 0.8,
    muted: false,
    playedSeconds: 0,
    duration: 0,
    playbackRate: 1,
  });
  
  // 处理字幕点击（如果需要自定义交互）
  // const handleSubtitleClick = (text) => {
  //   if (onSubtitleSelect && text) {
  //     onSubtitleSelect(text);
  //   }
  // };

  // 初始化和销毁 Video.js 播放器
  useEffect(() => {
    if (!videoNodeRef.current) return;

    // 使用新的辅助函数生成 URL
    const sourceUrl = createSafeFileUrl(videoPath);
    if (!sourceUrl) return;
    
    const options = {
      autoplay: false,
      controls: false, // 使用自定义控件
      sources: [{
        src: sourceUrl,
        // type: 'video/mp4' // video.js 通常能自动检测
      }],
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2]
    };

    // 初始化播放器
    const player = videojs(videoNodeRef.current, options, function onPlayerReady() {
      console.log('【VideoPlayer】Video.js is ready');
      playerRef.current = this; // 保存播放器实例

      // 设置初始状态
      setPlayerState(prev => ({
        ...prev,
        volume: this.volume(),
        muted: this.muted(),
        playbackRate: this.playbackRate(),
      }));
      
      // 设置初始时间
      if (initialTime > 0) {
        this.currentTime(initialTime);
      }
      
      // 添加字幕轨道
      if (subtitles && subtitles.src) {
         const trackOptions = {
             kind: subtitles.kind || 'subtitles',
             src: createSafeFileUrl(subtitles.src), // <--- 对字幕也使用新协议
             srclang: subtitles.srclang || 'en',
             label: subtitles.label || 'Subtitles',
             default: true
         };
         console.log('【VideoPlayer】Adding text track:', trackOptions);
         this.addRemoteTextTrack(trackOptions, false);
      }

      // --- 事件监听 --- 
      this.on('play', () => setPlayerState(prev => ({ ...prev, playing: true })));
      this.on('pause', () => setPlayerState(prev => ({ ...prev, playing: false })));
      this.on('volumechange', () => {
        setPlayerState(prev => ({ 
          ...prev, 
          volume: this.volume(), 
          muted: this.muted() 
        }));
      });
      this.on('durationchange', () => {
        setPlayerState(prev => ({ ...prev, duration: this.duration() }));
      });
      this.on('timeupdate', () => {
        const currentTime = this.currentTime();
        setPlayerState(prev => ({ ...prev, playedSeconds: currentTime }));
        if (onTimeUpdate) {
          onTimeUpdate(currentTime);
        }
      });
      this.on('ratechange', () => {
        setPlayerState(prev => ({ ...prev, playbackRate: this.playbackRate() }));
      });
       // 监听字幕变化（如果需要获取当前显示的字幕文本）
      // this.on('cuechange', () => {
      //   const activeCues = this.textTracks()?.[0]?.activeCues;
      //   if (activeCues && activeCues.length > 0) {
      //     // console.log('Active cue:', activeCues[0].text);
      //     // 这里可以更新状态或调用 prop
      //   }
      // });
    });

    // 组件卸载时销毁播放器
    return () => {
      if (playerRef.current) {
        console.log('【VideoPlayer】Disposing Video.js player');
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  // 更新依赖项，确保证字幕路径变化时也能重新加载
  }, [videoPath, initialTime, subtitles?.src]); 

  // --- 控制栏处理函数 --- 
  const handlePlayPause = () => {
    if (!playerRef.current) return;
    if (playerRef.current.paused()) {
      playerRef.current.play();
    } else {
      playerRef.current.pause();
    }
  };

  const handleToggleMute = () => {
    if (!playerRef.current) return;
    playerRef.current.muted(!playerRef.current.muted());
  };

  const handleSeekChange = (e, newValue) => {
    if (!playerRef.current) return;
    const newTime = (newValue / 100) * playerState.duration;
    // 可以在这里直接更新 playerState.playedSeconds 以提供即时反馈
    setPlayerState(prev => ({ ...prev, playedSeconds: newTime }));
    playerRef.current.currentTime(newTime);
  };

  const handleVolumeChange = (e, newValue) => {
    if (!playerRef.current) return;
    const newVolume = newValue / 100;
    playerRef.current.volume(newVolume);
    // Video.js 会自动处理音量为 0 时的静音状态，volumechange 事件会更新 state
  };

  const handlePlaybackRateChange = () => {
    if (!playerRef.current) return;
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playerState.playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    playerRef.current.playbackRate(rates[nextIndex]);
  };

  const handleFullScreen = () => {
    if (!playerRef.current) return;
    if (playerRef.current.isFullscreen()) {
      playerRef.current.exitFullscreen();
    } else {
      playerRef.current.requestFullscreen();
    }
  };

  // 格式化时间
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds === Infinity) return '00:00';
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours();
    const mm = date.getUTCMinutes();
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    if (hh) return `${hh}:${mm.toString().padStart(2, '0')}:${ss}`;
    return `${mm}:${ss}`;
  };
  
  const playedRatio = playerState.duration ? playerState.playedSeconds / playerState.duration : 0;

  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      <Paper 
        elevation={3} 
        sx={{ 
          position: 'relative',
          backgroundColor: '#000',
          overflow: 'hidden'
        }}
      >
        {/* Video.js 播放器容器 */}
        <div data-vjs-player>
          <video 
            ref={videoNodeRef} 
            className="video-js vjs-big-play-centered" // 使用 video.js 样式
            style={{ width: '100%', height: 'auto' }} // 自适应大小
          />
        </div>
        
        {/* 自定义控制栏 (与之前类似) */}
        <Box sx={{ p: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
          <Grid container alignItems="center" spacing={1}>
            <Grid item>
              <IconButton onClick={handlePlayPause} color="primary">
                {playerState.playing ? <Pause /> : <PlayArrow />}
              </IconButton>
            </Grid>
            <Grid item>
              <Typography variant="body2" color="text.secondary">
                {formatTime(playerState.playedSeconds)} / {formatTime(playerState.duration)}
              </Typography>
            </Grid>
            <Grid item xs>
              <Slider
                min={0}
                max={100}
                value={playedRatio * 100}
                onChangeCommitted={handleSeekChange} // 只在提交时 seek，避免性能问题
                // 如果需要拖动时预览，可以在 onChange 中更新 UI 状态，但不 seek
                sx={{ mx: 2 }}
              />
            </Grid>
            <Grid item>
              <IconButton onClick={handlePlaybackRateChange} color="primary">
                <SpeedRounded />
              </IconButton>
              <Typography variant="body2" component="span" sx={{ ml: 0.5 }}>
                {playerState.playbackRate}x
              </Typography>
            </Grid>
            <Grid item>
              <Grid container spacing={1} alignItems="center">
                <Grid item>
                  <IconButton onClick={handleToggleMute} color="primary">
                    {playerState.muted ? <VolumeOff /> : <VolumeUp />}
                  </IconButton>
                </Grid>
                <Grid item xs>
                  <Slider
                    min={0}
                    max={100}
                    value={playerState.muted ? 0 : playerState.volume * 100}
                    onChange={handleVolumeChange} // 直接修改音量
                    sx={{ width: 100 }}
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid item>
              <IconButton onClick={handleFullScreen} color="primary">
                <FullscreenRounded />
              </IconButton>
            </Grid>
          </Grid>
        </Box>
      </Paper>
      
      {/* 移除了之前的字幕显示区域 */}
      {/* 字幕现在由 video.js 内部处理 */}
    </Box>
  );
};

export default VideoPlayer;