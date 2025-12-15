import React, { useEffect, useState } from 'react'
import { Layout, Button, message, ConfigProvider, Breadcrumb, Tooltip } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import CategorySidebar from './components/CategorySidebar.jsx'
import ContentViewer from './components/ContentViewer.jsx'
import CategoryView from './components/CategoryView.jsx'
import NotesTab from './components/NotesTab.jsx'

const { Sider, Content } = Layout

export default function App() {
  const [activeCategory, setActiveCategory] = useState(null)
  const [categories, setCategories] = useState([])
  const [selectedItem, setSelectedItem] = useState(null) // { type: 'note', id: number }
  const [currentView, setCurrentView] = useState('category') // 'category' | 'notes'
  const [listVersion, setListVersion] = useState(0) // 用于刷新 CategoryView 列表
  const [editingNote, setEditingNote] = useState(null) // 当前正在编辑的笔记

  async function refreshCategories() {
    try {
      const list = await window.go.backend.App.ListCategories()
      setCategories(list || [])
    } catch (e) {
      message.error('分类加载失败')
    }
  }

  useEffect(() => { refreshCategories() }, [])

  useEffect(() => { 
    setSelectedItem(null)
    setCurrentView('category') // 切换目录时回到目录视图
  }, [activeCategory])

  function handleNavigate(view, item = null) {
    // 如果是从列表点击“编辑”进入
    if (item && item.type === 'note' && item.mode === 'edit') {
      setEditingNote(item)
      setSelectedItem(null)
      setCurrentView('notes')
      return
    }

    if (view) {
      setCurrentView(view)
      // 进入某个视图时，清空当前查看项与编辑状态
      if (view !== 'notes') {
        setEditingNote(null)
      }
      if (view !== 'category') {
        setSelectedItem(null)
      }
    }

    if (item) {
      setSelectedItem(item)
      // 如果选中了项目，根据类型设置对应的视图（用于面包屑显示）
      if (item.type === 'note') {
        setCurrentView('notes')
      }
    }
  }

  function currentPath() {
    const targetId = selectedItem && selectedItem.categoryId ? selectedItem.categoryId : activeCategory
    if (!targetId) return []
    const map = new Map()
    categories.forEach(c => map.set(c.id, c))
    const path = []
    let cur = map.get(targetId)
    while (cur) {
      path.unshift({ id: cur.id, name: cur.name })
      cur = cur.parentId ? map.get(cur.parentId) : null
    }
    return path
  }

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2f80ed',
          colorInfo: '#2f80ed',
          borderRadius: 12,
          controlHeight: 36,
          fontSize: 14,
          colorText: '#1d2129',
          colorTextSecondary: '#69727d'
        }
      }}
    >
      <Layout style={{ height: '100%' }}>
        <Sider width={280} theme="light">
          <CategorySidebar
            categories={categories}
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
            onSelectItem={setSelectedItem}
            onChanged={refreshCategories}
          />
        </Sider>
        <Content style={{ padding: 16 }}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            {(currentView !== 'category' || selectedItem) && (
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => {
                  if (selectedItem) {
                    setSelectedItem(null)
                    setCurrentView('category')
                  } else {
                    handleNavigate('category')
                  }
                }}
                >
                返回
              </Button>
            )}
            <Breadcrumb style={{ flex: 1 }}>
              {currentPath().length === 0 ? (
                <Breadcrumb.Item>全部</Breadcrumb.Item>
              ) : (
                <>
                  {currentPath().map(seg => (
                    <Breadcrumb.Item key={seg.id}>{seg.name}</Breadcrumb.Item>
                  ))}
                  {selectedItem && (
                    <Breadcrumb.Item>
                      <Tooltip title={selectedItem.title}>
                        <span>{selectedItem.title}</span>
                      </Tooltip>
                    </Breadcrumb.Item>
                  )}
                </>
              )}
            </Breadcrumb>
          </div>
          
          {selectedItem ? (
            <ContentViewer item={selectedItem} />
          ) : currentView === 'category' ? (
            <CategoryView 
              activeCategory={activeCategory} 
              onNavigate={handleNavigate}
              reloadToken={listVersion}
            />
          ) : currentView === 'notes' ? (
            <NotesTab 
              activeCategory={activeCategory} 
              editingNote={editingNote}
              onSaved={() => {
                message.success('保存成功')
                setListVersion(v => v + 1)
                setEditingNote(null)
                handleNavigate('category')
              }} 
            />
          ) : null}
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
