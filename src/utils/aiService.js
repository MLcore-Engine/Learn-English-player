import axios from 'axios';

// 默认AI服务配置 
const defaultConfig = {
  apiKey: process.env.REACT_APP_OPENAI_API_KEY || '',
  apiUrl: process.env.REACT_APP_OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
  model: process.env.REACT_APP_OPENAI_MODEL || 'gpt-3.5-turbo'
};

/**
 * AI服务类 - 负责与大语言模型API通信
 */
class AIService {
  constructor(config = {}) {
    this.config = { ...defaultConfig, ...config };
    this.context = []; // 存储对话上下文
  }
  
  /**
   * 设置API密钥
   * @param {string} apiKey - API密钥
   */
  setApiKey(apiKey) {
    this.config.apiKey = apiKey;
  }
  
  /**
   * 设置模型
   * @param {string} model - 模型名称
   */
  setModel(model) {
    this.config.model = model;
  }
  
  /**
   * 清空对话上下文
   */
  clearContext() {
    this.context = [];
  }
  
  /**
   * 添加上下文消息
   * @param {string} role - 角色 (system/user/assistant)
   * @param {string} content - 消息内容
   */
  addContextMessage(role, content) {
    this.context.push({ role, content });
    
    // 保持上下文在合理大小
    if (this.context.length > 10) {
      // 保留系统消息和最近的消息
      const systemMessages = this.context.filter(msg => msg.role === 'system');
      const recentMessages = this.context.slice(-8).filter(msg => msg.role !== 'system');
      this.context = [...systemMessages, ...recentMessages];
    }
  }
  
  /**
   * 查询解释
   * @param {string} text - 需要解释的文本
   * @param {object} options - 配置选项
   * @returns {Promise<string>} 解释结果
   */
  async getExplanation(text, options = {}) {
    try {
      // 添加系统消息来设置任务
      if (this.context.length === 0) {
        this.addContextMessage('system', '你是一个语言学习助手。请对提供的文本进行解释，包括词汇解析、语法分析和上下文含义。回答要简明扼要。');
      }
      
      // 添加用户问题到上下文
      this.addContextMessage('user', text);
      
      // 准备请求数据
      const requestData = {
        model: options.model || this.config.model,
        messages: this.context,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 500
      };
      
      // 发送请求
      const response = await axios.post(
        this.config.apiUrl,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
          }
        }
      );
      
      // 提取回复内容
      const result = response.data.choices[0].message.content;
      
      // 将助手回复添加到上下文
      this.addContextMessage('assistant', result);
      
      return result;
    } catch (error) {
      console.error('AI服务请求失败:', error);
      throw new Error(`请求AI解释失败: ${error.message}`);
    }
  }
  
  /**
   * 模拟解释（用于开发/测试）
   * @param {string} text - 需要解释的文本
   * @returns {Promise<string>} 模拟的解释结果
   */
  async getMockExplanation(text) {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 简单的模拟回复
    if (text.length < 5) {
      return `"${text}" 可能是一个简短的单词或短语。需要更多上下文才能提供准确解释。`;
    } else {
      return `"${text}" 的解释:\n\n这是一段文本，在实际应用中会由AI模型生成解释。当前使用模拟数据进行展示。`;
    }
  }
}

// 创建并导出单例实例
const aiService = new AIService();
export default aiService; 