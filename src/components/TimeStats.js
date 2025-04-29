import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  Divider 
} from '@mui/material';
import { 
  AccessTime, 
  AvTimer, 
  LocationSearching 
} from '@mui/icons-material';

const TimeStats = ({ totalTime, sessionTime, currentPosition }) => {
  // 格式化时间为小时:分钟:秒
  const formatTime = (seconds) => {
    if (!seconds) return '00:00:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };
  
  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 2, 
        mb: 2, 
        bgcolor: 'background.paper' 
      }}
    >
      <Typography variant="h6" gutterBottom>
        观看时长统计
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <AccessTime color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1">总观看时长</Typography>
            </Box>
            <Typography variant="h5" color="primary">
              {formatTime(totalTime)}
            </Typography>
          </Box>
        </Grid>
        
        <Divider orientation="vertical" flexItem />
        
        <Grid item xs={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <AvTimer color="secondary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1">本次时长</Typography>
            </Box>
            <Typography variant="h5" color="secondary">
              {formatTime(sessionTime)}
            </Typography>
          </Box>
        </Grid>
        
        <Divider orientation="vertical" flexItem />
        
        <Grid item xs={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <LocationSearching color="info" sx={{ mr: 1 }} />
              <Typography variant="subtitle1">当前进度</Typography>
            </Box>
            <Typography variant="h5" color="info.main">
              {formatTime(currentPosition)}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default TimeStats; 