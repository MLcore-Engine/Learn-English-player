import React, { useLayoutEffect, useRef, useEffect } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { useVideo } from '../contexts/AppContext'; // Import useVideo
import ExternalSubtitleDisplay from './ExternalSubtitleDisplay'; // Import ExternalSubtitleDisplay

/**
 * 视频播放器组件
 * 负责视频的播放和控制
 */
const VideoPlayer = React.memo(({ videoPath, onTimeUpdate, onSubtitleSelect, videoRef }) => {
  const playerRef = useRef(null);
  const { externalSubtitles, currentTime } = useVideo(); // Get data from context

  // 清理播放器实例的函数
  const cleanupPlayer = () => {
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
  };

  // 监听 videoPath 变化
  useEffect(() => {
    // 当 videoPath 改变时，清理旧的播放器实例
    // cleanupPlayer(); // No longer needed due to component remounting via key
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
        // let lastReportedSecond = -1; // No longer needed for per-second update
        player.on('timeupdate', () => {
          // const currentSecond = Math.floor(player.currentTime()); // Before
          // if (currentSecond !== lastReportedSecond) { // Before
            // lastReportedSecond = currentSecond; // Before
            onTimeUpdate(player.currentTime()); // Update with more precise time
          // } // Before
        });
        player.on('ready', () => console.log('播放器准备就绪'));

        // 使用本地 HTTP 范围流式加载视频
        const videoUrl = await window.electronAPI.getVideoHttpUrl(videoPath);
        player.src({ src: videoUrl, type: 'video/mp4' });
        player.play().catch(e => console.error('【渲染进程】播放失败:', e));

        // 字幕轨道处理
        const tracks = player.textTracks();
        for (let i = 0; i < tracks.length; i++) {
          const t = tracks[i];
          t.mode = 'showing';
          t.on('cuechange', () => {
            const cues = t.activeCues;
            if (cues.length) onSubtitleSelect(cues[0].text);
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
  }, [videoPath, onTimeUpdate, onSubtitleSelect, videoRef]);

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
      <div
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
        >
          <p className="vjs-no-js">
            请启用JavaScript以查看此视频
          </p>
        </video>
      </div>
      {externalSubtitles && externalSubtitles.length > 0 && (
        <ExternalSubtitleDisplay subtitles={externalSubtitles} currentTime={currentTime} />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // We need to re-render if videoPath changes OR if the videoRef instance changes.
  // Other props like onTimeUpdate, onSubtitleSelect are functions passed from App.js/MainLayout.js
  // and should be stable if wrapped in useCallback there.
  // Context changes (externalSubtitles, currentTime) will trigger re-render via useVideo hook.
  return prevProps.videoPath === nextProps.videoPath &&
         prevProps.videoRef === nextProps.videoRef; // Keep existing memo conditions
});

export default VideoPlayer;