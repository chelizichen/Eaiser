import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { Button, Typography, Image } from 'antd'
import { EditOutlined, ColumnWidthOutlined, CloseOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { renderMarkdown } from '../lib/markdown'
import { extractHeadings } from '../lib/extractHeadings'
import PDFViewer from './PDFViewer'
import ErrorBoundary from './ErrorBoundary'
import 'highlight.js/styles/github.css'
import hljs from 'highlight.js'

export default function ContentViewer({ item, onEdit, onSplitPane, onClosePane, canClose = true, onOpenTOC }) {
  const [data, setData] = useState(null)
  const [pdfPath, setPdfPath] = useState(null)
  const contentRef = useRef(null)
  const [previewImage, setPreviewImage] = useState({ visible: false, src: '' })

  async function load() {
    if (!item) return
    if (item.type === 'note') {
      const list = await window.go.backend.App.ListNotes(null)
      const found = (list || []).find(n => n.id === item.id)
      setData(found || null)
    } else if (item.type === 'image') {
      const list = await window.go.backend.App.ListImages(null)
      const found = (list || []).find(i => i.id === item.id)
      setData(found || null)
    } else if (item.type === 'blender') {
      const list = await window.go.backend.App.ListBlender(null)
      const found = (list || []).find(b => b.id === item.id)
      setData(found || null)
    }
  }

  useEffect(() => { load() }, [item])

  // 计算派生值（必须在所有 hooks 之前，但可以在 useEffect 之后）
  const raw = data?.contentMd || ''
  const isHTML = raw.trim().startsWith('<')
  
  // 提取标题（必须在组件顶层调用，不能在条件渲染中）
  const headings = useMemo(() => {
    if (!data || !item || item.type !== 'note' || !item.id) {
      return []
    }
    if (!raw) {
      return []
    }
    try {
      // 无论是 HTML 还是 Markdown，都尝试提取标题
      const extracted = extractHeadings(raw, isHTML)
      return extracted
    } catch (e) {
      console.error('Error extracting headings:', e)
      return []
    }
  }, [data, item, raw, isHTML])

  // 处理标题点击，滚动到对应位置（必须在 headings 定义之后）
  const handleHeadingClick = useCallback((headingId) => {
    // 首先尝试在 viewer-content 容器内查找
    const contentContainer = contentRef.current
    if (!contentContainer) {
      return
    }
    
    // 在容器内查找标题元素
    // 尝试多种选择器：ID、data-id、或者通过文本内容查找
    let element = contentContainer.querySelector(`#${headingId}`)
    if (!element) {
      // 如果通过 ID 找不到，尝试查找所有 h1-h6，然后通过文本匹配
      const allHeadings = contentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6')
      for (const heading of allHeadings) {
        const headingIdFromElement = heading.id || heading.getAttribute('data-id') || ''
        if (headingIdFromElement === headingId) {
          element = heading
          break
        }
      }
    }
    
    if (element) {
      
      // 获取容器的滚动位置
      const containerRect = contentContainer.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()
      const scrollTop = contentContainer.scrollTop
      const targetScrollTop = scrollTop + elementRect.top - containerRect.top - 20 // 20px 偏移
      

      // 平滑滚动
      contentContainer.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      })
      
      // 高亮一下（可选）
      const originalBg = element.style.backgroundColor
      const originalTransition = element.style.transition
      element.style.transition = 'background-color 0.3s'
      element.style.backgroundColor = 'rgba(47, 128, 237, 0.15)'
      setTimeout(() => {
        element.style.backgroundColor = originalBg
        setTimeout(() => {
          element.style.transition = originalTransition
        }, 300)
      }, 1500)
    }else{
    }
  }, [])

  // 打开目录 pane（必须在组件顶层调用，在 headings 定义之后）
  const handleOpenTOC = useCallback(() => {
    try {
      if (onOpenTOC && headings.length > 0) {
        onOpenTOC(headings, handleHeadingClick)
      } else if (onSplitPane) {
        // 如果没有 onOpenTOC，使用分屏功能
        onSplitPane()
      }
    } catch (e) {
      console.error('Error opening TOC:', e)
    }
  }, [onOpenTOC, headings, handleHeadingClick, onSplitPane])

  // 如果是 PDF 类型，获取文件内容并创建 blob URL
  useEffect(() => {
    async function loadPDFContent() {
      if (data && data.type === 1 && data.id) {
        try {
          
          const base64Data = await window.go.backend.App.GetPDFContent(data.id)
          
          // 转换为 blob URL
          const byteCharacters = atob(base64Data)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: 'application/pdf' })
          const blobUrl = URL.createObjectURL(blob)
          setPdfPath(blobUrl)
          
        } catch (e) {
          console.error('获取 PDF 内容失败:', e)
          setPdfPath(null)
        }
      } else {
        setPdfPath(null)
      }
    }
    loadPDFContent()
    
    // 清理 blob URL
    return () => {
      if (pdfPath && pdfPath.startsWith('blob:')) {
        URL.revokeObjectURL(pdfPath)
      }
    }
  }, [data])

  // 每次内容变更后，对代码块执行 highlight.js 高亮，并确保标题有 ID
  useEffect(() => {
    // 在 effect 内部计算，避免依赖外部变量
    const currentRaw = data?.contentMd || ''
    const currentIsHTML = currentRaw.trim().startsWith('<')
    let currentHeadings = []
    if (data && item && item.type === 'note' && item.id && currentRaw) {
      try {
        currentHeadings = extractHeadings(currentRaw, currentIsHTML)
      } catch (e) {
        // 忽略错误，继续执行
      }
    }
    
    // 延迟到 DOM 更新完成后执行
    const timer = setTimeout(() => {
      try {
        const contentContainer = contentRef.current
        if (!contentContainer) return
        
        // 确保所有标题元素都有 ID（用于 HTML 内容）
        if (currentIsHTML && currentHeadings && currentHeadings.length > 0) {
          const headingElements = contentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6')
          headingElements.forEach((element, index) => {
            if (!element.id) {
              // 从 headings 数组中查找匹配的标题
              const text = element.textContent || element.innerText || ''
              const matchingHeading = currentHeadings.find(h => 
                h.text.trim() === text.trim() || 
                text.trim().includes(h.text.trim()) ||
                h.text.trim().includes(text.trim())
              )
              
              if (matchingHeading) {
                element.id = matchingHeading.id
              } else {
                // 如果没有匹配的，生成一个 ID
                const generatedId = text
                  .toLowerCase()
                  .trim()
                  .replace(/[^\w\s-]/g, '')
                  .replace(/\s+/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-+|-+$/g, '') || `heading-${index}`
                element.id = generatedId
              }
            }
          })
        }
        
        // 对代码块执行高亮
        const blocks = contentContainer.querySelectorAll('pre code, pre')
        blocks.forEach((block) => {
          // 尝试对 <code> 标签高亮，否则直接对 <pre> 高亮
          const el = block.tagName === 'PRE' && block.firstElementChild ? block.firstElementChild : block
          hljs.highlightElement(el)
        })
        
        // 为所有图片添加双击放大功能
        const images = contentContainer.querySelectorAll('img')
        images.forEach((img) => {
          // 检查是否已经添加过事件监听器
          if (img.dataset.dblclickAdded) {
            return
          }
          
          // 标记已添加
          img.dataset.dblclickAdded = 'true'
          
          // 添加双击事件
          const handleDoubleClick = (e) => {
            e.preventDefault()
            e.stopPropagation()
            const src = img.src || img.getAttribute('src') || ''
            if (src) {
              setPreviewImage({ visible: true, src })
            }
          }
          
          img.addEventListener('dblclick', handleDoubleClick)
          
          // 添加鼠标样式提示
          img.style.cursor = 'zoom-in'
          img.title = '双击放大图片'
        })
      } catch (e) {
        console.error('Error in post-render effect:', e)
      }
    }, 100) // 增加延迟，确保 DOM 完全更新
    return () => clearTimeout(timer)
  }, [data, item])

  if (!item) return null
  if (!data) return <div>加载中...</div>

  if (item.type === 'note' && item.id) {
    // PDF 类型
    if (data.type === 1) {
      return (
        <div className="pane-viewer">
          <div className="pane-actions-inline">
            <Button
              type="text"
              size="small"
              icon={<ColumnWidthOutlined />}
              onClick={onSplitPane}
              title="分屏"
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={onClosePane}
              disabled={!canClose}
              title="关闭面板"
            />
          </div>
          <ErrorBoundary>
            {pdfPath ? (
              <PDFViewer filePath={pdfPath} title={data.title} />
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Typography.Text>加载 PDF 路径中...</Typography.Text>
              </div>
            )}
          </ErrorBoundary>
        </div>
      )
    }

    // 普通笔记类型
    const html = isHTML ? raw : renderMarkdown(raw)
    
    return (
      <ErrorBoundary>
        <div className="pane-viewer">
        <div className="pane-actions-inline">
          {headings.length > 0 && (
            <Button
              type="text"
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={() => {
                handleOpenTOC()
              }}
              title={`目录 (${headings.length} 个标题)`}
            />
          )}
            <Button
              type="text"
              size="small"
              icon={<ColumnWidthOutlined />}
              onClick={onSplitPane}
              title="分屏"
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={onClosePane}
              disabled={!canClose}
              title="关闭面板"
            />
          </div>
          <div
            style={{
              display: 'grid',
              gap: 12,
              overflow: 'auto',
              height: '90vh',
              alignContent: 'start',
              alignItems: 'start',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>{data.title}</Typography.Title>
              <Button
                size="small"
                type="primary"
                icon={<EditOutlined />}
                onClick={() => onEdit && onEdit({ item, data })}
              >
                编辑
              </Button>
            </div>
            <div 
              ref={contentRef}
              className="viewer-content" 
              dangerouslySetInnerHTML={{ __html: html }} 
            />
          </div>
          {/* 图片预览 */}
          {previewImage.src && (
            <Image
              width={0}
              height={0}
              style={{ display: 'none' }}
              src={previewImage.src}
              preview={{
                visible: previewImage.visible,
                src: previewImage.src,
                onVisibleChange: (visible) => {
                  setPreviewImage(prev => ({ ...prev, visible }))
                  if (!visible) {
                    // 关闭时清空 src，避免预览组件残留
                    setTimeout(() => {
                      setPreviewImage({ visible: false, src: '' })
                    }, 300)
                  }
                },
              }}
            />
          )}
        </div>
      </ErrorBoundary>
    )
  }
  return null
}
