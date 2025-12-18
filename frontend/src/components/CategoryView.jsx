import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Button, Card, List, Typography, Empty, Input, Alert, message } from 'antd'
import { FileTextOutlined, SearchOutlined, AppstoreOutlined, UnorderedListOutlined, FilePdfOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import extractFirstImageUrl from '../lib/extractFirstImageurl'

export default function CategoryView({ activeCategory, onNavigate, reloadToken, categories, ensureUnlocked }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [viewMode, setViewMode] = useState('card') // 'list' 或 'card'
  const fileInputRef = useRef(null)

  const activeCat = useMemo(
    () => (categories || []).find(c => c.id === activeCategory),
    [categories, activeCategory]
  )
  const isEncrypted = activeCat?.colorPreset?.encrypted
  const categoryMap = useMemo(() => {
    const map = new Map()
    ;(categories || []).forEach(c => map.set(c.id, c.name))
    return map
  }, [categories])

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
  }, [activeCategory, reloadToken, isEncrypted])

  // 根据搜索文本过滤笔记
  const filteredNotes = useMemo(() => {
    if (!searchText.trim()) return notes
    const lowerSearch = searchText.toLowerCase()
    return notes.filter(note => 
      (note.title || '').toLowerCase().includes(lowerSearch)
    )
  }, [notes, searchText])

  const hasContent = notes.length > 0

  async function handleImportPDF(event) {
    const file = event.target.files?.[0]
    if (!file) return
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      message.error('请选择 PDF 文件')
      return
    }

    if (!activeCategory) {
      message.warning('请先选择一个目录')
      return
    }

    try {
      // 读取文件为 base64
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const base64Data = e.target.result.split(',')[1] // 移除 data:application/pdf;base64, 前缀
          
          // 调用后端导入接口
          const result = await window.go.backend.App.ImportPDF(base64Data, file.name, activeCategory)
          if (result) {
            message.success('PDF 导入成功')
            loadAll() // 刷新列表
          }
        } catch (err) {
          console.error('导入 PDF 失败:', err)
          message.error('导入 PDF 失败: ' + (err.message || '未知错误'))
        } finally {
          // 清空文件输入
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }
      }
      reader.onerror = () => {
        message.error('读取文件失败')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
      reader.readAsDataURL(file)
    } catch (e) {
      console.error('导入 PDF 失败:', e)
      message.error('导入 PDF 失败: ' + (e.message || '未知错误'))
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

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
          icon={<FilePdfOutlined />}
          onClick={() => fileInputRef.current?.click()}
          size="middle"
          disabled={!activeCategory}
          title={activeCategory ? '导入 PDF' : '请先选择目录'}
        >
          导入PDF
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={handleImportPDF}
        />
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
          <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 6 }}>
            {viewMode === 'card' ? (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 260px))', 
                gap: 16 
              }}>
                {filteredNotes.map((note) => {
                  const isPDF = note.type === 1
                  const bgUrl = isPDF ? null : extractFirstImageUrl(note.contentMd)
                  const openNote = async (mode) => {
                    const cid = note.categoryId ?? activeCategory
                    if (ensureUnlocked && cid != null) {
                      const ok = await ensureUnlocked(cid, mode === 'notes' ? '内容' : '内容')
                      if (!ok) return
                    }
                    onNavigate(mode, {
                      type: 'note',
                      id: note.id,
                      categoryId: note.categoryId,
                      title: note.title,
                      ...(mode === 'notes' ? { mode: 'edit' } : {})
                    })
                  }
                  return (
                    <Card
                      key={note.id}
                      hoverable
                      size="small"
                      style={{ 
                        cursor: 'pointer',
                        position: 'relative',
                        height: 220,
                        backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        // 只有有背景图时才强制白色文字，避免与浅色卡片背景冲突
                        color: bgUrl ? '#fff' : undefined,
                      }}
                      bodyStyle={{
                        padding: 12,
                        // 有背景图时加一层更深的渐变遮罩，保证文字可读
                        background : bgUrl ? 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.25))'  : 'undefined',
                        // background: bgUrl 
                        //   ? 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.25))' 
                        //   : isPDF ? 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)' : undefined,
                        borderRadius: 8,
                      }}
                      onClick={() => openNote(null)}
                    >
                      {/* 右上角小编辑按钮，PDF 类型不显示 */}
                      {!isPDF && (
                        <Button
                          size="small"
                          type="text"
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            color: '#00aeea',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            openNote('notes')
                          }}
                        >
                          编辑
                        </Button>
                      )}
                      <div>
                        <Typography.Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8,color: bgUrl ? 'rgba(255,255,255,0.85)' : undefined }}>
                          {isPDF && <FilePdfOutlined style={{ marginRight: 6, color: '#ff4d4f' }} />}
                          {note.title}
                        </Typography.Text>
                        <Typography.Text style={{ fontSize: 12, display: 'block', color: bgUrl ? 'rgba(255,255,255,0.75)' : undefined }}>
                          归属目录: {categoryMap.get(note.categoryId) || '未知目录'}
                        </Typography.Text>
                        <Typography.Text style={{ fontSize: 12, display: 'block', color: bgUrl ? 'rgba(255,255,255,0.85)' : undefined }}>
                          创建: {dayjs(note.createdAt).format('YYYY-MM-DD HH:mm')}
                        </Typography.Text>
                        <Typography.Text style={{ fontSize: 12, display: 'block', color: bgUrl ? 'rgba(255,255,255,0.85)' : undefined }}>
                          更新: {dayjs(note.updatedAt).format('YYYY-MM-DD HH:mm')}
                        </Typography.Text>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
          <List
            dataSource={filteredNotes}
            renderItem={(note) => {
              const isPDF = note.type === 1
              return (
                <List.Item
                  style={{ padding: '8px 12px' }}
                  actions={[
                    !isPDF && (
                      <Button
                        key="edit"
                        size="small"
                        type="link"
                        onClick={(e) => {
                          e.stopPropagation()
                          // 进入编辑模式：跳到 NotesTab，并携带要编辑的 note 信息
                          const cid = note.categoryId ?? activeCategory
                          if (ensureUnlocked && cid != null) {
                            ensureUnlocked(cid, '内容').then((ok) => {
                              if (!ok) return
                              onNavigate('notes', {
                                type: 'note',
                                id: note.id,
                                categoryId: note.categoryId,
                                title: note.title,
                                mode: 'edit'
                              })
                            })
                          } else {
                            onNavigate('notes', {
                              type: 'note',
                              id: note.id,
                              categoryId: note.categoryId,
                              title: note.title,
                              mode: 'edit'
                            })
                          }
                        }}
                      >
                        编辑
                      </Button>
                    )
                  ].filter(Boolean)}
                  onClick={() =>
                    (async () => {
                      const cid = note.categoryId ?? activeCategory
                      if (ensureUnlocked && cid != null) {
                        const ok = await ensureUnlocked(cid, '内容')
                        if (!ok) return
                      }
                      onNavigate(null, {
                        type: 'note',
                        id: note.id,
                        categoryId: note.categoryId,
                        title: note.title
                      })
                    })()
                  }                    
                >
                  <div style={{ flex: 1 }}>
                    <div>
                      <Typography.Text strong style={{cursor:"pointer"}}>
                        {isPDF && <FilePdfOutlined style={{ marginRight: 6, color: '#ff4d4f' }} />}
                        {note.title}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12,marginLeft:12 }}>
                        归属目录: {categoryMap.get(note.categoryId) || '未知目录'}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12,marginLeft:12 }}>
                        创建: {dayjs(note.createdAt).format('YYYY-MM-DD HH:mm')}
                        {' • '}
                        更新: {dayjs(note.updatedAt).format('YYYY-MM-DD HH:mm')}
                      </Typography.Text>
                      
                    </div>
                  </div>
                </List.Item>
              )
            }}
          />
            )}
          </div>
        </Card>
      )}      

    </div>
  )
}

