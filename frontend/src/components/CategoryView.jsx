import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Button, Card, List, Typography, Empty, Input, Alert, message, Modal, Select } from 'antd'
import { FileTextOutlined, SearchOutlined, AppstoreOutlined, UnorderedListOutlined, FilePdfOutlined, FolderOutlined, EditOutlined, DeleteOutlined, CodeOutlined, PlayCircleOutlined, RobotOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import extractFirstImageUrl from '../lib/extractFirstImageurl'
import { renderMarkdown } from '../lib/markdown'
import { isLocalImagePath, extractRelativePath, loadLocalImage, processLocalImagesInHtml } from '../lib/imageUtils'
import NoteCard from './NoteCard'
import NoteListItem from './NoteListItem'

export default function CategoryView({ activeCategory, onNavigate, reloadToken, categories, ensureUnlocked, onCategoryChanged, isDarkMode = false }) {
  const [imageUrlMap, setImageUrlMap] = useState({}) // { noteId: base64Url }
  const [contentPreviewMap, setContentPreviewMap] = useState({}) // { noteId: renderedHtml }
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

  // 处理本地图片和内容预览：将 local://images/ 格式转换为 base64，并渲染 Markdown
  useEffect(() => {
    const processNotes = async () => {
      const newImageUrlMap = {}
      const newContentPreviewMap = {}
      
      const promises = notes
        .filter(note => note.type !== 1 && note.type !== 2) // 只处理普通笔记
        .map(async (note) => {
          const contentMd = note.contentMd || ''
          if (!contentMd) return
          
          // 处理第一张图片（用于卡片封面）
          const rawUrl = extractFirstImageUrl(contentMd)
          if (rawUrl && isLocalImagePath(rawUrl)) {
            const relativePath = extractRelativePath(rawUrl)
            try {
              const base64Data = await loadLocalImage(relativePath)
              newImageUrlMap[note.id] = base64Data
            } catch (err) {
              console.error(`加载笔记 ${note.id} 的图片失败:`, err)
              newImageUrlMap[note.id] = null
            }
          }
          
          // 渲染 Markdown 内容预览
          const isHTML = contentMd.trim().startsWith('<')
          let html = isHTML ? contentMd : renderMarkdown(contentMd)
          
          // 处理预览中的本地图片
          html = await processLocalImagesInHtml(html, {
            imageStyle: { width: '100%', margin: '8px 0' }
          })
          
          // 限制预览长度：截取前 500 个字符的内容
          const maxPreviewLength = 500
          if (html.length > maxPreviewLength) {
            // 简单截取，保留 HTML 结构
            let truncated = html.substring(0, maxPreviewLength)
            const lastTag = truncated.lastIndexOf('<')
            if (lastTag > 0) {
              truncated = truncated.substring(0, lastTag)
            }
            html = truncated + '...'
          }
          
          newContentPreviewMap[note.id] = html
        })
      
      await Promise.all(promises)
      setImageUrlMap(newImageUrlMap)
      setContentPreviewMap(newContentPreviewMap)
    }
    
    if (notes.length > 0) {
      processNotes()
    }
  }, [notes])

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
                  const rawImageUrl = (note.type === 1 || note.type === 2) ? null : extractFirstImageUrl(note.contentMd)
                  const imageUrl = rawImageUrl && isLocalImagePath(rawImageUrl)
                    ? imageUrlMap[note.id] || null 
                    : rawImageUrl
                  const contentPreviewHtml = contentPreviewMap[note.id] || ''
                  const categoryName = categoryMap.get(note.categoryId) || '未知目录'
                  
                  return (
                    <NoteCard
                      key={note.id}
                      note={note}
                      imageUrl={imageUrl}
                      contentPreviewHtml={contentPreviewHtml}
                      categoryName={categoryName}
                      isDarkMode={isDarkMode}
                      onOpenNote={(mode, params) => onNavigate(mode, params)}
                      onEditNote={(params) => onNavigate('notes', params)}
                      onOpenCategoryModal={openCategoryModal}
                      onExecuteScript={(params) => onNavigate(null, params)}
                      ensureUnlocked={ensureUnlocked}
                      activeCategory={activeCategory}
                    />
                  )
                })}
              </div>
            ) : (
              <List
                dataSource={filteredNotes}
                renderItem={(note) => {
                  const categoryName = categoryMap.get(note.categoryId) || '未知目录'
                  return (
                    <NoteListItem
                      key={note.id}
                      note={note}
                      categoryName={categoryName}
                      onOpenNote={(params) => onNavigate(null, params)}
                      onEditNote={(params) => onNavigate('notes', params)}
                      onOpenCategoryModal={openCategoryModal}
                      onExecuteScript={(params) => onNavigate(null, params)}
                      ensureUnlocked={ensureUnlocked}
                      activeCategory={activeCategory}
                    />
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

