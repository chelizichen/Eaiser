import React, { useCallback, useEffect, useState } from 'react'
import { Button, Input, Alert } from 'antd'
import { ColumnWidthOutlined, CloseOutlined, CodeOutlined } from '@ant-design/icons'
import MarkdownEditor from './MarkdownEditor.jsx'
const { TextArea } = Input

export default function NotesTab({ activeCategory, onSaved, editingNote, onSplitPane, onClosePane, canClose = true }) {
  const [title, setTitle] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [copyMarkdown, setCopyMarkdown] = useState('')
  const [noteType, setNoteType] = useState(0) // 0: 正常笔记, 1: PDF, 2: 命令行工具

  // 如果处于编辑模式，加载要编辑的笔记内容
  useEffect(() => {
    async function load() {
      // 如果没有 editingNote，清空表单
      if (!editingNote) {
        setTitle('')
        setMarkdown('')
        setCopyMarkdown('')
        setNoteType(0)
        return
      }
      
      // 如果是新建模式且指定了 noteType
      if (!editingNote.id) {
        // 新建模式，检查是否有 noteType
        if (editingNote.noteType === 2) {
          setNoteType(2)
          // 清空表单，准备新建
          setTitle('')
          setMarkdown('')
          setCopyMarkdown('')
        } else {
          setNoteType(0)
          setTitle('')
          setMarkdown('')
          setCopyMarkdown('')
        }
        return
      }
      
      // 编辑模式：加载已有笔记
      try {
        const list = await window.go?.backend.App.ListNotes(null)
        const found = (list || []).find((n) => n.id === editingNote.id)
        if (found) {
          const md = found.contentMd || ''
          setTitle(found.title || '')
          setMarkdown(md)
          setCopyMarkdown(md)
          setNoteType(found.type || 0)
        }
      } catch (e) {
        console.error('Load note for editing failed:', e)
      }
    }
    load()
  }, [editingNote])

  async function add() {
    // 对于 Type 2，直接使用纯文本；对于普通笔记，使用 copyMarkdown（可能是 HTML）
    const contentToSave = noteType === 2 ? copyMarkdown.trim() : copyMarkdown

    if (editingNote?.id) {
      // 编辑模式：更新已有笔记（保持原有的 Type）
      await window.go?.backend.App.UpdateNoteMD(
        editingNote.id,
        title,
        'md',
        contentToSave,
        editingNote.categoryId || activeCategory || 0
      )
    } else {
      // 新建模式
      const categoryId = editingNote?.categoryId || activeCategory || 0
      if (noteType === 2) {
        // 使用 CreateNoteMDWithType 创建命令行工具
        await window.go?.backend.App.CreateNoteMDWithType(title, 'md', contentToSave, categoryId, 2)
      } else {
        // 使用 CreateNoteMD 创建普通笔记
        await window.go?.backend.App.CreateNoteMD(title, 'md', contentToSave, categoryId)
      }
    }
    // 保存后清空表单
    setTitle('')
    setMarkdown('')
    setCopyMarkdown('')
    setNoteType(0)
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
        {noteType === 2 && (
          <Alert
            message="命令行工具脚本"
            description="在此编辑 shell 脚本内容，保存后可以在查看页面执行脚本。"
            type="info"
            icon={<CodeOutlined />}
            style={{ marginBottom: 12 }}
            showIcon
          />
        )}
        <Input 
          placeholder="标题" 
          value={title} 
          onChange={(e) => {
            setTitle(e.target.value)
          }} 
          style={{marginBottom:12}}
        />
        {noteType === 2 ? (
          <TextArea
            placeholder="输入 shell 脚本内容..."
            value={copyMarkdown}
            onChange={(e) => {
              setCopyMarkdown(e.target.value)
              setMarkdown(e.target.value)
            }}
            rows={20}
            style={{
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
              fontSize: 13,
              marginBottom: 12
            }}
          />
        ) : (
          <MarkdownEditor 
            valueMD={markdown}
            onChangeMD={(val)=>setCopyMarkdown(val)}
            height="70vh" 
          />
        )}
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
