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
      // 优先从 data-heading-id 读取，如果没有则从 id 读取（兼容旧数据）
      let id = element.getAttribute('data-heading-id') || element.id || ''
      
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
        
        // 设置元素的 data-heading-id 属性，以便后续跳转（不使用 id 避免 CSS 命名规范冲突）
        element.setAttribute('data-heading-id', id)
        // 如果存在 id 属性，移除它
        if (element.id) {
          element.removeAttribute('id')
        }
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
    // 先渲染成 HTML，然后从 HTML 中提取，这样可以确保 ID 与 marked 生成的一致
    const html = marked.parse(content)
    return extractHeadingsFromHTML(html)
  } catch (error) {
    console.error('Error extracting headings from Markdown:', error)
    // 如果 Markdown 解析失败，尝试从 HTML 中提取
    return extractHeadingsFromHTML(content)
  }
}
