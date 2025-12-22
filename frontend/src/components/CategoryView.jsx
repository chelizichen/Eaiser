import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Button, Card, List, Typography, Empty, Input, Alert, message, Modal, Select } from 'antd'
import { FileTextOutlined, SearchOutlined, AppstoreOutlined, UnorderedListOutlined, FilePdfOutlined, FolderOutlined, EditOutlined, DeleteOutlined, CodeOutlined, PlayCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import extractFirstImageUrl from '../lib/extractFirstImageurl'

export default function CategoryView({ activeCategory, onNavigate, reloadToken, categories, ensureUnlocked, onCategoryChanged }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [viewMode, setViewMode] = useState('card') // 'list' 或 'card'
  const fileInputRef = useRef(null)
  const [categoryModalVisible, setCategoryModalVisible] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)

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
  const canDeleteCategory = !hasContent && activeCategory !== null

  // 处理删除目录
  const handleDeleteCategory = () => {
    if (!activeCategory) return
    
    const categoryName = activeCat?.name || '该目录'
    
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除目录"${categoryName}"吗？此操作不可恢复。`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await window.go.backend.App.DeleteCategory(activeCategory)
          message.success('目录删除成功')
          // 刷新目录列表
          if (onCategoryChanged) {
            onCategoryChanged()
          }
          // 清空当前选中的目录
          if (onNavigate) {
            onNavigate('category', null)
          }
        } catch (e) {
          console.error('删除目录失败:', e)
          message.error('删除目录失败: ' + (e?.message || '未知错误'))
        }
      }
    })
  }

  // 构建目录树形数据（用于 Select 组件）
  const categoryOptions = useMemo(() => {
    // 构建目录路径（包含所有父级）
    const buildPath = (catId, path = []) => {
      const cat = (categories || []).find(c => c.id === catId)
      if (!cat) return path
      const newPath = [cat.name, ...path]
      if (cat.parentId) {
        return buildPath(cat.parentId, newPath)
      }
      return newPath
    }

    const buildOptions = (cats, parentId = null, level = 0) => {
      const children = (categories || []).filter(c => 
        (parentId === null && !c.parentId) || (c.parentId && c.parentId === parentId)
      )
      return children.flatMap(cat => {
        const path = buildPath(cat.id)
        const label = path.length > 1 ? path.join(' > ') : path[0]
        return [
          {
            value: cat.id,
            label: '  '.repeat(level) + label
          },
          ...buildOptions(cats, cat.id, level + 1)
        ]
      })
    }
    return [
      { value: null, label: '无目录' },
      ...buildOptions(categories)
    ]
  }, [categories])

  // 处理修改目录
  const handleChangeCategory = async () => {
    if (!selectedNoteId) return
    
    try {
      // 获取笔记数据
      const note = notes.find(n => n.id === selectedNoteId)
      if (!note) {
        message.error('笔记不存在')
        return
      }

      // 更新笔记的目录
      await window.go.backend.App.UpdateNoteMD(
        note.id,
        note.title || '',
        note.language || 'md',
        note.contentMd || '',
        selectedCategoryId || 0
      )
      
      message.success('目录修改成功')
      setCategoryModalVisible(false)
      setSelectedNoteId(null)
      setSelectedCategoryId(null)
      
      // 刷新列表
      await loadAll()
    } catch (e) {
      console.error('修改目录失败:', e)
      message.error('修改目录失败: ' + (e?.message || '未知错误'))
    }
  }

  // 打开修改目录对话框
  const openCategoryModal = (noteId, currentCategoryId) => {
    setSelectedNoteId(noteId)
    setSelectedCategoryId(currentCategoryId || null)
    setCategoryModalVisible(true)
  }

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
        <Button
          icon={<CodeOutlined />}
          onClick={() => {
            if (!activeCategory) {
              message.warning('请先选择一个目录')
              return
            }
            // 导航到 NotesTab，并传递 noteType: 2 标记
            onNavigate('notes', {
              type: 'note',
              mode: 'create',
              noteType: 2,
              categoryId: activeCategory
            })
          }}
          size="middle"
          disabled={!activeCategory}
          title={activeCategory ? '创建命令行工具' : '请先选择目录'}
        >
          命令行工具
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
        <Button
          icon={<DeleteOutlined />}
          onClick={handleDeleteCategory}
          size="middle"
          disabled={!canDeleteCategory}
          danger
          title={canDeleteCategory ? '删除目录' : '目录下有内容，无法删除'}
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
                  const isScript = note.type === 2
                  const bgUrl = (isPDF || isScript) ? null : extractFirstImageUrl(note.contentMd)
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
                      {/* 右上角按钮 */}
                      {!isPDF && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            alignItems: 'flex-end',
                          }}
                        >
                          {isScript && (
                            <Button
                              size="small"
                              type="text"
                              icon={<PlayCircleOutlined />}
                              style={{
                                color: '#52c41a',
                                padding: '2px 4px',
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                // 导航到查看页面，并标记需要自动执行
                                const cid = note.categoryId ?? activeCategory
                                if (ensureUnlocked && cid != null) {
                                  ensureUnlocked(cid, '内容').then((ok) => {
                                    if (!ok) return
                                    onNavigate(null, {
                                      type: 'note',
                                      id: note.id,
                                      categoryId: note.categoryId,
                                      title: note.title,
                                      autoExecute: true
                                    })
                                  })
                                } else {
                                  onNavigate(null, {
                                    type: 'note',
                                    id: note.id,
                                    categoryId: note.categoryId,
                                    title: note.title,
                                    autoExecute: true
                                  })
                                }
                              }}
                              title="执行脚本"
                            />
                          )}
                          <Button
                            size="small"
                            type="text"
                            icon={<EditOutlined />}
                            style={{
                              color: '#00aeea',
                              padding: '2px 4px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              openNote('notes')
                            }}
                            title="编辑"
                          />
                          <Button
                            size="small"
                            type="text"
                            icon={<FolderOutlined />}
                            style={{
                              color: '#00aeea',
                              padding: '2px 4px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              openCategoryModal(note.id, note.categoryId)
                            }}
                            title="修改目录"
                          />
                        </div>
                      )}
                      <div>
                        <Typography.Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8,color: bgUrl ? 'rgba(255,255,255,0.85)' : undefined }}>
                          {isPDF && <FilePdfOutlined style={{ marginRight: 6, color: '#ff4d4f' }} />}
                          {note.type === 2 && <CodeOutlined style={{ marginRight: 6, color: '#1890ff' }} />}
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
              const isScript = note.type === 2
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
                        onClick={(e) => {
                          e.stopPropagation()
                          // 导航到查看页面，并标记需要自动执行
                          const cid = note.categoryId ?? activeCategory
                          if (ensureUnlocked && cid != null) {
                            ensureUnlocked(cid, '内容').then((ok) => {
                              if (!ok) return
                              onNavigate(null, {
                                type: 'note',
                                id: note.id,
                                categoryId: note.categoryId,
                                title: note.title,
                                autoExecute: true
                              })
                            })
                          } else {
                            onNavigate(null, {
                              type: 'note',
                              id: note.id,
                              categoryId: note.categoryId,
                              title: note.title,
                              autoExecute: true
                            })
                          }
                        }}
                        title="执行脚本"
                      />
                    ),
                    !isPDF && (
                      <Button
                        key="edit"
                        size="small"
                        type="link"
                        icon={<EditOutlined />}
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
                        openCategoryModal(note.id, note.categoryId)
                      }}
                      title="修改目录"
                    />
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
                        {isScript && <CodeOutlined style={{ marginRight: 6, color: '#1890ff' }} />}
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

      {/* 修改目录对话框 */}
      <Modal
        title="修改目录"
        open={categoryModalVisible}
        onOk={handleChangeCategory}
        onCancel={() => {
          setCategoryModalVisible(false)
          setSelectedNoteId(null)
          setSelectedCategoryId(null)
        }}
        okText="确定"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text>选择新目录：</Typography.Text>
        </div>
        <Select
          style={{ width: '100%' }}
          value={selectedCategoryId}
          onChange={setSelectedCategoryId}
          placeholder="请选择目录"
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={categoryOptions}
        />
      </Modal>

    </div>
  )
}

