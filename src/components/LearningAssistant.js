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
  IconButton
} from '@mui/material';
import { Send, ContentCopy } from '@mui/icons-material';

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
  
  // 保存/取消保存项目
  // const handleToggleSaveItem = (item) => {
  //   const itemExists = savedItems.some(saved => saved.text === item.text);
    
  //   if (itemExists) {
  //     setSavedItems(savedItems.filter(saved => saved.text !== item.text));
  //   } else {
  //     setSavedItems([...savedItems, item]);
  //   }
  // };
  
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
      
      {/* 选项卡 */}
      {/* <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="fullWidth"
        >
          <Tab label="对话" />
        </Tabs>
      </Box> */}
      
      {/* 选项卡面板容器 */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* 对话面板 */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2, display: 'flex', flexDirection: 'column' }}>
            {chatHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center">
                选择字幕文本或输入问题开始对话
              </Typography>
            ) : (
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
    </Card>
  );
}, (prevProps, nextProps) => {
  // 只有当关键props变化时才重新渲染
  return prevProps.selectedText === nextProps.selectedText &&
         prevProps.explanation === nextProps.explanation &&
         prevProps.isLoading === nextProps.isLoading;
  // 注意：不比较onQueryExplanation，因为它应该是一个稳定的回调函数
});

export default LearningAssistant; 