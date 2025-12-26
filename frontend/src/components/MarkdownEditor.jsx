import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from 'antd'
import { renderMarkdown } from '../lib/markdown'
import { processMarkdownHtml } from '../lib/imageUtils'
import 'highlight.js/styles/github.css'

const { TextArea } = Input

function MarkdownEditor({ valueMD, onChangeMD, height = '60vh' }) {
  const textareaRef = useRef(null)
  const [markdownContent, setMarkdownContent] = useState('')
  const lastValueMDRef = useRef('')
  const [leftWidth, setLeftWidth] = useState(50) // 左侧编辑器宽度百分比
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef(null)

  // 初始化/变更时同步外部传入的内容
  useEffect(() => {
    // 如果 valueMD 没有变化，不更新
    if (valueMD === lastValueMDRef.current) {
      return
    }
    lastValueMDRef.current = valueMD || ''
    
    if (!valueMD) {
      setMarkdownContent('')
      return
    }
    
    // 统一使用 Markdown 格式，不再支持 HTML
    setMarkdownContent(valueMD)
  }, [valueMD])

  // 处理文本变化
  const handleChange = useCallback((e) => {
    const newValue = e.target.value
    setMarkdownContent(newValue)
    // 直接输出 Markdown 格式
    onChangeMD && onChangeMD(newValue)
  }, [onChangeMD])

  // 处理粘贴图片
  const handlePaste = useCallback(async (event) => {
    try {
      const items = event.clipboardData?.items
      if (!items) return

      let handled = false
      for (let item of items) {
        if (item.type.indexOf('image') === 0) {
          handled = true
          event.preventDefault()
          const blob = item.getAsFile()
          if (!blob) continue

          const reader = new FileReader()
          reader.onload = async (e) => {
            try {
              const base64Data = e.target?.result
              if (!base64Data) return

              // 保存图片到本地（先传给后台保存）
              try {
                const relativePath = await window.go.backend.App.SaveImage(base64Data)
                // 使用 local://images/ 前缀格式
                const imageMarkdown = `![image](local://images/${relativePath})\n`
                
                // 在光标位置插入图片 Markdown
                const textarea = textareaRef.current?.resizableTextArea?.textArea
                if (textarea) {
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const text = markdownContent
                  const newText = text.substring(0, start) + imageMarkdown + text.substring(end)
                  setMarkdownContent(newText)
                  onChangeMD && onChangeMD(newText)
                  
                  // 设置光标位置
                  setTimeout(() => {
                    const newPos = start + imageMarkdown.length
                    textarea.setSelectionRange(newPos, newPos)
                    textarea.focus()
                  }, 0)
                }
              } catch (err) {
                console.error('Save image failed:', err)
                // 如果保存失败，使用 base64
                const imageMarkdown = `![image](${base64Data})\n`
                const textarea = textareaRef.current?.resizableTextArea?.textArea
                if (textarea) {
                  const start = textarea.selectionStart
                  const end = textarea.selectionEnd
                  const text = markdownContent
                  const newText = text.substring(0, start) + imageMarkdown + text.substring(end)
                  setMarkdownContent(newText)
                  onChangeMD && onChangeMD(newText)
                }
              }
            } catch (err) {
              console.error('Paste image error:', err)
            }
          }
          reader.readAsDataURL(blob)
        }
      }
    } catch (err) {
      console.error('Handle paste error:', err)
    }
  }, [markdownContent, onChangeMD])

  // 注册粘贴事件
  useEffect(() => {
    const textarea = textareaRef.current?.resizableTextArea?.textArea
    if (textarea) {
      textarea.addEventListener('paste', handlePaste)
    return () => {
        textarea.removeEventListener('paste', handlePaste)
      }
    }
  }, [handlePaste])

  // 处理拖拽调整大小
  const handleMouseDown = useCallback((e) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !containerRef.current) return
      
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = (x / rect.width) * 100
      
      // 限制在 20% 到 80% 之间
      const clampedPercentage = Math.max(20, Math.min(80, percentage))
      setLeftWidth(clampedPercentage)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing])

  // 渲染预览内容
  const [previewHtml, setPreviewHtml] = useState('')

  // 处理本地图片并更新预览
  useEffect(() => {
    const processPreview = async () => {
      const html = renderMarkdown(markdownContent)
      const processedHtml = await processMarkdownHtml(markdownContent, html, {
        imageStyle: { width: '100%', margin: '12px 0' }
      })
      setPreviewHtml(processedHtml)
    }
    
    processPreview()
  }, [markdownContent])

  return (
    <div 
      ref={containerRef}
      className="editor-wrapper" 
      style={{ 
        height, 
        display: 'flex', 
        flexDirection: 'row', 
        position: 'relative',
        userSelect: isResizing ? 'none' : 'auto'
      }}
    >
      {/* 左侧编辑器 */}
      <div style={{ 
        width: `${leftWidth}%`, 
        display: 'flex', 
        flexDirection: 'column', 
        minWidth: 0,
        paddingRight: 6
      }}>
        <div style={{ 
          fontSize: 12, 
          color: '#666', 
          marginBottom: 4,
          padding: '0 4px',
          fontWeight: 500
        }}>
          编辑
        </div>
        <TextArea
          ref={textareaRef}
          value={markdownContent}
        onChange={handleChange}
          placeholder="输入 Markdown 格式的内容..."
          style={{
            flex: 1,
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
            fontSize: 14,
            lineHeight: 1.6,
            resize: 'none'
          }}
          autoSize={{ minRows: 10 }}
        />
      </div>
      
      {/* 可拖拽的分隔条 */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: '8px',
          cursor: 'col-resize',
          backgroundColor: isResizing ? '#1890ff' : '#d9d9d9',
          transition: isResizing ? 'none' : 'background-color 0.2s',
          position: 'relative',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="拖拽调整大小"
      >
        <div style={{
          width: '2px',
          height: '40px',
          backgroundColor: isResizing ? '#fff' : '#999',
          borderRadius: '1px'
        }} />
      </div>
      
      {/* 右侧预览 */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        minWidth: 0,
        paddingLeft: 6
      }}>
        <div style={{ 
          fontSize: 12, 
          color: '#666', 
          marginBottom: 4,
          padding: '0 4px',
          fontWeight: 500
        }}>
          预览
        </div>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            borderRadius: 4,
            fontSize: 14,
            lineHeight: 1.8,
            minHeight: 0
          }}
          className="markdown-preview"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>
    </div>
  )
}

export default MarkdownEditor
