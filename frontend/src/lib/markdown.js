import { marked } from 'marked'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

// 自定义 slugify 函数，保留更多字符（如点号、括号等）
function customSlugify(text) {
  return text
    .toLowerCase()
    .trim()
    // 保留字母、数字、点号、连字符、下划线、空格、中文等
    // 只移除一些特殊字符，保留常见的标点符号
    .replace(/[^\w\s.\-()（）\u4e00-\u9fa5]/g, '') // 保留字母数字、点号、连字符、下划线、空格、括号、中文
    .replace(/\s+/g, '-') // 空格转连字符
    .replace(/-+/g, '-') // 多个连字符合并为一个
    .replace(/^-+|-+$/g, '') // 移除首尾连字符
}

marked.setOptions({
  gfm: true,
  breaks: true,
  smartypants: true,
  headerIds: true,
  mangle: false,
  slugify: customSlugify, // 使用自定义 slugify 函数
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  }
})

/**
 * 渲染 Markdown 为 HTML
 * @param {string} md - Markdown 文本
 * @param {object} options - 选项
 * @param {boolean} options.removeImages - 是否移除图片，默认 false
 * @returns {string} 渲染后的 HTML
 */
export function renderMarkdown(md, options = {}) {
  if (!md) return ''
  
  const { removeImages = false } = options
  
  // 如果需要在解析前移除图片，先处理 Markdown
  let processedMd = md
  if (removeImages) {
    // 移除 Markdown 格式的图片: ![alt](url)
    processedMd = processedMd.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '')
    // 移除 HTML 格式的图片: <img ...>
    processedMd = processedMd.replace(/<img[^>]*>/gi, '')
  }
  
  const html = marked.parse(processedMd)
  const sanitized = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
  
  // 后处理：将空段落转换为换行，保留空行的视觉效果
  // 将 <p></p> 或只包含空白字符的 <p> 转换为 <br/>
  let processedHtml = sanitized
    .replace(/<p>\s*<\/p>/g, '<br/>')
    .replace(/<p>(\s|&nbsp;)*<\/p>/g, '<br/>')
  
  // 将标题的 id 属性转换为 data-heading-id，避免 CSS id 命名规范冲突
  // 使用 DOM 解析器处理，更可靠
  try {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = processedHtml
    const headingElements = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6')
    headingElements.forEach((element) => {
      const id = element.id
      if (id) {
        // 将 id 转换为 data-heading-id
        element.setAttribute('data-heading-id', id)
        // 移除 id 属性
        element.removeAttribute('id')
      }
    })
    processedHtml = tempDiv.innerHTML
  } catch (e) {
    console.error('Error converting heading ids to data-heading-id:', e)
    // 如果 DOM 操作失败，回退到正则表达式方式
    processedHtml = processedHtml.replace(
      /<(h[1-6])([^>]*?)\s+id=["']([^"']+)["']([^>]*?)>/gi,
      (match, tag, attrs, idValue) => {
        // 移除 id 属性，添加 data-heading-id
        const cleanedAttrs = attrs.replace(/\s*id=["'][^"']*["']/gi, '').trim()
        const attrsStr = cleanedAttrs ? ' ' + cleanedAttrs : ''
        return `<${tag}${attrsStr} data-heading-id="${idValue}">`
      }
    )
  }
  
  // 如果需要在解析后移除图片（防止遗漏）
  if (removeImages) {
    processedHtml = processedHtml.replace(/<img[^>]*>/gi, '')
  }
  
  return processedHtml
}



