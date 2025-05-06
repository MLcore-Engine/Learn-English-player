import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const VideoPlayer = ({ videoPath, onTimeUpdate, onSubtitleSelect }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    let canceled = false;
    console.log('【渲染进程】VideoPlayer 组件挂载或更新，videoPath:', videoPath);
    (async () => {
      if (!videoPath) return;
      console.log('【渲染进程】开始加载视频:', videoPath);
      try {
        const buffer = await window.electronAPI.invoke('readVideo', videoPath);
        console.log('【渲染进程】视频数据读取成功，大小:', buffer.length, '字节');
        const blob = new Blob([buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        console.log('【渲染进程】创建 Blob URL:', url);

        // 确保DOM元素已挂载
        if (canceled || !videoRef.current) {
          console.error('【渲染进程】视频元素未找到或组件已卸载');
          return;
        }

        console.log('【渲染进程】初始化 Video.js 播放器');
        // 使用更清晰的配置
        const options = {
          fluid: true,
          autoplay: true,
          controls: true,
          preload: 'auto',
          width: '100%',
          height: '100%',
          responsive: true
        };
        
        // 先尝试清理任何现有实例
        if (playerRef.current) {
          console.log('【渲染进程】清理已存在的播放器实例');
          playerRef.current.dispose();
          playerRef.current = null;
        }
        
        // 创建新播放器实例
        const player = videojs(videoRef.current, options);
        playerRef.current = player;
        
        // 配置源
        player.src({ src: url, type: 'video/mp4' });
        console.log('【渲染进程】设置播放器源:', url);

        // 监听事件
        player.on('timeupdate', () => {
          onTimeUpdate(player.currentTime());
        });
        
        player.on('ready', () => {
          console.log('【渲染进程】播放器准备就绪');
        });

        player.on('loadeddata', () => {
          console.log('【渲染进程】视频数据已加载，尝试播放');
          player.play().catch(e => console.error('【渲染进程】播放失败:', e));
        });

        player.on('error', (e) => {
          console.error('【渲染进程】Video.js错误:', player.error(), e);
        });

        // 加字幕轨道并监听选中
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
      if (playerRef.current) {
        const srcs = playerRef.current.currentSources();
        if (srcs[0]?.src.startsWith('blob:')) {
          URL.revokeObjectURL(srcs[0].src);
          console.log('【渲染进程】撤销 Blob URL:', srcs[0].src);
        }
        playerRef.current.dispose();
        playerRef.current = null;
        console.log('【渲染进程】销毁 Video.js 播放器');
      }
      console.log('【渲染进程】VideoPlayer 组件卸载');
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