import React, { useEffect, useState } from 'react'
import { Button, Typography } from 'antd'
import { EditOutlined, ColumnWidthOutlined, CloseOutlined } from '@ant-design/icons'
import { renderMarkdown } from '../lib/markdown'
import 'highlight.js/styles/github.css'
import hljs from 'highlight.js'

export default function ContentViewer({ item, onEdit, onSplitPane, onClosePane, canClose = true }) {
  const [data, setData] = useState(null)

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
