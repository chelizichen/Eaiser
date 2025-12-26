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

export function renderMarkdown(md) {
  if (!md) return ''
  
  const html = marked.parse(md)
  const sanitized = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
  
  // 后处理：将空段落转换为换行，保留空行的视觉效果
  // 将 <p></p> 或只包含空白字符的 <p> 转换为 <br/>
  const processedHtml = sanitized
    .replace(/<p>\s*<\/p>/g, '<br/>')
    .replace(/<p>(\s|&nbsp;)*<\/p>/g, '<br/>')
  
  return processedHtml
}

