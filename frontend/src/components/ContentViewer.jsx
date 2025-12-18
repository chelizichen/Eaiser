import React, { useEffect, useState } from 'react'
import { Button, Typography } from 'antd'
import { EditOutlined, ColumnWidthOutlined, CloseOutlined } from '@ant-design/icons'
import { renderMarkdown } from '../lib/markdown'
import PDFViewer from './PDFViewer'
import ErrorBoundary from './ErrorBoundary'
import 'highlight.js/styles/github.css'
import hljs from 'highlight.js'

export default function ContentViewer({ item, onEdit, onSplitPane, onClosePane, canClose = true }) {
  const [data, setData] = useState(null)
  const [pdfPath, setPdfPath] = useState(null)

  async function load() {
    try {
      await window.go.backend.App.LogFrontend(JSON.stringify({ event: 'ContentViewer.load', item }))
    } catch (e) {
      // ignore logging errors
    }
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

  // 如果是 PDF 类型，获取文件内容并创建 blob URL
  useEffect(() => {
    async function loadPDFContent() {
      if (data && data.type === 1 && data.id) {
        try {
          console.log('Loading PDF content for note ID:', data.id)
          if (window.go?.backend?.App?.LogFrontend) {
            window.go.backend.App.LogFrontend(JSON.stringify({
              event: 'ContentViewer.loadPDFContent',
              noteId: data.id
            }))
          }
          
          const base64Data = await window.go.backend.App.GetPDFContent(data.id)
          console.log('PDF base64 data received, length:', base64Data?.length)
          
          // 转换为 blob URL
          const byteCharacters = atob(base64Data)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: 'application/pdf' })
          const blobUrl = URL.createObjectURL(blob)
          console.log('PDF blob URL created:', blobUrl)
          setPdfPath(blobUrl)
          
          if (window.go?.backend?.App?.LogFrontend) {
            window.go.backend.App.LogFrontend(JSON.stringify({
              event: 'ContentViewer.pdfBlobCreated',
              blobUrl: 'created'
            }))
          }
        } catch (e) {
          console.error('获取 PDF 内容失败:', e)
          if (window.go?.backend?.App?.LogFrontend) {
            window.go.backend.App.LogFrontend(JSON.stringify({
              event: 'ContentViewer.pdfLoadError',
              error: e?.message || String(e),
              stack: e?.stack
            }))
          }
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

  // 每次内容变更后，对代码块执行 highlight.js 高亮
  useEffect(() => {
    // 延迟到 DOM 更新完成后执行
    const timer = setTimeout(() => {
      try {
        const blocks = document.querySelectorAll('.viewer-content pre code, .viewer-content pre')
        blocks.forEach((block) => {
          // 尝试对 <code> 标签高亮，否则直接对 <pre> 高亮
          const el = block.tagName === 'PRE' && block.firstElementChild ? block.firstElementChild : block
          hljs.highlightElement(el)
        })
      } catch (e) {
        console.error('highlight code error:', e)
      }
    }, 0)
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
    const raw = data.contentMd || ''
    const isHTML = raw.trim().startsWith('<')
    const html = isHTML ? raw : renderMarkdown(raw)
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
          <div className="viewer-content" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    )
  }
  return null
}
