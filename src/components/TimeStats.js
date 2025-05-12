import React from 'react';
import { Box, Paper, Typography, Grid } from '@mui/material';
import { 
  AccessTime, 
  AvTimer, 
  LocationSearching 
} from '@mui/icons-material';

const TimeStats = ({ totalTime, sessionTime }) => {
  // 格式化时间为小时:分钟，精确到分钟
  const formatTime = (seconds) => {
    const totalMinutes = Math.floor((seconds || 0) / 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0')
    ].join(':');
  };
  
  // 计算距离1000小时还剩余的秒数
  const remainingSeconds = Math.max(0, 1000 * 3600 - totalTime);

  return (
    <Paper elevation={0} sx={{ p: 1, mb: 1, bgcolor: 'background.paper' }}>
      <Grid container spacing={1} sx={{ mt: 1 }}>
        <Grid item xs={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            <AccessTime color="primary" fontSize="small" />
            <Typography variant="caption">total time</Typography>
            <Typography variant="body2" color="primary">{formatTime(totalTime)}</Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            <AvTimer color="secondary" fontSize="small" />
            <Typography variant="caption">today</Typography>
            <Typography variant="body2" color="secondary">{formatTime(sessionTime)}</Typography>
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            <LocationSearching color="info" fontSize="small" />
            <Typography variant="caption">remaining(1000h)</Typography>
            <Typography variant="body2" color="info.main">{formatTime(remainingSeconds)}</Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default TimeStats; 