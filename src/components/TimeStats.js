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

const TimeStats = ({ totalTime, sessionTime, compact = false }) => {
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
  
  // 计算距离1000小时还剩余的秒数
  const remainingSeconds = Math.max(0, 1000 * 3600 - totalTime);

  // 根据compact模式调整样式
  const padding = compact ? 1 : 2;
  const mb = compact ? 1 : 2;
  const labelVariant = compact ? 'subtitle2' : 'subtitle1';
  const valueVariant = compact ? 'body1' : 'h5';
  const iconSize = compact ? 'small' : 'default';
  const gridSpacing = compact ? 1 : 3;
  return (
    <Paper
      elevation={compact ? 0 : 3}
      sx={{
        p: padding,
        mb: mb,
        bgcolor: 'background.paper'
      }}
    >
      <Typography variant={compact ? 'subtitle2' : 'h6'} gutterBottom sx={{ fontSize: compact ? '0.875rem' : '1.25rem' }}>
        观看时长统计
      </Typography>
      
      <Grid container spacing={gridSpacing} sx={{ mt: 1 }}>
        <Grid item xs={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <AccessTime color="primary" fontSize={iconSize} sx={{ mr: 1 }} />
              <Typography variant={labelVariant}>总观看时长</Typography>
            </Box>
            <Typography variant={valueVariant} color="primary">
              {formatTime(totalTime)}
            </Typography>
          </Box>
        </Grid>
        
        { !compact && <Divider orientation="vertical" flexItem /> }
        <Grid item xs={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <AvTimer color="secondary" fontSize={iconSize} sx={{ mr: 1 }} />
              <Typography variant={labelVariant}>当日观看时长</Typography>
            </Box>
            <Typography variant={valueVariant} color="secondary">
              {formatTime(sessionTime)}
            </Typography>
          </Box>
        </Grid>
        
        { !compact && <Divider orientation="vertical" flexItem /> }
        { !compact && (
        <Grid item xs={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <LocationSearching color="info" fontSize={iconSize} sx={{ mr: 1 }} />
              <Typography variant={labelVariant}>距离1000小时还剩</Typography>
            </Box>
            <Typography variant={valueVariant} color="info.main">
              {formatTime(remainingSeconds)}
            </Typography>
          </Box>
        </Grid>
        )}
      </Grid>
    </Paper>
  );
};

export default TimeStats; 