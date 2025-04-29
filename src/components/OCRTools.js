import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  TextField,
  List,
  ListItem,
  ListItemText,
  Paper,
  IconButton,
  Divider
} from '@mui/material';
import {
  ContentCopy,
  Description,
  PhotoCamera,
  ImageSearch,
  Settings
} from '@mui/icons-material';
import ocrService from '../utils/ocrService';

const electron = window.require ? window.require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

/**
 * OCR工具组件
 */
const OCRTools = ({ videoPath, currentTime, onOCRResult }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [modelPath, setModelPath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // 初始化OCR模型
  const initOCRModel = async () => {
    if (!modelPath) {
      setError('请先选择OCR模型文件');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      // 先通过主进程验证模型文件
      const response = await ipcRenderer.invoke('initOCRModel', { modelPath });
      
      if (response.success) {
        // 在渲染进程中初始化模型
        const success = await ocrService.initialize(modelPath);
        setIsInitialized(success);
        if (success) {
          setShowSettings(false);
        } else {
          setError('初始化OCR模型失败');
        }
      } else {
        setError(response.error || '初始化OCR模型失败');
      }
    } catch (error) {
      console.error('初始化OCR模型出错:', error);
      setError(`初始化错误: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 从当前视频帧识别文本
  const recognizeFromCurrentFrame = async () => {
    if (!isInitialized) {
      setError('OCR模型尚未初始化');
      return;
    }
    
    if (!videoPath) {
      setError('未加载视频');
      return;
    }
    
    setIsProcessing(true);
    setError('');
    
    try {
      // 先通过主进程验证视频文件
      const response = await ipcRenderer.invoke('extractVideoFrame', { 
        videoPath, 
        timestamp: currentTime 
      });
      
      if (response.success) {
        // 在渲染进程中执行OCR
        const text = await ocrService.recognizeFromVideoFrame(videoPath, currentTime);
        setRecognizedText(text);
        
        // 回调上传识别结果
        if (onOCRResult) {
          onOCRResult(text);
        }
      } else {
        setError(response.error || '提取视频帧失败');
      }
    } catch (error) {
      console.error('OCR识别出错:', error);
      setError(`识别错误: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // 选择OCR模型文件
  const selectModelFile = async () => {
    if (!ipcRenderer) return;
    
    try {
      const result = await ipcRenderer.invoke('dialog:openFile', { 
        title: '选择OCR模型文件',
        filters: [{ name: 'ONNX模型', extensions: ['onnx'] }],
        properties: ['openFile']
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        setModelPath(result.filePaths[0]);
      }
    } catch (error) {
      console.error('选择模型文件出错:', error);
      setError(`选择模型文件错误: ${error.message}`);
    }
  };
  
  // 复制识别文本到剪贴板
  const copyToClipboard = () => {
    if (recognizedText) {
      navigator.clipboard.writeText(recognizedText)
        .then(() => console.log('文本已复制到剪贴板'))
        .catch(err => console.error('复制失败:', err));
    }
  };
  
  return (
    <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">OCR文本识别</Typography>
        <IconButton onClick={() => setShowSettings(true)} color="primary">
          <Settings />
        </IconButton>
      </Box>
      
      {isInitialized ? (
        <Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ImageSearch />}
            onClick={recognizeFromCurrentFrame}
            disabled={isProcessing || !videoPath}
            fullWidth
            sx={{ mb: 2 }}
          >
            {isProcessing ? '处理中...' : '识别当前帧文本'}
          </Button>
          
          <Divider sx={{ my: 2 }} />
          
          {isProcessing ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              <Typography>正在识别中...</Typography>
            </Box>
          ) : (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">识别结果:</Typography>
                {recognizedText && (
                  <IconButton size="small" onClick={copyToClipboard}>
                    <ContentCopy fontSize="small" />
                  </IconButton>
                )}
              </Box>
              
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  minHeight: '100px', 
                  maxHeight: '200px',
                  overflow: 'auto',
                  bgcolor: 'background.paper'
                }}
              >
                {recognizedText ? (
                  <Typography>{recognizedText}</Typography>
                ) : (
                  <Typography color="text.secondary" align="center">
                    尚未识别文本
                  </Typography>
                )}
              </Paper>
              
              {error && (
                <Typography color="error" sx={{ mt: 1 }}>
                  {error}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            OCR模型尚未初始化
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setShowSettings(true)}
          >
            初始化OCR模型
          </Button>
        </Box>
      )}
      
      {/* 设置对话框 */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)}>
        <DialogTitle>OCR模型设置</DialogTitle>
        <DialogContent>
          <Box sx={{ minWidth: '400px' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              模型文件路径
            </Typography>
            <Box sx={{ display: 'flex', mb: 3 }}>
              <TextField
                fullWidth
                size="small"
                value={modelPath}
                onChange={(e) => setModelPath(e.target.value)}
                placeholder="选择ONNX格式OCR模型文件"
                disabled={isProcessing}
              />
              <Button 
                variant="outlined"
                onClick={selectModelFile}
                sx={{ ml: 1 }}
                disabled={isProcessing}
              >
                浏览
              </Button>
            </Box>
            
            {error && (
              <Typography color="error" sx={{ mb: 2 }}>
                {error}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)} disabled={isProcessing}>
            取消
          </Button>
          <Button 
            onClick={initOCRModel}
            variant="contained" 
            color="primary"
            disabled={isProcessing || !modelPath}
          >
            {isProcessing ? (
              <CircularProgress size={24} sx={{ mr: 1 }} />
            ) : (
              '初始化模型'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default OCRTools; 