import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Button, Card, List, Typography, Empty, Input, Alert, message, Modal, Select } from 'antd'
import { FileTextOutlined, SearchOutlined, AppstoreOutlined, UnorderedListOutlined, FilePdfOutlined, FolderOutlined, EditOutlined, DeleteOutlined, CodeOutlined, PlayCircleOutlined, RobotOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import extractFirstImageUrl from '../lib/extractFirstImageurl'
import striptags from 'striptags'

// 提取内容预览文本（去除 markdown 语法，返回纯文本）
function extractContentPreview(content, maxLength = 150) {
  let text = striptags(content)
  // 截取指定长度
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...'
  }
  
  return text
}

export default function CategoryView({ activeCategory, onNavigate, reloadToken, categories, ensureUnlocked, onCategoryChanged, isDarkMode = false }) {
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
          icon={<RobotOutlined />}
          onClick={() => {
            onNavigate('ai', {
              type: 'ai',
              categoryId: activeCategory
            })
          }}
          size="middle"
          title="AI 交互"
        >
          AI 助手
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
        <Card 
          title={`笔记 (${filteredNotes.length}/${notes.length})`} 
          size="small" 
          style={{
            background: isDarkMode ? '#2d2d2d' : 'rgba(0,0,0,.02)'
          }} 
        >
          <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: 6 }}>
            {viewMode === 'card' ? (
              <div style={{ 
                columnGap: 20,
                columnFill: 'balance',  // 平衡各列高度
                columns: '280px auto',  // 关键：每列最小 280px，自动创建列数（可调整为 300px 等）
              }}>
                {filteredNotes.map((note) => {
                  const isPDF = note.type === 1
                  const isScript = note.type === 2
                  const imageUrl = (isPDF || isScript) ? null : extractFirstImageUrl(note.contentMd)
                  const contentPreview = extractContentPreview(note.contentMd || '')
                  const contentPreviewToArr = contentPreview.split('\n')
                  const categoryName = categoryMap.get(note.categoryId) || '未知目录'
                  const updatedTime = dayjs(note.updatedAt).format('YYYY-MM-DD HH:mm')
                  
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
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: `1px solid ${isDarkMode ? '#525151' : 'rgb(245, 226, 226)'}`,
                        transition: 'all 0.3s ease',
                        breakInside: 'avoid', 
                        marginBottom: 20,
                        width: '100%',                // 新增：确保卡片填满列宽
                        maxWidth: 'none',             // 移除 maxWidth 限制，否则可能不响应
                        minWidth: 'auto',             // 移除 minWidth，或设小值
                        display: 'inline-block',      // 新增：关键！许多教程推荐，帮助 columns 正确流动
                        boxSizing: 'border-box',
                      }}
                      bodyStyle={{
                        padding: 0,
                      }}
                      onClick={() => openNote(null)}
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
                              onClick={(e) => {
                                e.stopPropagation()
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
                              color: '#1890ff',
                              padding: '2px 6px',
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
                              color: '#1890ff',
                              padding: '2px 6px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              openCategoryModal(note.id, note.categoryId)
                            }}
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
                        {/* 内容预览 */}
                        {contentPreviewToArr && contentPreviewToArr.length && (contentPreviewToArr.map(v=>{
                          return <Typography.Text 
                                  type="secondary"
                                  style={{ 
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    marginTop:12,
                                  }}
                                >
                                  {v}
                              </Typography.Text>
                          })
                        )}
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

