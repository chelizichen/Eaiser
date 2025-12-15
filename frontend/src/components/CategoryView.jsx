import React, { useEffect, useState } from 'react'
import { Button, Card, List, Typography, Empty } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'

export default function CategoryView({ activeCategory, onNavigate, reloadToken }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)

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

  const hasContent = notes.length > 0

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 导航按钮 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Button 
          type="primary"
          icon={<FileTextOutlined />}
          onClick={() => onNavigate('notes')}
          size="middle"
        >
          代码笔记
        </Button>
      </div>

      {/* 内容列表 */}
      {!hasContent && !loading && (
        <Empty description="该目录下暂无内容，点击上方按钮创建" />
      )}

      {notes.length > 0 && (
        <Card title={`代码笔记 (${notes.length})`} size="small">
          <List
            dataSource={notes}
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
                <Typography.Text strong>{note.title}</Typography.Text>
              </List.Item>
            )}
          />
        </Card>
      )}      

    </div>
  )
}

