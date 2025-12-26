import { marked } from 'marked'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

marked.setOptions({
  gfm: true,
  breaks: true,
  smartypants: true,
  headerIds: true,
  mangle: false,
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
  
  // 如果需要在解析后移除图片（防止遗漏）
  if (removeImages) {
    processedHtml = processedHtml.replace(/<img[^>]*>/gi, '')
  }
  
  return processedHtml
}



