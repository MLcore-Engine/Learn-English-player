import * as SubtitleParser from 'subtitle';

/**
 * 字幕工具类 - 处理字幕文件的解析和操作
 */
class SubtitleService {
  /**
   * 解析SRT格式字幕
   * @param {string} content - 字幕文件内容
   * @returns {array} 解析后的字幕数组
   */
  parseSRT(content) {
    try {
      return SubtitleParser.parseSync(content);
    } catch (error) {
      console.error('解析SRT字幕失败:', error);
      return [];
    }
  }
  
  /**
   * 解析VTT格式字幕
   * @param {string} content - 字幕文件内容
   * @returns {array} 解析后的字幕数组
   */
  parseVTT(content) {
    try {
      return SubtitleParser.parseSync(content);
    } catch (error) {
      console.error('解析VTT字幕失败:', error);
      return [];
    }
  }
  
  /**
   * 根据文件扩展名自动选择解析方法
   * @param {string} content - 字幕文件内容
   * @param {string} extension - 文件扩展名
   * @returns {array} 解析后的字幕数组
   */
  parse(content, extension) {
    const ext = extension.toLowerCase();
    
    if (ext === '.srt') {
      return this.parseSRT(content);
    } else if (ext === '.vtt') {
      return this.parseVTT(content);
    } else {
      console.error('不支持的字幕格式:', extension);
      return [];
    }
  }
  
  /**
   * 根据时间获取当前字幕
   * @param {array} subtitles - 字幕数组
   * @param {number} time - 当前时间（秒）
   * @returns {object|null} 当前字幕对象或null
   */
  getCurrentSubtitle(subtitles, time) {
    if (!subtitles || !subtitles.length) return null;
    
    // 查找当前时间对应的字幕
    return subtitles.find(sub => 
      time * 1000 >= sub.start && time * 1000 <= sub.end
    ) || null;
  }
  
  /**
   * 将字幕数组转换为VTT格式文本
   * @param {array} subtitles - 字幕数组
   * @returns {string} VTT格式字幕文本
   */
  toVTT(subtitles) {
    return SubtitleParser.stringifySync(subtitles, { format: 'vtt' });
  }
  
  /**
   * 将字幕数组转换为SRT格式文本
   * @param {array} subtitles - 字幕数组
   * @returns {string} SRT格式字幕文本
   */
  toSRT(subtitles) {
    return SubtitleParser.stringifySync(subtitles, { format: 'srt' });
  }
  
  /**
   * 从字幕内容中提取单词或短语
   * @param {string} text - 字幕文本
   * @returns {array} 单词和短语数组
   */
  extractTerms(text) {
    if (!text) return [];
    
    // 基本分词
    const words = text.split(/\s+/).filter(word => word.length > 0);
    
    // 提取短语（简单示例）
    const phrases = [];
    if (words.length >= 2) {
      for (let i = 0; i < words.length - 1; i++) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
    }
    
    return {
      words,
      phrases
    };
  }
  
  /**
   * 高亮字幕中的指定文本
   * @param {string} subtitle - 字幕文本 
   * @param {string} term - 要高亮的文本
   * @returns {string} 添加了高亮标记的HTML字符串
   */
  highlightTerm(subtitle, term) {
    if (!subtitle || !term) return subtitle;
    
    // 使用正则表达式进行不区分大小写的替换
    const regex = new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    return subtitle.replace(regex, '<mark>$1</mark>');
  }
}

// 创建并导出单例实例
const subtitleService = new SubtitleService();
export default subtitleService; 