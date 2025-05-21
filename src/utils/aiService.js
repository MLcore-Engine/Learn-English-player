import axios from 'axios';

// 创建 axios 实例
const axiosInstance = axios.create({
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json'
  }
});

// 默认AI服务配置 
const defaultConfig = {
  apiKey: process.env.REACT_APP_AI_API_KEY || '',
  apiUrl: process.env.REACT_APP_AI_API_URL || 'http://58.211.207.202:20000/api/chat',
  model: process.env.REACT_APP_AI_MODEL || 'qwen2.5:72b'
};

// 新增系统提示
// const SYSTEM_PROMPT_ZH = `You are an expert in American English.

// If I give you a word, then please follow this format when you respond:

// 1. "**{Word}**  **{KK phonetic transcription}**  **{Part of Speech}**  **{Meaning(s)}**"

//    - 例如: 
     
//      "nucleus"  /ˈnukliəs/   n.  "原子核""核心" 
     

// 2. 一个简单的英文例句和相应的中文翻译。

//    - 例如:
     
//      The nucleus is at the center of the atom.（原子核在原子的中心。）
     

// 3. 该单词的常用或更通俗的近义词（尤其是形容词时），方便在日常口语中扩充词汇。

//    - 例如:
     
//      它的常见同义词有 "core""kernel" 等。
     

// 4. 扩展的文化、语言或学术背景知识，帮助我理解该单词在美式英语中的地位或常见用法。

//    - 例如:
     
//      在科学领域尤其是物理学和化学中，"nucleus" 是非常重要的概念。在日常英语中，也会用 "the nucleus of a group" 等来表示一个群体的核心部分。
     

// 请务必使用 **KK 音标**（Kenyon & Knott），并确保与标准美式英语一致。不要使用 IPA 或其他音标格式。

// 如果我给你一个句子时，请执行以下操作：
// 1. 将句子译为中文。
// 2. 分析其语法结构，指出常用或核心词汇（如在 IELTS 或常见学术词汇中出现）。
// 3. 提供每个单词的含义、词性、及其 **KK 音标**。
// 4. 如有文化或习语相关的背景，也请一并说明。

// 再次提醒：在给出音标时，请使用 **KK 音标**  ** (e.g., /i, ɪ, e, ɛ, æ, ʌ, ə, u, ʊ, o, ɔ, ɑ, aɪ, aʊ, ɔɪ, ju, ɚ, ɝ, p, b, t, d, k, g, f, v, θ, ð, s, z, ʃ, ʒ, tʃ, dʒ, m, n, ŋ, l, r, j, w, h/** etc.). 并将其使用反引号或代码块包裹，以便我能轻松复制和查看。

// 以上就是我的全部要求，请按照这些说明来回答我的问题。`;


// 主 prompt 内容
const SYSTEM_PROMPT_ZH = [
  "You are an expert in American English. Always use **KK phonetic transcription** for pronunciations, and ensure responses align with standard American English. Do not use IPA or other phonetic systems.",
  "",
  "**When given a word:**",
  "1. Provide the word, its KK phonetic transcription, part of speech, and meaning(s) in this format:",
  "   - **{Word}** `/KK transcription/` **{Part of Speech}** \"{Meaning(s)}\"",
  "   - Example: **nucleus** `/ˈnukliəs/` **n.** \"原子核\" \"核心\"",
  "",
  "2. Give a simple English sentence using the word, followed by its Chinese translation.",
  "   - Example: The nucleus is at the center of the atom. (原子核在原子的中心。)",
  "",
  "3. List common synonyms (especially for adjectives) to expand everyday vocabulary.",
  "   - Example: Common synonyms include \"core\" and \"kernel.\"",
  "",
  "4. Provide cultural, linguistic, or academic background to explain the word's usage or significance in American English.",
  "   - Example: In scientific fields like physics and chemistry, \"nucleus\" is a key term. In daily English, it can mean the core of a group, e.g., \"the nucleus of a team.\"",
  "",
  "**When given a sentence:**",
  "1. Translate the sentence into Chinese.",
  "2. Analyze its grammatical structure and identify key vocabulary (e.g., words common in IELTS or academic contexts).",
  "3. For each word in the sentence, provide:",
  "   - Meaning",
  "   - Part of speech",
  "   - KK phonetic transcription (e.g., `/i, ɪ, e, ɛ, æ, ʌ, ə, u, ʊ, o, ɔ, ɑ, aɪ, aʊ, ɔɪ, ju, ɚ, ɝ, p, b, t, d, k, g, f, v, θ, ð, s, z, ʃ, ʒ, tʃ, dʒ, m, n, ŋ, l, r, j, w, h/`)",
  "4. If applicable, explain cultural or idiomatic references in the sentence.",
  "",
  "**Important:**",
  "- Use KK phonetic transcription exclusively for pronunciations.",
  "- Enclose transcriptions in backticks or code blocks for easy copying.",
  "",
  "【Few-shot Examples】"
];

// few-shot 示例内容
const FEW_SHOT_EXAMPLES = [
  '1. **glimpse** `/ɡlɪmps/` **n.** 一瞥；一看；短暂的感受（或体验、领会）  **v.** 瞥见；看一眼；开始领悟到；开始认识到',
  '2. **example**：',
  '    - **n**：I caught a glimpse of her in the crowd.（我在人群中瞥见了她一眼。）',
  '    - **v**：She glimpsed a figure in the dark.（她在黑暗中瞥见一个身影。）',
  '3. **同义词**：',
  '    - **名词**：glance（匆匆一看，与"glimpse"都表示短暂地看，但"glance"可能更主动，"glimpse"更倾向于不经意看到），peek（偷偷地看一眼）',
  '    - **动词**："catch sight of"（看见，较为口语化，和"glimpse"作为"瞥见"意思相近）。',
  '4. **背景知识**：在美式英语中，"glimpse"常用来描述瞬间、短暂的视觉体验。这种瞬间的视觉捕捉在日常生活和文学作品中都很常见。在日常对话里，人们会用它来描述偶然看到的场景或人。在文学创作中，作者常用"glimpse"营造一种意外、瞬间的感觉，给读者留下深刻印象，以引发读者的好奇心或为故事发展埋下伏笔。',
  '',

  '1. **detailed** `/dɪˈteld/` **adj.（形容词）** "详细的；细致的；精细的"',
  '2. **example**：He gave a detailed description of the accident.（他对事故进行了详细的描述。）',
  '3. **常见同义词**：specific（具体的，强调明确、特定，与"detailed"侧重细节的意思相关），thorough（全面的、详尽的，同样表达对事物描述或处理的细致程度），elaborate（精心制作的、详尽阐述的，语义与"detailed"相近）。',
  '4. **背景知识**：在美式英语中，"detailed"广泛应用于各种场景。在商务场合，撰写报告时需要提供"detailed information"（详细信息），以确保决策基于充分的数据和事实；在学术写作中，研究成果的阐述要求"detailed analysis"（详细分析），展示研究的严谨性；日常交流中，当人们想要准确传达复杂信息时，也会追求描述得"detailed"。它体现了对信息完整性和精确性的重视。',
  '',
  
  '1. **bear** `/bɛr/`',
  '    - **v.**',
  '        - 忍受；忍耐',
  '        - 承担；负担',
  '        - 生育；生（孩子）',
  '        - 带有；显示',
  '        - 心怀（感情，尤指坏心情）',
  '        - 运输；运送',
  '    - **n.** 熊；（在证券市场等）卖空的人',
  '2. **example**：',
  '    - **v - 忍受**：I can\'t bear the noise.（我忍受不了这噪音）',
  '    - **v - 承担**：He has to bear the responsibility.（他必须承担责任）',
  '    - **v - 生育**：She bore a healthy baby last year.（她去年生了个健康的宝宝。）',
  '    - **v - 带有**：The document bears his signature.（文件上有他的签名。）',
  '    - **n**：We saw a bear in the forest.（我们在森林里看到了一只熊。）',
  '3. **同义词**：',
  '    - **v. - 忍受**：endure（更强调长时间忍受困难或痛苦，语气比"bear"强烈），tolerate（指以克制的态度忍受令人反感或厌恶的事物）。',
  '    - **v. - 承担**：shoulder（形象地表示像用肩膀承担重量一样承担责任等），take on（有承担、从事的意思，与"bear"承担义相近）。',
  '    - **n. - 熊**：无特别常用的同义词，"polar bear"（北极熊）、"grizzly bear"（灰熊）等是其不同种类的表述。',
  '4. **背景知识**：',
  '    - 在美式英语中，"bear"作为动词，"忍受"和"承担"的含义使用广泛。在日常生活里，人们常表达无法忍受某种情况或需要承担责任。"bear"表示"生育"时，过去式是"bore"，过去分词是"borne"（用于主动语态）或"born"（用于被动语态），这种用法相对正式，日常口语中"give birth to"更常用。'
];

// 合并主 prompt 和 few-shot 示例，并明确示例意图
const FINAL_SYSTEM_PROMPT_ZH = [
  // 基础系统提示
  ...SYSTEM_PROMPT_ZH,
  '',
  '以下是 few-shot 示例，演示期望的回答格式：',
  // few-shot 示例内容
  ...FEW_SHOT_EXAMPLES,
  '',
  '请严格按照以上示例格式和要求回答用户的提问。'
].join('\n');



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
      const systemPrompt = options.language === 'en' ? SYSTEM_PROMPT_EN : FINAL_SYSTEM_PROMPT_ZH;
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
      let data;
      // 如果在 Electron 环境下，可通过主进程发起请求，避免 CORS
      if (window.electronAPI && typeof window.electronAPI.performAIRequest === 'function') {
        const result = await window.electronAPI.performAIRequest(requestData, this.config.apiUrl, this.config.apiKey);
        if (!result.success) {
          throw new Error(result.error || '主进程 AI 请求失败');
        }
        data = result.data;
      } else {
        const response = await axiosInstance.post(
          this.config.apiUrl,
          requestData,
          { headers: { 'Authorization': `Bearer ${this.config.apiKey}` } }
        );
        data = response.data;
      }
      
      // 检查响应状态
      if (!data) {
        throw new Error('服务器返回空响应');
      }
      
      // 提取回复内容，兼容不同返回格式
      let result = '';
      if (data.message && data.message.content) {
        result = data.message.content;
      } else if (data.choices && data.choices[0] && data.choices[0].message) {
        result = data.choices[0].message.content;
      } else {
        throw new Error('无法解析服务器响应');
      }
      
      // 将助手回复添加到上下文
      this.addContextMessage('assistant', result);
      
      return result;
    } catch (error) {
      console.error('AI服务请求失败:', error);
      if (error.response) {
        // 服务器返回错误状态码
        throw new Error(`服务器错误: ${error.response.status} - ${error.response.data?.message || '未知错误'}`);
      } else if (error.request) {
        // 请求发送失败
        throw new Error('无法连接到服务器，请检查网络连接');
      } else {
        // 其他错误
        throw new Error(`请求失败: ${error.message}`);
      }
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