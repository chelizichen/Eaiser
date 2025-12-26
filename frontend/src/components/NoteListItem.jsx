import React from 'react'
import { Button, List, Typography } from 'antd'
import { FilePdfOutlined, FolderOutlined, EditOutlined, CodeOutlined, PlayCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

/**
 * 笔记列表项组件
 */
export default function NoteListItem({
  note,
  categoryName,
  onOpenNote,
  onEditNote,
  onOpenCategoryModal,
  onExecuteScript,
  ensureUnlocked,
  activeCategory
}) {
  const isPDF = note.type === 1
  const isScript = note.type === 2

  const handleExecute = (e) => {
    e.stopPropagation()
    const cid = note.categoryId ?? activeCategory
    if (ensureUnlocked && cid != null) {
      ensureUnlocked(cid, '内容').then((ok) => {
        if (!ok) return
        onExecuteScript({
          type: 'note',
          id: note.id,
          categoryId: note.categoryId,
          title: note.title,
          autoExecute: true
        })
      })
    } else {
      onExecuteScript({
        type: 'note',
        id: note.id,
        categoryId: note.categoryId,
        title: note.title,
        autoExecute: true
      })
    }
  }

  const handleEdit = (e) => {
    e.stopPropagation()
    const cid = note.categoryId ?? activeCategory
    if (ensureUnlocked && cid != null) {
      ensureUnlocked(cid, '内容').then((ok) => {
        if (!ok) return
        onEditNote({
          type: 'note',
          id: note.id,
          categoryId: note.categoryId,
          title: note.title,
          mode: 'edit'
        })
      })
    } else {
      onEditNote({
        type: 'note',
        id: note.id,
        categoryId: note.categoryId,
        title: note.title,
        mode: 'edit'
      })
    }
  }

  const handleOpen = async () => {
    const cid = note.categoryId ?? activeCategory
    if (ensureUnlocked && cid != null) {
      const ok = await ensureUnlocked(cid, '内容')
      if (!ok) return
    }
    onOpenNote({
      type: 'note',
      id: note.id,
      categoryId: note.categoryId,
      title: note.title
    })
  }

  return (
    <List.Item
      style={{ padding: '8px 12px' }}
      actions={[
        isScript && (
          <Button
            key="execute"
            size="small"
            type="link"
            icon={<PlayCircleOutlined />}
            style={{ color: '#52c41a' }}
            onClick={handleExecute}
            title="执行脚本"
          />
        ),
        !isPDF && (
          <Button
            key="edit"
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={handleEdit}
            title="编辑"
          />
        ),
        <Button
          key="category"
          size="small"
          type="link"
          icon={<FolderOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            onOpenCategoryModal(note.id, note.categoryId)
          }}
          title="修改目录"
        />
      ].filter(Boolean)}
      onClick={handleOpen}
    >
      <div style={{ flex: 1 }}>
        <div>
          <Typography.Text strong style={{ cursor: "pointer" }}>
            {isPDF && <FilePdfOutlined style={{ marginRight: 6, color: '#ff4d4f' }} />}
            {isScript && <CodeOutlined style={{ marginRight: 6, color: '#1890ff' }} />}
            {note.title}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>
            归属目录: {categoryName}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>
            创建: {dayjs(note.createdAt).format('YYYY-MM-DD HH:mm')}
            {' • '}
            更新: {dayjs(note.updatedAt).format('YYYY-MM-DD HH:mm')}
          </Typography.Text>
        </div>
      </div>
    </List.Item>
  )
}

