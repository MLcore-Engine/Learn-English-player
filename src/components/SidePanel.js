import React from 'react';
import TimeStats from './TimeStats';
import OCRContainer from '../containers/OCRContainer';
import AIContainer from '../containers/AIContainer';
import { useTimeStats } from '../contexts/AppContext';

/**
 * 侧边面板组件
 * 集成各个子容器组件
 */
const SidePanel = React.memo(() => {
  const { totalTime, sessionTime, remainingSeconds, formatTime } = useTimeStats();
  
  const timeStatsProps = {
    totalTime,
    sessionTime,
    remainingSeconds,
    formatTime
  };
  
  return (
    <div style={{ 
      width: 360, 
      borderLeft: '1px solid #444', 
      backgroundColor: '#111', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ 
        padding: '10px', 
        flexShrink: 0, 
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <OCRContainer />
        <TimeStats {...timeStatsProps} />
      </div>
      
      <div style={{ 
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <AIContainer />
      </div>
    </div>
  );
});

export default SidePanel; 