/**
 * 图片处理工具函数
 */

/**
 * 从 local://images/ 路径中提取相对路径
 * @param {string} fullPath - 完整路径，如 "local://images/1234567890.png"
 * @returns {string} 相对路径，如 "1234567890.png"
 */
export function extractRelativePath(fullPath) {
  if (!fullPath || typeof fullPath !== 'string') return ''
  return fullPath.replace(/^local:\/\/images\//, '')
}

/**
 * 检查路径是否为本地图片路径
 * @param {string} path - 图片路径
 * @returns {boolean}
 */
export function isLocalImagePath(path) {
  return path && typeof path === 'string' && path.startsWith('local://images/')
}

/**
 * 加载本地图片并转换为 base64
 * @param {string} relativePath - 相对路径，如 "1234567890.png"
 * @returns {Promise<string>} base64 data URL
 */
export async function loadLocalImage(relativePath) {
  try {
    const base64Data = await window.go.backend.App.GetImageContent(relativePath)
    return base64Data
  } catch (err) {
    console.error('加载本地图片失败:', err, { relativePath })
    // 返回占位符图片
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lm77niYfliqDovb3lpLHotKU8L3RleHQ+PC9zdmc+'
  }
}

/**
 * 设置图片样式（用于预览）
 * @param {HTMLElement} img - 图片元素
 * @param {object} options - 样式选项
 * @param {string} options.width - 宽度样式，默认 '100%'
 * @param {string} options.margin - 外边距，默认 '12px 0'
 */
export function setImageStyle(img, options = {}) {
  const {
    width = '100%',
    margin = '12px 0'
  } = options
  
  img.setAttribute('style', `max-width: 100%; width: ${width}; height: auto; display: block; margin: ${margin};`)
}

/**
 * 处理 HTML 中的本地图片，转换为 base64
 * @param {string} html - HTML 字符串
 * @param {object} options - 选项
 * @param {function} options.onImageProcessed - 每张图片处理完成后的回调
 * @returns {Promise<string>} 处理后的 HTML
 */
export async function processLocalImagesInHtml(html, options = {}) {
  if (!html) return ''
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const images = doc.querySelectorAll('img[src^="local://images/"]')
  
  if (images.length === 0) {
    return html
  }
  
  const { onImageProcessed } = options
  
  // 处理所有本地图片
  const promises = Array.from(images).map(async (img) => {
    const fullPath = img.getAttribute('src')
    const relativePath = extractRelativePath(fullPath)
    
    try {
      const base64Data = await loadLocalImage(relativePath)
      img.setAttribute('src', base64Data)
      
      // 设置图片样式
      setImageStyle(img, options.imageStyle || {})
      
      if (onImageProcessed) {
        onImageProcessed({ img, relativePath, success: true })
      }
    } catch (err) {
      console.error('处理图片失败:', err, { relativePath })
      const placeholder = await loadLocalImage('') // 获取占位符
      img.setAttribute('src', placeholder)
      
      if (onImageProcessed) {
        onImageProcessed({ img, relativePath, success: false, error: err })
      }
    }
  })
  
  await Promise.all(promises)
  return doc.body.innerHTML
}

/**
 * 从 Markdown 内容中提取所有本地图片链接
 * @param {string} markdownContent - Markdown 内容
 * @returns {Array<{alt: string, path: string, fullPath: string}>}
 */
export function extractLocalImageLinks(markdownContent) {
  if (!markdownContent) return []
  
  const localImageRegex = /!\[([^\]]*)\]\(local:\/\/images\/([^\)]+)\)/g
  const matches = []
  let match
  
  while ((match = localImageRegex.exec(markdownContent)) !== null) {
    matches.push({
      alt: match[1] || 'image',
      path: match[2],
      fullPath: `local://images/${match[2]}`
    })
  }
  
  return matches
}

/**
 * 处理 Markdown 渲染后的 HTML，包括恢复丢失的图片 src 和处理本地图片
 * @param {string} markdownContent - 原始 Markdown 内容
 * @param {string} html - 渲染后的 HTML
 * @param {object} options - 选项
 * @returns {Promise<string>} 处理后的 HTML
 */
export async function processMarkdownHtml(markdownContent, html, options = {}) {
  if (!html) return ''
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const allImages = doc.querySelectorAll('img')
  const localImageLinks = extractLocalImageLinks(markdownContent)
  const localImages = []
  
  // 匹配图片标签和 Markdown 中的图片链接
  allImages.forEach((img, index) => {
    const alt = img.getAttribute('alt') || 'image'
    const src = img.getAttribute('src')
    
    // 如果已经有 src 且是 local://images/，直接处理
    if (src && isLocalImagePath(src)) {
      localImages.push({ 
        img, 
        path: extractRelativePath(src) 
      })
    } 
    // 如果没有 src 或 src 为空，尝试从 Markdown 中匹配
    else if (!src || src === '') {
      const matched = localImageLinks.find((m, i) => 
        (m.alt === alt && i === index) || (index === i && !src)
      )
      if (matched) {
        img.setAttribute('src', matched.fullPath)
        localImages.push({ img, path: matched.path })
      }
    }
  })
  
  // 处理所有本地图片
  if (localImages.length > 0) {
    const promises = localImages.map(async ({ img, path }) => {
      try {
        const base64Data = await loadLocalImage(path)
        img.setAttribute('src', base64Data)
        setImageStyle(img, options.imageStyle || {})
      } catch (err) {
        console.error('处理图片失败:', err, { path })
        const placeholder = await loadLocalImage('')
        img.setAttribute('src', placeholder)
      }
    })
    await Promise.all(promises)
  } else {
    // 即使没有本地图片，也要为所有图片设置样式
    allImages.forEach(img => {
      if (!img.getAttribute('style')) {
        setImageStyle(img, options.imageStyle || {})
      }
    })
  }
  
  return doc.body.innerHTML
}

