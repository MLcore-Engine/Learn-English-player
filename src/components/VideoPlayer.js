import React, { useLayoutEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const VideoPlayer = ({ videoPath, onTimeUpdate, onSubtitleSelect, videoRef }) => {
  const playerRef = useRef(null);

  useLayoutEffect(() => {
    let canceled = false;
    if (!videoPath) return;
    (async () => {
      try {
        let videoSrcUrl = `file://${videoPath}`;
        const currentPlatform = window.electronAPI.platform; 
        if (currentPlatform === 'win32' && /^[a-zA-Z]:\\/.test(videoPath)) {
          videoSrcUrl = `file:///${videoPath.replace(/\\/g, '/')}`;
        }
        const videoEl = videoRef.current;
        videoEl.addEventListener('loadedmetadata', () => {
          // 原生 video loadedmetadata 事件
        });
        videoEl.addEventListener('canplay', () => { /* 原生 video canplay 事件 */ });
        videoEl.addEventListener('canplaythrough', () => { /* 原生 video canplaythrough 事件 */ });
        videoEl.addEventListener('error', (e) => console.error('[DEBUG] 原生 video element error', videoEl.error, e));
        if (canceled) {
          return;
        }
        if (!videoRef.current) {
          console.error('【渲染进程】视频元素未找到，无法初始化播放器');
          return;
        }
        const options = {
          fluid: true,
          autoplay: true,
          controls: true,
          preload: 'auto',
          width: '100%',
          height: '100%',
          responsive: true
        };
        
        if (playerRef.current) {
          playerRef.current.dispose();
          playerRef.current = null;
        }
        
        await new Promise(resolve => requestAnimationFrame(resolve));
        const player = videojs(videoRef.current, options);
        playerRef.current = player;
        
        player.src({ src: videoSrcUrl, type: 'video/mp4' });
        // 节流：仅当秒数变化时才调用 onTimeUpdate，避免高频触发
        let lastReportedSecond = -1;
        player.on('timeupdate', () => {
          const currentSecond = Math.floor(player.currentTime());
          if (currentSecond !== lastReportedSecond) {
            lastReportedSecond = currentSecond;
            onTimeUpdate(currentSecond);
          }
        });
        
        player.on('ready', () => { /* 播放器准备就绪 */ });
        player.on('loadeddata', () => {
          player.play().catch(e => console.error('【渲染进程】播放失败:', e));
        });
        player.on('error', (e) => {
          console.error('【渲染进程】Video.js错误:', player.error(), e);
        });
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

    return () => { // 组件卸载时清理
      canceled = true;
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [videoPath, onTimeUpdate, onSubtitleSelect]);

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
        key={videoPath}
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
          ref={videoRef}
          className="video-js vjs-big-play-centered vjs-fluid"
          controls
          preload="auto"
          playsInline
          style={{ width: '100%', height: '100%' }}
          data-setup="{}"
        >
          <p className="vjs-no-js">
            请启用JavaScript以查看此视频
          </p>
        </video>
      </div>
    </div>
  );
};

export default VideoPlayer;