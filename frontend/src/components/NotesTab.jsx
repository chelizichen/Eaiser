import React, { useCallback, useEffect, useState } from 'react'
import { Button, Input } from 'antd'
import { ColumnWidthOutlined, CloseOutlined } from '@ant-design/icons'
import MarkdownEditor from './MarkdownEditor.jsx'

export default function NotesTab({ activeCategory, onSaved, editingNote, onSplitPane, onClosePane, canClose = true }) {
  const [title, setTitle] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [copyMarkdown, setCopyMarkdown] = useState('')

  // 如果处于编辑模式，加载要编辑的笔记内容
  useEffect(() => {
    async function load() {
      if (!editingNote || !editingNote.id) return
      try {
        const list = await window.go?.backend.App.ListNotes(null)
        const found = (list || []).find((n) => n.id === editingNote.id)
        if (found) {
          const md = found.contentMd || ''
          setTitle(found.title || '')
          setMarkdown(md)
          setCopyMarkdown(md)
        }
      } catch (e) {
        console.error('Load note for editing failed:', e)
      }
    }
    load()
  }, [editingNote])

  async function add() {
    if (editingNote?.id) {
      // 编辑模式：更新已有笔记
      await window.go?.backend.App.UpdateNoteMD(
        editingNote.id,
        title,
        'md',
        copyMarkdown,
        editingNote.categoryId || activeCategory || 0
      )
    } else {
      // 新建模式
      await window.go?.backend.App.CreateNoteMD(title, 'md', copyMarkdown, activeCategory || 0)
    }
    // 保存后清空表单
    setTitle('')
    setMarkdown('')
    setCopyMarkdown('')
    onSaved && onSaved()
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
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
      <div className="editor-page">
        <Input 
          placeholder="标题" 
          value={title} 
          onChange={(e) => {
            setTitle(e.target.value)
          }} 
          style={{marginBottom:12}}
        />
        <MarkdownEditor 
          valueMD={markdown}
          onChangeMD={(val)=>setCopyMarkdown(val)}
          height="70vh" 
        />
        <div className="editor-actions">
          <Button 
            onClick={() => { 
              setTitle('')
              setMarkdown('')
              setCopyMarkdown('')
            }}
          >
            清空
          </Button>
          <Button 
            type="primary" 
            onClick={add} 
            disabled={!title || !copyMarkdown}
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  )
}
