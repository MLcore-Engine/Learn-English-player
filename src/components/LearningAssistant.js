import React, { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  TextField,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Tab,
  Tabs,
  IconButton,
  Stack
} from '@mui/material';
import { Send, ContentCopy, History, Summarize } from '@mui/icons-material';

const clean = (raw) => raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

// 选项卡内容组件
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`assistant-tabpanel-${index}`}
      aria-labelledby={`assistant-tab-${index}`}
      style={{ display: value === index ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

/**
 * 学习助手组件
 * 显示AI解释内容和学习记录
 */
const LearningAssistant = React.memo(({ 
  selectedText, 
  explanation, 
  onQueryExplanation,
  isLoading
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // 处理选项卡切换
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // 处理用户输入发送
  const handleSendMessage = () => {
    if (!userInput.trim()) return;
    
    // 添加用户消息到历史
    const newHistory = [...chatHistory, { type: 'user', text: userInput }];
    setChatHistory(newHistory);
    
    // 发送查询
    onQueryExplanation(userInput);
    
    // 清空输入框
    setUserInput('');
  };
  
  // 处理键盘输入
  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };
  
  // 复制文本到剪贴板
  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
  };

  // 切换历史记录显示
  const handleToggleHistory = () => {
    setShowHistory(!showHistory);
  };

  // 处理今日总结
  const handleSummarize = () => {
    // TODO: 实现今日总结功能
    console.log('生成今日总结');
  };
  
  // 当收到新的解释时，添加到聊天历史
  React.useEffect(() => {
    if (explanation && selectedText) {
      // 只有当解释不是聊天历史中的最后一条消息时才添加
      if (chatHistory.length === 0 || 
          chatHistory[chatHistory.length - 1].text !== explanation) {
        setChatHistory([
          ...chatHistory, 
          { 
            type: 'assistant', 
            text: explanation, 
            query: selectedText 
          }
        ]);
      }
    }
  }, [explanation, selectedText, chatHistory]);
  
  return (
    <Card sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* 选项卡面板容器 */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* 对话面板 */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2, display: 'flex', flexDirection: 'column' }}>
            {!showHistory ? (
              // 当前对话显示
              explanation ? (
                <Box sx={{ p: 2 }}>
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ whiteSpace: 'pre-wrap' }}
                    dangerouslySetInnerHTML={{
                      __html: clean(explanation)
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br/>')
                    }}
                  />
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleCopyText(clean(explanation))}
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" align="center">
                  选择字幕文本或输入问题开始对话
                </Typography>
              )
            ) : (
              // 历史记录显示
              <List>
                {chatHistory.map((message, index) => (
                  <ListItem 
                    key={index} 
                    alignItems="flex-start"
                    sx={{ 
                      backgroundColor: message.type === 'user' ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="subtitle2">
                          {message.type === 'user' ? '你' : '助手'}
                          {message.query && ` (关于: "${message.query}")`}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Typography
                            variant="body2"
                            component="div"
                            sx={{ whiteSpace: 'pre-wrap' }}
                            dangerouslySetInnerHTML={{
                              __html: clean(message.text)
                                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                .replace(/\n/g, '<br/>')
                            }}
                          />
                          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            <IconButton 
                              size="small" 
                              onClick={() => handleCopyText(clean(message.text))}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </TabPanel>
      </Box>

      {/* 底部按钮区域 */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button
            variant="outlined"
            startIcon={<History />}
            onClick={handleToggleHistory}
            size="small"
          >
            {showHistory ? '返回对话' : '查看记录'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<Summarize />}
            onClick={handleSummarize}
            size="small"
          >
            今日总结
          </Button>
        </Stack>
      </Box>
    </Card>
  );
}, (prevProps, nextProps) => {
  // 只有当关键props变化时才重新渲染
  return prevProps.selectedText === nextProps.selectedText &&
         prevProps.explanation === nextProps.explanation &&
         prevProps.isLoading === nextProps.isLoading;
});

export default LearningAssistant; 

