import React from 'react'
import { Button, Card, Typography } from 'antd'
import { FilePdfOutlined, FolderOutlined, EditOutlined, CodeOutlined, PlayCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { isLocalImagePath } from '../lib/imageUtils'

/**
 * 笔记卡片组件
 */
export default function NoteCard({
  note,
  imageUrl,
  contentPreviewHtml,
  categoryName,
  isDarkMode,
  onOpenNote,
  onEditNote,
  onOpenCategoryModal,
  onExecuteScript,
  ensureUnlocked,
  activeCategory
}) {
  const isPDF = note.type === 1
  const isScript = note.type === 2
  const updatedTime = dayjs(note.updatedAt).format('YYYY-MM-DD HH:mm')

  const handleOpenNote = async (mode) => {
    const cid = note.categoryId ?? activeCategory
    if (ensureUnlocked && cid != null) {
      const ok = await ensureUnlocked(cid, mode === 'notes' ? '内容' : '内容')
      if (!ok) return
    }
    onOpenNote(mode, {
      type: 'note',
      id: note.id,
      categoryId: note.categoryId,
      title: note.title,
      ...(mode === 'notes' ? { mode: 'edit' } : {})
    })
  }

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
    handleOpenNote('notes')
  }

  const handleChangeCategory = (e) => {
    e.stopPropagation()
    onOpenCategoryModal(note.id, note.categoryId)
  }

  return (
    <Card
      hoverable
      size="small"
      style={{ 
        cursor: 'pointer',
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${isDarkMode ? '#525151' : 'rgb(245, 226, 226)'}`,
        transition: 'all 0.3s ease',
        breakInside: 'avoid', 
        marginBottom: 20,
        width: '100%',
        maxWidth: 'none',
        minWidth: 'auto',
        display: 'inline-block',
        boxSizing: 'border-box',
      }}
      bodyStyle={{
        padding: 0,
      }}
      onClick={() => handleOpenNote(null)}
    >
      {/* 右上角操作按钮 */}
      {!isPDF && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 4,
            zIndex: 10,
            borderRadius: 6,
            padding: '4px 2px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {isScript && (
            <Button
              size="small"
              type="text"
              icon={<PlayCircleOutlined />}
              style={{
                color: '#52c41a',
                padding: '2px 6px',
              }}
              onClick={handleExecute}
              title="执行脚本"
            />
          )}
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            style={{
              color: '#1890ff',
              padding: '2px 6px',
            }}
            onClick={handleEdit}
            title="编辑"
          />
          <Button
            size="small"
            type="text"
            icon={<FolderOutlined />}
            style={{
              color: '#1890ff',
              padding: '2px 6px',
            }}
            onClick={handleChangeCategory}
            title="修改目录"
          />
        </div>
      )}
      
      {/* PDF 或脚本类型的图标占位 */}
      {!imageUrl && (isPDF || isScript) && (
        <div
          style={{
            width: '100%',
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isPDF ? '#fff1f0' : '#e6f7ff',
          }}
        >
          {isPDF && <FilePdfOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />}
          {isScript && <CodeOutlined style={{ fontSize: 48, color: '#1890ff' }} />}
        </div>
      )}
      
      {/* 内容区域 */}
      <div style={{ padding: 16 }}>
        {/* 顶部：所属目录、最后更新时间 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-start', 
          alignItems: 'center',
          marginBottom: 12,
          gap: 12,
        }}>
          <Typography.Text 
            type="secondary" 
            style={{ fontSize: 12 }}
          >
            {categoryName}
          </Typography.Text>
          <Typography.Text 
            type="secondary" 
            style={{ fontSize: 12 }}
          >
            {updatedTime}
          </Typography.Text>
        </div>
        
        {/* 标题 */}
        <Typography.Title 
          level={5} 
          style={{ 
            margin: 0, 
            marginBottom: 12,
            fontSize: 16,
            fontWeight: 600,
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {isPDF && <FilePdfOutlined style={{ fontSize: 16, color: '#ff4d4f' }} />}
          {isScript && <CodeOutlined style={{ fontSize: 16, color: '#1890ff' }} />}
          {note.title}
        </Typography.Title>
        
        {/* 图片展示区域 */}
        {imageUrl && (
          <div
            style={{
              width: '100%',
              height: 180,
              overflow: 'hidden',
              backgroundColor: '#f5f5f5',
            }}
          >
            <img
              src={imageUrl}
              alt={note.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
          </div>
        )}
        
        {/* 内容预览 - Markdown 格式 */}
        {contentPreviewHtml && (
          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              lineHeight: 1.6,
              color: '#666',
              maxHeight: '120px',
              overflow: 'hidden',
              position: 'relative',
            }}
            className="markdown-preview-card"
            dangerouslySetInnerHTML={{ __html: contentPreviewHtml }}
          />
        )}
      </div>
    </Card>
  )
}

