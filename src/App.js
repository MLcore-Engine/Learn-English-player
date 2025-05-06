import React, { useState, useEffect } from 'react';
import VideoPlayer from './components/VideoPlayer';
import 'video.js/dist/video-js.css';
import LearningAssistant from './components/LearningAssistant';

function App() {
  const [videoPath, setVideoPath] = useState(null);

  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanup = window.electronAPI.on('videoSelectedFromMenu', ({ success, path }) => {
      if (success) setVideoPath(path);
    });
    return () => cleanup && cleanup();
  }, []);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <div style={{ flex: 1, backgroundColor: '#000' }}>
        {videoPath ? (
          <VideoPlayer
            videoPath={videoPath}
            onTimeUpdate={() => {}}
            onSubtitleSelect={() => {}}
          />
        ) : (
          <div style={{ color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <strong>文件 &gt; 打开视频</strong>
          </div>
        )}
      </div>
      <div style={{ width: 360, borderLeft: '1px solid #444', backgroundColor: '#111', color: '#fff', display: 'flex', flexDirection: 'column' }}>
        <LearningAssistant
          selectedText=""
          explanation=""
          learningRecords={[]}
          isLoading={false}
          onQueryExplanation={() => {}}
        />
      </div>
    </div>
  );
}

export default App;

