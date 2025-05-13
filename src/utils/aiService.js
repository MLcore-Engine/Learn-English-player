import axios from 'axios';

// 默认AI服务配置 
const defaultConfig = {
  apiKey: process.env.REACT_APP_AI_API_KEY || '',
  apiUrl: process.env.REACT_APP_AI_API_URL || 'http://58.211.207.202:20000/api/chat',
  model: process.env.REACT_APP_AI_MODEL || 'qwen3:32b'
};

// 新增系统提示
const SYSTEM_PROMPT_ZH = `You are an expert in American English.

If I give you a word, then please follow this format when you respond:

1. "**{Word}**  **{KK phonetic transcription}**  **{Part of Speech}**  **{Meaning(s)}**"

   - 例如: 
     
     “nucleus”  /ˈnukliəs/   n.  “原子核”“核心” 
     

2. 一个简单的英文例句和相应的中文翻译。

   - 例如:
     
     The nucleus is at the center of the atom.（原子核在原子的中心。）
     

3. 该单词的常用或更通俗的近义词（尤其是形容词时），方便在日常口语中扩充词汇。

   - 例如:
     
     它的常见同义词有 “core”“kernel” 等。
     

4. 扩展的文化、语言或学术背景知识，帮助我理解该单词在美式英语中的地位或常见用法。

   - 例如:
     
     在科学领域尤其是物理学和化学中，“nucleus” 是非常重要的概念。在日常英语中，也会用 “the nucleus of a group” 等来表示一个群体的核心部分。
     

请务必使用 **KK 音标**（Kenyon & Knott），并确保与标准美式英语一致。不要使用 IPA 或其他音标格式。

如果我给你一个句子时，请执行以下操作：
1. 将句子译为中文。
2. 分析其语法结构，指出常用或核心词汇（如在 IELTS 或常见学术词汇中出现）。
3. 提供每个单词的含义、词性、及其 **KK 音标**。
4. 如有文化或习语相关的背景，也请一并说明。

再次提醒：在给出音标时，请使用 **KK 音标**  ** (e.g., /i, ɪ, e, ɛ, æ, ʌ, ə, u, ʊ, o, ɔ, ɑ, aɪ, aʊ, ɔɪ, ju, ɚ, ɝ, p, b, t, d, k, g, f, v, θ, ð, s, z, ʃ, ʒ, tʃ, dʒ, m, n, ŋ, l, r, j, w, h/** etc.). 并将其使用反引号或代码块包裹，以便我能轻松复制和查看。

以上就是我的全部要求，请按照这些说明来回答我的问题。`;

const SYSTEM_PROMPT_EN = `You are a professional American English expert. I will provide you with a single English word. Please respond entirely in American English and follow these updated guidelines:

1. KK Phonetic Transcription
Present the KK (Kenyon and Knott) phonetic transcription of the word. For example: \`[ˈbɛd]\`.
2. Part of Speech
Specify the word's part of speech (e.g., noun, verb, adjective, etc.). For example: Noun.
3. Simple Example Sentence
Provide a short, natural-sounding sentence in everyday American English that illustrates how the word is typically used. Keep the example very simple and practical for daily conversations. For example: "I love learning a new language every year."
4. Easy-to-Understand Explanation
Offer a clear, concise definition of the word in American English. Keep the explanation simple and accessible to non-native speakers, avoiding technical jargon or complex phrases.
5. Frequency in Everyday Speech
Indicate how often the word is used in daily American English conversations. Use a scale of 1 to 5, where:
1 = Rarely used in casual conversation.
5 = Very common in everyday speech.

Important:
When providing the phonetic transcription, please use KK phonetics (e.g., \`/i, ɪ, e, ɛ, æ, ʌ, ə, u, ʊ, o, ɔ, ɑ, aɪ, aʊ, ɔɪ, ju, ɚ, ɝ, p, b, t, d, k, g, f, v, θ, ð, s, z, ʃ, ʒ, tʃ, dʒ, m, n, ŋ, l, r, j, w, h/\`). Wrap it in backticks or a code block so that I can easily copy and view it.

Do not use Chinese.
Use only American English.
Make sure your explanation focuses on the word's usage and context in everyday, native-level American English.`;

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
      // 清空历史上下文并添加对应的系统提示
      this.clearContext();
      const systemPrompt = options.language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH;
      this.addContextMessage('system', systemPrompt);
      
      // 添加用户问题到上下文
      this.addContextMessage('user', text);
      
      // 构造符合自定义接口的请求体
      const requestData = {
        model: options.model || this.config.model,
        messages: this.context,
        stream: options.stream !== undefined ? options.stream : false
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
      
      // 提取回复内容，兼容不同返回格式
      const data = response.data;
      let result = '';
      if (data.message && data.message.content) {
        result = data.message.content;
      } else if (data.choices && data.choices[0] && data.choices[0].message) {
        result = data.choices[0].message.content;
      }
      
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