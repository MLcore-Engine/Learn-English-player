import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Stack
} from '@mui/material';
import { ContentCopy, History, Summarize } from '@mui/icons-material';

// 清理文本中的特殊标记
const clean = (raw) => raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

// 选项卡内容组件
// function TabPanel(props) {
//   const { children, value, index, ...other } = props;

//   return (
//     <div
//       role="tabpanel"
//       hidden={value !== index}
//       id={`assistant-tabpanel-${index}`}
//       aria-labelledby={`assistant-tab-${index}`}
//       style={{ display: value === index ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
//       {...other}
//     >
//       {value === index && (
//         <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
//           {children}
//         </Box>
//       )}
//     </div>
//   );
// }

/**
 * 学习助手组件
 * 显示AI解释内容和学习记录
 */
const LearningAssistant = React.memo(({ 
  selectedText, 
  explanation
}) => {
  // 状态管理
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

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
  useEffect(() => {
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

  // 渲染当前对话内容
  const renderCurrentDialogue = () => {
    if (!explanation) {
      return (
        <Typography variant="body2" color="text.secondary" align="center">
          选择字幕文本或输入问题开始对话
        </Typography>
      );
    }

    return (
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
    );
  };

  // 渲染历史记录列表
  const renderHistory = () => (
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
  );

  return (
    <Card sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* 主要内容区域 */}
      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto', 
        mb: 2, 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        {showHistory ? renderHistory() : renderCurrentDialogue()}
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
  return prevProps.selectedText === nextProps.selectedText &&
         prevProps.explanation === nextProps.explanation &&
         prevProps.isLoading === nextProps.isLoading;
});

export default LearningAssistant; 

