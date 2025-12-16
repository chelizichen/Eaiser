import React, { useEffect, useState, useMemo } from 'react'
import { Button, Card, List, Typography, Empty, Input } from 'antd'
import { FileTextOutlined, SearchOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

export default function CategoryView({ activeCategory, onNavigate, reloadToken }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [viewMode, setViewMode] = useState('card') // 'list' 或 'card'

  async function loadAll() {
    setLoading(true)
    try {
      const cid = activeCategory || null
      const notesList = await window.go.backend.App.ListNotes(cid).catch(() => [])
      setNotes(notesList || [])
    } catch (e) {
      console.error('加载失败:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [activeCategory, reloadToken])

  // 根据搜索文本过滤笔记
  const filteredNotes = useMemo(() => {
    if (!searchText.trim()) return notes
    const lowerSearch = searchText.toLowerCase()
    return notes.filter(note => 
      (note.title || '').toLowerCase().includes(lowerSearch)
    )
  }, [notes, searchText])

  const hasContent = notes.length > 0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 搜索框和导航按钮 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <Input
          placeholder="搜索笔记标题..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ flex: 1, maxWidth: 300 }}
        />
        <Button 
          type="primary"
          icon={<FileTextOutlined />}
          onClick={() => onNavigate('notes')}
          size="middle"
        >
          笔记
        </Button>
        <Button
          icon={viewMode === 'card' ? <UnorderedListOutlined /> : <AppstoreOutlined />}
          onClick={() => setViewMode(viewMode === 'card' ? 'list' : 'card')}
          size="middle"
          title={viewMode === 'card' ? '切换到列表模式' : '切换到卡片模式'}
        />
      </div>

      {/* 内容列表 */}
      {!hasContent && !loading && (
        <Empty description="该目录下暂无内容，点击上方按钮创建" />
      )}

      {notes.length > 0 && (
        <Card title={`笔记 (${filteredNotes.length}/${notes.length})`} size="small">
          {viewMode === 'card' ? (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
              gap: 16 
            }}>
              {filteredNotes.map((note) => (
                <Card
                  key={note.id}
                  hoverable
                  size="small"
                  style={{ cursor: 'pointer' }}
                  actions={[
                    <Button
                      key="edit"
                      size="small"
                      type="link"
                      onClick={(e) => {
                        e.stopPropagation()
                        onNavigate('notes', {
                          type: 'note',
                          id: note.id,
                          categoryId: note.categoryId,
                          title: note.title,
                          mode: 'edit'
                        })
                      }}
                    >
                      编辑
                    </Button>
                  ]}
                  onClick={() =>
                    onNavigate(null, {
                      type: 'note',
                      id: note.id,
                      categoryId: note.categoryId,
                      title: note.title
                    })
                  }
                >
                  <div>
                    <Typography.Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
                      {note.title}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      创建: {dayjs(note.createdAt).format('YYYY-MM-DD HH:mm')}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      更新: {dayjs(note.updatedAt).format('YYYY-MM-DD HH:mm')}
                    </Typography.Text>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <List
              dataSource={filteredNotes}
              renderItem={(note) => (
                <List.Item
                  style={{ padding: '8px 12px' }}
                  actions={[
                    <Button
                      key="edit"
                      size="small"
                      type="link"
                      onClick={(e) => {
                        e.stopPropagation()
                        // 进入编辑模式：跳到 NotesTab，并携带要编辑的 note 信息
                        onNavigate('notes', {
                          type: 'note',
                          id: note.id,
                          categoryId: note.categoryId,
                          title: note.title,
                          mode: 'edit'
                        })
                      }}
                    >
                      编辑
                    </Button>
                  ]}
                  onClick={() =>
                    onNavigate(null, {
                      type: 'note',
                      id: note.id,
                      categoryId: note.categoryId,
                      title: note.title
                    })
                  }                    
                >
                  <div style={{ flex: 1 }}>
                    <div>
                      <Typography.Text strong style={{cursor:"pointer"}}>{note.title}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12,marginLeft:12 }}>
                        创建: {dayjs(note.createdAt).format('YYYY-MM-DD HH:mm')}
                        {' • '}
                        更新: {dayjs(note.updatedAt).format('YYYY-MM-DD HH:mm')}
                      </Typography.Text>
                      
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>
      )}      

    </div>
  )
}

