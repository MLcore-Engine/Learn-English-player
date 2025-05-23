import React, { useLayoutEffect, useRef, useEffect, useState, useCallback } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

/**
 * 视频播放器组件
 * 负责视频的播放和控制
 */
const VideoPlayer = React.memo(({ videoPath, onTimeUpdate, onSubtitleSelect, videoRef, subtitles }) => {
  const playerRef = useRef(null);
  const playerInitializedRef = useRef(false);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [activeSubtitleText, setActiveSubtitleText] = useState('');

  // 清理播放器实例的函数
  const cleanupPlayer = useCallback(() => {
    if (playerRef.current) {
      try {
        // 先暂停播放
        if (playerRef.current.pause) {
          playerRef.current.pause();
        }
        // 确保播放器实例存在且有效
        if (playerRef.current.el_ && playerRef.current.el_.parentNode) {
          playerRef.current.dispose();
        }
      } catch (error) {
        console.error('【渲染进程】清理播放器实例时出错:', error);
      }
      playerRef.current = null;
      playerInitializedRef.current = false;
    }
  }, []);

  // 加载字幕文件
  const loadSubtitle = useCallback(async (subtitlePath) => {
    if (!playerRef.current || !subtitlePath) return;

    try {
      const response = await fetch(subtitlePath);
      const text = await response.text();
      
      // 创建字幕轨道
      const track = playerRef.current.addRemoteTextTrack({
        kind: 'subtitles',
        label: '字幕',
        language: 'zh',
        src: subtitlePath
      }, false);

      // 监听字幕变化
      track.addEventListener('cuechange', () => {
        const cues = track.activeCues;
        if (cues && cues.length > 0) {
          const text = cues[0].text;
          setActiveSubtitleText(text);
          onSubtitleSelect && onSubtitleSelect(text);
        }
      });

    } catch (error) {
      console.error('加载字幕失败:', error);
    }
  }, [onSubtitleSelect]);

  // 处理视频格式转换
  const handleVideoConversion = useCallback(async (inputPath) => {
    setIsConverting(true);
    try {
      const finalPath = await window.electronAPI.prepareVideo(inputPath);
      return finalPath;
    } catch (error) {
      console.error('prepareVideo错误:', error);
      alert(error.message || '视频处理失败');
      throw error;
    } finally {
      setIsConverting(false);
    }
  }, []);

  // 监听 videoPath 变化
  useEffect(() => {
    // 当 videoPath 改变时，清理旧的播放器实例
    // cleanupPlayer(); // No longer needed due to component remounting via key
    
    // 组件卸载时清理缓存
    return () => {
      if (window.electronAPI.cleanupVideoCache) {
        window.electronAPI.cleanupVideoCache().catch(error => {
          console.error('清理视频缓存失败:', error);
        });
      }
    };
  }, [videoPath]);

  useLayoutEffect(() => {
    let canceled = false;
    let player = null;

    if (!videoPath) return;

    (async () => {
      try {
        if (playerRef.current) cleanupPlayer();

        const videoEl = videoRef.current;
        if (!videoEl) {
          console.error('【渲染进程】视频元素未找到，无法初始化播放器');
          return;
        }

        // 处理视频格式转换
        const finalVideoPath = await handleVideoConversion(videoPath);

        // 初始化 Video.js 播放器
        const options = {
          autoplay: false,
          controls: true,
          preload: 'auto',
          width: '100%',
          height: '100%',
          html5: { nativeVideoTracks: true, nativeAudioTracks: true, nativeTextTracks: true },
          liveui: false,
          inactivityTimeout: 3000,
          playbackRates: [0.5, 1, 1.5, 2]
        };

        videoEl.className = 'video-js vjs-big-play-centered';
        await new Promise(resolve => requestAnimationFrame(resolve));
        player = videojs(videoEl, options);
        playerRef.current = player;

        // 设置音量及其他事件
        player.volume(0.3);

        player.tech().on('waiting', () => console.log('【渲染进程】视频缓冲中...'));
        player.tech().on('canplay', () => console.log('【渲染进程】视频可以播放'));
        player.on('error', (e) => {
          const error = player.error();
          console.error('【渲染进程】Video.js错误:', { code: error.code, message: error.message, detail: e });
        });
        player.on('loadeddata', () => {
          // 不在此处触发播放
        });
        let lastReportedSecond = -1;
        player.on('timeupdate', () => {
          const currentSecond = Math.floor(player.currentTime());
          if (currentSecond !== lastReportedSecond) {
            lastReportedSecond = currentSecond;
            onTimeUpdate(currentSecond);
          }
        });
        player.on('ready', () => console.log('播放器准备就绪'));

        // 使用本地 HTTP 范围流式加载视频
        const videoUrl = await window.electronAPI.getVideoHttpUrl(finalVideoPath);
        player.src({ src: videoUrl, type: 'video/mp4' });
        player.play().catch(e => console.error('【渲染进程】播放失败:', e));

        // 添加外挂字幕：根据传入的 parsedSubtitles prop
        if (subtitles && subtitles.length > 0) {
          // 清除现有的外挂字幕轨道和 cue
          const tracks = player.textTracks();
          for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i];
            if (t.label === '外挂字幕') {
              t.mode = 'disabled';
              if (t.cues) {
                while (t.cues.length) {
                  t.removeCue(t.cues[0]);
                }
              }
            }
          }
          // 添加新的外挂字幕轨道
          const extTrack = player.addTextTrack('subtitles', '外挂字幕', 'zh');
          extTrack.mode = 'showing';
          subtitles.forEach(({ start, end, text }) => {
            try {
              const cue = new window.VTTCue(start, end, text);
              extTrack.addCue(cue);
            } catch (err) {
              console.error('添加字幕 cue 失败:', err);
            }
          });
          // 监听字幕变化
          extTrack.on('cuechange', () => {
            const active = extTrack.activeCues;
            if (active && active.length) {
              onSubtitleSelect(active[0].text);
            }
          });
        }

      } catch (e) {
        console.error('【渲染进程】加载视频出错:', e);
      }
    })();

    return () => {
      canceled = true;
      if (playerRef.current) cleanupPlayer();
    };
  }, [videoPath, onTimeUpdate, onSubtitleSelect, videoRef, cleanupPlayer, handleVideoConversion, loadSubtitle, subtitles]);

  return (
    <div 
      className="video-container"
      style={{ 
        width: '100%', 
        height: '100%',
        minHeight: '300px',
        backgroundColor: '#000',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {isConverting && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#fff',
          textAlign: 'center',
          zIndex: 1000
        }}>
          <div>正在转换视频格式...</div>
          <div>{Math.round(conversionProgress)}%</div>
        </div>
      )}
      <div 
        // key={videoPath} // Removed: Component-level key is sufficient
        data-vjs-player 
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      >
        <video
          crossOrigin="anonymous"
          ref={videoRef}
          className="video-js vjs-big-play-centered"
          controls
          preload="auto"
          playsInline
          style={{ width: '100%', height: '100%' }}
          // data-setup="{}" // Removed: Manual initialization is used
        >
          <p className="vjs-no-js">
            请启用JavaScript以查看此视频
          </p>
        </video>
      </div>
      {activeSubtitleText && (
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '4px',
            maxWidth: '80%',
            textAlign: 'center',
            zIndex: 1000
          }}
        >
          {activeSubtitleText}
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.videoPath === nextProps.videoPath &&
         prevProps.videoRef === nextProps.videoRef;
});

export default VideoPlayer;