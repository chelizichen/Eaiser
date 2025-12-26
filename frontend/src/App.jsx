import React, { useEffect, useRef, useState } from 'react'
import { Layout, Button, message, ConfigProvider, Breadcrumb, Tooltip, theme, Empty, Modal } from 'antd'
import { ArrowLeftOutlined, BulbOutlined, BulbFilled, ColumnWidthOutlined, CloseOutlined, SettingOutlined, FileTextOutlined } from '@ant-design/icons'
import CategorySidebar from './components/CategorySidebar.jsx'
import ContentViewer from './components/ContentViewer.jsx'
import CategoryView from './components/CategoryView.jsx'
import NotesTab from './components/NotesTab.jsx'
import TOCViewer from './components/TOCViewer.jsx'
import AIChatTab from './components/AIChatTab.jsx'
import AIConfigPanel from './components/AIConfigPanel.jsx'

const { Sider, Content } = Layout
const MIN_PANE_RATIO = 0.2

export default function App() {
  const [categories, setCategories] = useState([])
  const [listVersion, setListVersion] = useState(0) // 用于刷新 CategoryView 列表
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // 从 localStorage 读取主题设置，默认为亮色
    const saved = localStorage.getItem('theme')
    return saved === 'dark'
  })
  const [panes, setPanes] = useState(() => [
    {
      id: 'pane-1',
      activeCategory: null,
      selectedItem: null,
      currentView: 'category', // 'category' | 'notes' | 'blank' | 'toc' | 'ai'
      editingNote: null,
      tocData: null, // { headings, onHeadingClick, sourcePaneId } 用于目录 pane
    },
  ])
  const [paneWidths, setPaneWidths] = useState([1])
  const [activePaneId, setActivePaneId] = useState('pane-1')
  const [dragging, setDragging] = useState(null)
  const [configModalVisible, setConfigModalVisible] = useState(false)
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [logContent, setLogContent] = useState('')
  const [loadingLog, setLoadingLog] = useState(false)
  const containerRef = useRef(null)

  const activePane = panes.find(p => p.id === activePaneId) || panes[0]
  const sidebarActiveCategory = activePane?.activeCategory ?? null

  async function refreshCategories() {
    try {
      const list = await window.go.backend.App.ListCategories()
      setCategories(list || [])
    } catch (e) {
      message.error('分类加载失败')
    }
  }

  useEffect(() => { refreshCategories() }, [])

  // 当当前面板为 notes 时自动刷新目录（例如笔记编辑后目录结构可能变化）
  useEffect(() => {
    if (!panes.length) return
    const current = panes.find(p => p.id === activePaneId) || panes[0]
    if (current?.currentView === 'notes') {
      refreshCategories()
    }
  }, [panes, activePaneId])

  useEffect(() => {
    if (panes.length && !panes.find(p => p.id === activePaneId)) {
      setActivePaneId(panes[0].id)
    }
  }, [panes, activePaneId])

  // 监听菜单栏的刷新事件和开发者工具事件
  useEffect(() => {
    if (window.runtime) {
      window.runtime.EventsOn('menu-refresh', () => {
        window.location.reload()
      })
    }
    return () => {
      if (window.runtime) {
        window.runtime.EventsOff('menu-refresh')
      }
    }
  }, [])

  function focusPane(paneId) {
    setActivePaneId(paneId)
  }

  // 切换主题并保存到 localStorage
  function toggleTheme() {
    setIsDarkMode(prev => {
      const newMode = !prev
      localStorage.setItem('theme', newMode ? 'dark' : 'light')
      // 通知后端主题变化（用于窗口外观控制）
      if (window.go?.backend?.App?.SetTheme) {
        window.go.backend.App.SetTheme(newMode)
      }
      return newMode
    })
  }

  // 读取日志文件
  async function loadLogFile() {
    setLoadingLog(true)
    try {
      const content = await window.go.backend.App.ReadLogFile()
      setLogContent(content || '日志文件为空')
    } catch (e) {
      message.error(`读取日志失败: ${e.message || e}`)
      setLogContent(`读取日志失败: ${e.message || e}`)
    } finally {
      setLoadingLog(false)
    }
  }

  // 打开日志查看弹窗
  function openLogModal() {
    setLogModalVisible(true)
    loadLogFile()
  }

  function updatePaneState(paneId, updater) {
    setPanes(prev =>
      prev.map(p => {
        if (p.id !== paneId) return p
        const patch = typeof updater === 'function' ? updater(p) : updater
        return { ...p, ...patch }
      })
    )
  }

  async function handleSelectCategory(catId) {
    const paneId = activePaneId
    const cid = catId == null ? null : Number(catId)
    if (cid === null || Number.isNaN(cid)) {
      updatePaneState(paneId, {
        activeCategory: null,
        selectedItem: null,
        currentView: 'category',
        editingNote: null,
      })
      return
    }
    const target = categories.find(c => c.id === cid)
    const isEncrypted = target?.colorPreset?.encrypted
    if (isEncrypted) {
      const ok = await ensureUnlocked(cid, '目录')
      if (!ok) return
    }
    updatePaneState(paneId, {
      activeCategory: cid,
      selectedItem: null,
      currentView: 'category',
      editingNote: null,
    })
  }

  async function ensureUnlocked(catId, targetLabel = '目录') {
    const cid = catId == null ? null : Number(catId)
    if (cid === null || Number.isNaN(cid)) return true
    const target = categories.find(c => c.id === cid)
    const isEncrypted = target?.colorPreset?.encrypted
    if (!isEncrypted) return true
    try {
      await window.go.backend.App.RequireBiometric(`解锁加密${targetLabel}`)
      return true
    } catch (e) {
      message.warning(`加密${targetLabel}未通过验证`)
      return false
    }
  }

  async function handleSelectItem(item) {
    if (!item) return
    const paneId = activePaneId
    console.log('handleSelectItem.item', item)
    console.log('handleSelectItem.paneId', paneId)
    const pane = panes.find(p => p.id === paneId)
    console.log('handleSelectItem.pane', pane)
    const cid = item.categoryId ?? pane?.activeCategory ?? null
    const ok = await ensureUnlocked(cid, '内容')
    if (!ok) return
    focusPane(paneId)
    updatePaneState(paneId, {
      selectedItem: item,
      currentView: item.type === 'note' ? 'category' : 'category',
      editingNote: null,
      activeCategory: cid,
    })
  }

  function handleNavigate(paneId, view, item = null) {
    focusPane(paneId)
    setPanes(prev =>
      prev.map(p => {
        if (p.id !== paneId) return p
        const next = { ...p }
        // 处理 AI 视图
        if (view === 'ai' || (item && item.type === 'ai')) {
          next.currentView = 'ai'
          next.selectedItem = null
          next.editingNote = null
          next.activeCategory = item?.categoryId ?? next.activeCategory
          return next
        }
        // 处理编辑模式或创建命令行工具模式
        if (item && item.type === 'note' && (item.mode === 'edit' || item.mode === 'create' || item.noteType === 2)) {
          next.editingNote = item
          next.selectedItem = null
          next.currentView = 'notes'
          next.activeCategory = item.categoryId ?? next.activeCategory
          return next
        }
        if (view) {
          next.currentView = view
          if (view !== 'notes') next.editingNote = null
          if (view !== 'category' && view !== 'ai') next.selectedItem = null
        }
        if (item) {
          next.selectedItem = item
          if (item.type === 'note') {
            next.currentView = 'category'
          }
          next.activeCategory = item.categoryId ?? next.activeCategory
        }
        return next
      })
    )
  }

  function handleNoteSaved(paneId) {
    message.success('保存成功')
    setListVersion(v => v + 1)
    setPanes(prev =>
      prev.map(p =>
        p.id === paneId
          ? { ...p, currentView: 'category', selectedItem: null, editingNote: null }
          : p
      )
    )
  }

  function currentPath(targetPane) {
    const targetId =
      targetPane?.selectedItem && targetPane.selectedItem.categoryId
        ? targetPane.selectedItem.categoryId
        : targetPane?.activeCategory
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

  function splitPane(paneId) {
    setPanes(prev => {
      const idx = prev.findIndex(p => p.id === paneId)
      if (idx === -1) return prev
      const currentPane = prev[idx]
      const newId = `pane-${Date.now()}`
      // 复制当前 pane 的所有状态到新 pane
      const nextPane = {
        id: newId,
        activeCategory: currentPane.activeCategory,
        selectedItem: currentPane.selectedItem,
        currentView: currentPane.currentView,
        editingNote: currentPane.editingNote,
        tocData: currentPane.tocData,
      }
      const next = [...prev.slice(0, idx + 1), nextPane, ...prev.slice(idx + 1)]
      setActivePaneId(newId)
      return next
    })
    setPaneWidths(prev => {
      const idx = panes.findIndex(p => p.id === paneId)
      const base = prev[idx] ?? 1
      const left = Math.max(base / 2, MIN_PANE_RATIO)
      const right = Math.max(base - left, MIN_PANE_RATIO)
      const next = [...prev.slice(0, idx), left, right, ...prev.slice(idx + 1)]
      const total = next.reduce((a, b) => a + b, 0)
      return next.map(w => w / total)
    })
  }

  function closePane(paneId) {
    if (panes.length <= 1) return
    setPanes(prev => {
      const idx = prev.findIndex(p => p.id === paneId)
      if (idx === -1) return prev
      const next = prev.filter(p => p.id !== paneId)
      const nextActive = prev[idx + 1]?.id || prev[idx - 1]?.id || next[0]?.id
      setActivePaneId(nextActive || (next[0]?.id ?? 'pane-1'))
      return next
    })
    setPaneWidths(prev => {
      const idx = panes.findIndex(p => p.id === paneId)
      if (idx === -1) return prev
      const next = prev.filter((_, i) => i !== idx)
      if (!next.length) return [1]
      const total = next.reduce((a, b) => a + b, 0)
      return next.map(w => w / total)
    })
  }

  function startResize(index, event) {
    event.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return
    setDragging({
      index,
      startX: event.clientX,
      baseWidths: [...paneWidths],
      containerWidth: rect.width,
    })
  }

  useEffect(() => {
    function handleMouseMove(e) {
      if (!dragging) return
      const { index, startX, baseWidths, containerWidth } = dragging
      const deltaPx = e.clientX - startX
      const totalBase = baseWidths.reduce((a, b) => a + b, 0)
      const deltaRatio = (deltaPx / containerWidth) * totalBase
      const leftBase = baseWidths[index]
      const rightBase = baseWidths[index + 1]
      const pairSum = leftBase + rightBase
      let left = leftBase + deltaRatio
      const min = MIN_PANE_RATIO
      left = Math.max(min, Math.min(pairSum - min, left))
      const right = pairSum - left
      const next = [...baseWidths]
      next[index] = left
      next[index + 1] = right
      const total = next.reduce((a, b) => a + b, 0)
      setPaneWidths(next.map(w => w / total))
    }
    function handleMouseUp() {
      if (dragging) setDragging(null)
    }
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging])

  const canClosePane = panes.length > 1
  const headerPath = currentPath(activePane)
  const headerSelectedItem = activePane?.selectedItem

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#2f80ed',
          colorInfo: '#2f80ed',
          borderRadius: 12,
          controlHeight: 36,
          fontSize: 14,
          ...(isDarkMode ? {} : {
            colorText: '#1d2129',
            colorTextSecondary: '#69727d'
          })
        }
      }}
    >
      <div className={isDarkMode ? 'theme-dark' : 'theme-light'} style={{ height: '100%' }}>
      <Layout style={{ height: '100%' }}>
        {/* 顶部可拖动区域 */}
        <Sider width={280} theme={isDarkMode ? 'dark' : 'light'}>
          <CategorySidebar
            categories={categories}
            activeCategory={sidebarActiveCategory}
            onSelect={handleSelectCategory}
            onSelectItem={handleSelectItem}
            onChanged={refreshCategories}
          />
        </Sider>
        <Content style={{ padding: 16, paddingTop: 0 }}>
          <div className="title-bar"></div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            {(activePane?.currentView !== 'category' || headerSelectedItem) && (
              <Button 
                icon={<ArrowLeftOutlined />} 
                onClick={() => {
                  if (headerSelectedItem) {
                    updatePaneState(activePaneId, { selectedItem: null })
                    focusPane(activePaneId)
                  } else {
                    handleNavigate(activePaneId, 'category')
                  }
                }}
                >
                返回
              </Button>
            )}
            <Breadcrumb style={{ flex: 1 }}>
              {headerPath.length === 0 ? (
                <Breadcrumb.Item>全部</Breadcrumb.Item>
              ) : (
                <>
                  {headerPath.map(seg => (
                    <Breadcrumb.Item key={seg.id}>{seg.name}</Breadcrumb.Item>
                  ))}
                  {headerSelectedItem && (
                    <Breadcrumb.Item>
                      <Tooltip title={headerSelectedItem.title}>
                        <span>{headerSelectedItem.title}</span>
                      </Tooltip>
                    </Breadcrumb.Item>
                  )}
                </>
              )}
            </Breadcrumb>
            <Tooltip title="AI 配置">
              <Button 
                type="text"
                icon={<SettingOutlined />}
                onClick={() => setConfigModalVisible(true)}
              />
            </Tooltip>
            <Tooltip title={isDarkMode ? '切换到亮色模式' : '切换到暗色模式'}>
              <Button 
                type="text"
                icon={isDarkMode ? <BulbFilled /> : <BulbOutlined />}
                onClick={toggleTheme}
              />
            </Tooltip>
            <Tooltip title="查看日志">
              <Button 
                type="text"
                icon={<FileTextOutlined />}
                onClick={openLogModal}
              />
            </Tooltip>
          </div>

          <div className="pane-container" ref={containerRef}>
            {panes.map((pane, idx) => {
              const isActive = pane.id === activePaneId && panes.length > 1
              const paneContent = (() => {
                if (pane.selectedItem) {
                  return (
                    <ContentViewer
                      item={pane.selectedItem}
                      categories={categories}
                      isDarkMode={isDarkMode}
                      onCategoryChanged={refreshCategories}
                      onEdit={({ item: it, data }) => {
                        const targetId = it?.id || data?.id
                        const targetCategory = it?.categoryId || data?.categoryId
                        const targetTitle = data?.title || it?.title
                        if (!targetId) return
                        handleNavigate(pane.id, 'notes', {
                          type: 'note',
                          id: targetId,
                          categoryId: targetCategory,
                          title: targetTitle,
                          mode: 'edit',
                        })
                      }}
                      onSplitPane={() => splitPane(pane.id)}
                      onClosePane={() => closePane(pane.id)}
                      canClose={canClosePane}
                      isActive={isActive}
                      onOpenTOC={(headings, onHeadingClick, options = {}) => {
                        const sourcePaneId = pane.id // 保存源 pane ID
                        
                        // 创建一个包装的回调，只实现高亮功能
                        const wrappedOnHeadingClick = (headingId) => {
                          // 查找所有 pane 中的内容容器，找到包含该标题的那个
                          const allViewerContents = document.querySelectorAll('.viewer-content')
                          let targetElement = null
                          
                          // 遍历所有内容容器，查找包含目标标题的容器
                          for (const container of allViewerContents) {
                            // 尝试通过 ID 查找
                            let element = container.querySelector(`#${headingId}`)
                            if (!element) {
                              // 如果通过 ID 找不到，尝试查找所有 h1-h6，然后通过文本匹配
                              const allHeadings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
                              for (const heading of allHeadings) {
                                const headingIdFromElement = heading.id || heading.getAttribute('data-id') || ''
                                if (headingIdFromElement === headingId) {
                                  element = heading
                                  break
                                }
                              }
                            }
                            
                            if (element) {
                              targetElement = element
                              break
                            }
                          }
                          console.log('targetElement', targetElement)
                          if (targetElement) {
                            // 高亮
                            const originalBg = targetElement.style.backgroundColor
                            const originalTransition = targetElement.style.transition
                            targetElement.style.transition = 'background-color 0.3s'
                            targetElement.style.backgroundColor = 'rgba(47, 128, 237, 0.15)'
                            setTimeout(() => {
                              targetElement.style.backgroundColor = originalBg
                              setTimeout(() => {
                                targetElement.style.transition = originalTransition
                              }, 300)
                            }, 1500)
                            targetElement.click();
                            targetElement.scrollIntoView({ behavior: 'smooth',block:'start' });
                          } else {
                            // 回退到原始回调
                            if (onHeadingClick) {
                              onHeadingClick(headingId)
                            }
                          }
                        }
                        
                        // 只允许存在一个 TOC 目录面板：
                        // - 如果已存在 TOC pane，则复用并更新其 tocData
                        // - 否则创建新的 TOC pane
                        // - 当 options.onlyUpdate 为 true 时，只同步已有 TOC，不自动创建或抢占焦点
                        setPanes(prev => {
                          if (!prev.length) return prev

                          const sourceIdx = prev.findIndex(p => p.id === sourcePaneId)
                          if (sourceIdx === -1) return prev

                          // 查找是否已经存在 TOC 面板
                          const existingTocIdx = prev.findIndex(p => p.currentView === 'toc')
                          if (existingTocIdx !== -1) {
                            const existingPane = prev[existingTocIdx]
                            const next = prev.map((p, idx) =>
                              idx === existingTocIdx
                                ? {
                                    ...p,
                                    tocData: {
                                      headings,
                                      onHeadingClick: wrappedOnHeadingClick,
                                      sourcePaneId,
                                    },
                                  }
                                : p
                            )
                            // 仅在非同步模式下才切换焦点到 TOC 面板
                            if (!options.onlyUpdate) {
                              setActivePaneId(existingPane.id)
                            }
                            return next
                          }

                          // 仅同步模式下，不自动创建 TOC 面板
                          if (options.onlyUpdate) {
                            return prev
                          }

                          // 不存在 TOC 面板时，新建一个
                          const newId = `pane-${Date.now()}`
                          const newPane = {
                            id: newId,
                            activeCategory: null,
                            selectedItem: null,
                            currentView: 'toc',
                            editingNote: null,
                            tocData: { headings, onHeadingClick: wrappedOnHeadingClick, sourcePaneId },
                          }
                          const nextPanes = [
                            ...prev.slice(0, sourceIdx + 1),
                            newPane,
                            ...prev.slice(sourceIdx + 1),
                          ]

                          // 在同一个更新周期内更新宽度
                          setPaneWidths(prevWidths => {
                            const base = prevWidths[sourceIdx] ?? 1
                            const left = Math.max(base / 2, MIN_PANE_RATIO)
                            const right = Math.max(base - left, MIN_PANE_RATIO)
                            const next = [
                              ...prevWidths.slice(0, sourceIdx),
                              left,
                              right,
                              ...prevWidths.slice(sourceIdx + 1),
                            ]
                            const total = next.reduce((a, b) => a + b, 0)
                            return next.map(w => w / total)
                          })

                          setActivePaneId(newId)
                          return nextPanes
                        })
                      }}
                    />
                  )
                }
                if (pane.currentView === 'notes') {
                  return (
                    <NotesTab
                      activeCategory={pane.activeCategory}
                      editingNote={pane.editingNote}
                      onSaved={() => handleNoteSaved(pane.id)}
                      onSplitPane={() => splitPane(pane.id)}
                      onClosePane={() => closePane(pane.id)}
                      canClose={canClosePane}
                    />
                  )
                }
                if (pane.currentView === 'category') {
                  if (pane.activeCategory == null && panes.length > 1 && listVersion >= 0) {
                    return <Empty description="请选择左侧目录或文件以在此面板展示" />
                  }
                  return (
                    <CategoryView
                      activeCategory={pane.activeCategory}
                      onNavigate={(view, item) => handleNavigate(pane.id, view, item)}
                      reloadToken={listVersion}
                      categories={categories}
                      ensureUnlocked={ensureUnlocked}
                      onCategoryChanged={refreshCategories}
                      isDarkMode={isDarkMode}
                    />
                  )
                }
                if (pane.currentView === 'toc' && pane.tocData) {
                  return (
                    <div className="pane-viewer">
                      <div className="pane-actions-inline">
                        <Button
                          type="text"
                          size="small"
                          icon={<ColumnWidthOutlined />}
                          onClick={() => splitPane(pane.id)}
                          title="分屏"
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<CloseOutlined />}
                          onClick={() => closePane(pane.id)}
                          disabled={!canClosePane}
                          title="关闭面板"
                        />
                      </div>
                      <TOCViewer
                        headings={pane.tocData.headings}
                        onHeadingClick={pane.tocData.onHeadingClick}
                      />
                    </div>
                  )
                }
                if (pane.currentView === 'ai') {
                  return (
                    <AIChatTab
                      activeCategory={pane.activeCategory}
                      categories={categories}
                      onSplitPane={() => splitPane(pane.id)}
                      onClosePane={() => closePane(pane.id)}
                      canClose={canClosePane}
                      ensureUnlocked={ensureUnlocked}
                    />
                  )
                }
                return <Empty description="请选择左侧目录或文件以在此面板展示" />
              })()

              return (
                <React.Fragment key={pane.id}>
                  <div
                    className={`pane-shell ${isActive ? 'pane-shell-active' : ''}`}
                    style={{ flex: paneWidths[idx] ?? 1 }}
                    onClick={() => focusPane(pane.id)}
                  >
                    <div className="pane-inner">
                      {((pane.currentView === 'category' && !pane.selectedItem) || pane.currentView === 'blank') && (
                        <div className="pane-header-actions">
                          <div style={{ display: 'flex', gap: 4 }}>
                            <Button
                              type="text"
                              size="small"
                              icon={<ColumnWidthOutlined />}
                              onClick={(e) => {
                                e.stopPropagation()
                                splitPane(pane.id)
                              }}
                            />
                            <Button
                              type="text"
                              size="small"
                              icon={<CloseOutlined />}
                              disabled={!canClosePane}
                              onClick={(e) => {
                                e.stopPropagation()
                                closePane(pane.id)
                              }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="pane-content">{paneContent}</div>
                    </div>
                  </div>
                  {idx < panes.length - 1 && (
                    <div className="pane-divider" onMouseDown={(e) => startResize(idx, e)} />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </Content>
      </Layout>
      </div>

      {/* AI 配置对话框 */}
      <Modal
        title="AI 配置"
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <AIConfigPanel onClose={() => setConfigModalVisible(false)} />
      </Modal>

      {/* 日志查看对话框 */}
      <Modal
        title="日志文件"
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        onOk={() => loadLogFile()}
        okText="刷新"
        width={900}
        style={{ top: 20 }}
        bodyStyle={{ maxHeight: '80vh', overflow: 'auto' }}
      >
        <pre style={{ 
          margin: 0, 
          padding: 0,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
          fontSize: '12px',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
          {loadingLog ? '加载中...' : logContent}
        </pre>
      </Modal>
    </ConfigProvider>
  )
}
