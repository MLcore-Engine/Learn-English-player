import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  IconButton
} from '@mui/material';
import { Send, ContentCopy, Bookmark, BookmarkBorder } from '@mui/icons-material';

// 选项卡内容组件
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`assistant-tabpanel-${index}`}
      aria-labelledby={`assistant-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const LearningAssistant = ({ 
  selectedText, 
  explanation, 
  learningRecords,
  onQueryExplanation
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  
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
  const handleToggleSaveItem = (item) => {
    const itemExists = savedItems.some(saved => saved.text === item.text);
    
    if (itemExists) {
      setSavedItems(savedItems.filter(saved => saved.text !== item.text));
    } else {
      setSavedItems([...savedItems, item]);
    }
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
  }, [explanation, selectedText]);
  
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: '0 0 auto' }}>
        <Typography variant="h5" gutterBottom>
          学习助手
        </Typography>
        <Divider />
      </CardContent>
      
      {/* 选项卡 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="fullWidth"
        >
          <Tab label="对话" />
          <Tab label="记录" />
          <Tab label="收藏" />
        </Tabs>
      </Box>
      
      {/* 对话面板 */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ height: '400px', overflow: 'auto', mb: 2 }}>
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
                        <Typography variant="body2" component="span">
                          {message.text}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          <IconButton 
                            size="small" 
                            onClick={() => handleCopyText(message.text)}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small"
                            onClick={() => handleToggleSaveItem(message)}
                          >
                            {savedItems.some(item => item.text === message.text) ? 
                              <Bookmark fontSize="small" /> : 
                              <BookmarkBorder fontSize="small" />
                            }
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
        
        {/* 输入区域 */}
        <Paper 
          elevation={3} 
          component="form" 
          sx={{ p: 1, display: 'flex', alignItems: 'center' }}
        >
          <TextField
            fullWidth
            variant="outlined"
            placeholder="问点什么..."
            size="small"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <Button 
            variant="contained" 
            color="primary" 
            endIcon={<Send />}
            onClick={handleSendMessage}
            sx={{ ml: 1 }}
          >
            发送
          </Button>
        </Paper>
      </TabPanel>
      
      {/* 历史记录面板 */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ height: '450px', overflow: 'auto' }}>
          {learningRecords.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center">
              暂无学习记录
            </Typography>
          ) : (
            <List>
              {learningRecords.map((record, index) => (
                <ListItem 
                  key={index} 
                  alignItems="flex-start"
                  divider
                >
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2">
                        {new Date(record.timestamp).toLocaleString()}
                      </Typography>
                    }
                    secondary={
                      <React.Fragment>
                        <Typography variant="body2" component="span" color="text.primary">
                          问题: {record.subtitle_text}
                        </Typography>
                        <Typography variant="body2" component="div" sx={{ mt: 1 }}>
                          解释: {record.explanation}
                        </Typography>
                      </React.Fragment>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </TabPanel>
      
      {/* 收藏面板 */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ height: '450px', overflow: 'auto' }}>
          {savedItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center">
              暂无收藏内容
            </Typography>
          ) : (
            <List>
              {savedItems.map((item, index) => (
                <ListItem 
                  key={index} 
                  alignItems="flex-start"
                  divider
                >
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2">
                        {item.query ? `关于: "${item.query}"` : '收藏内容'}
                      </Typography>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" component="span">
                          {item.text}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                          <IconButton 
                            size="small" 
                            onClick={() => handleCopyText(item.text)}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small"
                            onClick={() => handleToggleSaveItem(item)}
                          >
                            <Bookmark fontSize="small" />
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
    </Card>
  );
};

export default LearningAssistant; 