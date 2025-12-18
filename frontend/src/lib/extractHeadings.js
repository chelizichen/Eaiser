import { marked } from 'marked'

/**
 * 从 HTML 文本中提取所有标题（h1-h6）
 * @param {string} html - HTML 文本
 * @returns {Array} 标题数组，每个元素包含 { level, text, id }
 */
function extractHeadingsFromHTML(html) {
  if (!html || typeof html !== 'string') {
    return []
  }

  try {
    // 创建一个临时 DOM 元素来解析 HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
    const headings = []
    const headingElements = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6')
    
    headingElements.forEach((element, index) => {
      const tagName = element.tagName.toLowerCase()
      const level = parseInt(tagName.substring(1)) // h1 -> 1, h2 -> 2, etc.
      const text = element.textContent || element.innerText || ''
      let id = element.id || ''
      
      // 如果没有 ID，生成一个
      if (!id) {
        id = text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
        
        if (!id) {
          id = `heading-${index}`
        }
        
        // 设置元素的 ID，以便后续跳转
        element.id = id
      }
      
      headings.push({
        level,
        text: text.trim(),
        id
      })
    })
    
    return headings
  } catch (error) {
    console.error('Error extracting headings from HTML:', error)
    return []
  }
}

/**
 * 从 Markdown 或 HTML 文本中提取所有标题
 * @param {string} content - Markdown 或 HTML 文本
 * @param {boolean} isHTML - 是否为 HTML 格式
 * @returns {Array} 标题数组，每个元素包含 { level, text, id }
 */
export function extractHeadings(content, isHTML = false) {
  if (!content || typeof content !== 'string') {
    return []
  }

  // 如果是 HTML，直接从 HTML 中提取
  if (isHTML) {
    return extractHeadingsFromHTML(content)
  }

  // 否则从 Markdown 中提取
  try {
    const tokens = marked.lexer(content)
    const headings = []
    
    tokens
      .filter(token => token.type === 'heading')
      .forEach(token => {
        // 生成 ID，与 marked 的 headerIds 选项保持一致
        // marked 默认使用文本转小写、替换特殊字符、空格转连字符的方式
        // 参考 marked 的默认 slugify 实现
        let id = token.text
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '') // 移除特殊字符（保留字母、数字、下划线、连字符、空格）
          .replace(/\s+/g, '-') // 空格转连字符
          .replace(/-+/g, '-') // 多个连字符合并为一个
          .replace(/^-+|-+$/g, '') // 移除首尾连字符
        
        // 如果 ID 为空，使用备用 ID
        if (!id) {
          id = `heading-${headings.length}`
        }
        
        headings.push({
          level: token.depth, // 1-6
          text: token.text,
          id: id || `heading-${headings.length}` // 如果 ID 为空，使用备用 ID
        })
      })
    
    return headings
  } catch (error) {
    console.error('Error extracting headings from Markdown:', error)
    // 如果 Markdown 解析失败，尝试从 HTML 中提取
    return extractHeadingsFromHTML(content)
  }
}
