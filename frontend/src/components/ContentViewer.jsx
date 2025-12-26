import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { Button, Typography, Image, Select, Modal, message, Card, Alert, Collapse, Spin } from 'antd'
import { EditOutlined, ColumnWidthOutlined, CloseOutlined, UnorderedListOutlined, FolderOutlined, PlayCircleOutlined, CodeOutlined } from '@ant-design/icons'
import { renderMarkdown } from '../lib/markdown'
import { extractHeadings } from '../lib/extractHeadings'
import { processMarkdownHtml } from '../lib/imageUtils'
import PDFViewer from './PDFViewer'
import TOCViewer from './TOCViewer'
import ErrorBoundary from './ErrorBoundary'
import 'highlight.js/styles/github.css'
import hljs from 'highlight.js'

const { Panel } = Collapse

export default function ContentViewer({ item, onEdit, onSplitPane, onClosePane, canClose = true, onOpenTOC, categories = [] }) {
  const [data, setData] = useState(null)
  const [pdfPath, setPdfPath] = useState(null)
  const contentRef = useRef(null)
  const [previewImage, setPreviewImage] = useState({ visible: false, src: '' })
  const [categoryModalVisible, setCategoryModalVisible] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [executing, setExecuting] = useState(false)
  const [execResult, setExecResult] = useState(null)
  const [processedHtml, setProcessedHtml] = useState('')
  const [tocVisible, setTocVisible] = useState(true) // 目录是否可见
  const [tocWidth, setTocWidth] = useState(250) // 目录宽度（像素）
  const [isResizingTOC, setIsResizingTOC] = useState(false) // 是否正在调整目录宽度

  async function load() {
    if (!item) return
    if (item.type === 'note') {
      const list = await window.go.backend.App.ListNotes(null)
      const found = (list || []).find(n => n.id === item.id)
      setData(found || null)
    } else if (item.type === 'image') {
      const list = await window.go.backend.App.ListImages(null)
      const found = (list || []).find(i => i.id === item.id)
      setData(found || null)
    } else if (item.type === 'blender') {
      const list = await window.go.backend.App.ListBlender(null)
      const found = (list || []).find(b => b.id === item.id)
      setData(found || null)
    }
  }

  useEffect(() => { load() }, [item])

  // 当 data 加载后，设置当前目录 ID
  useEffect(() => {
    if (data) {
      setSelectedCategoryId(data.categoryId || null)
    }
  }, [data])

  // 自动执行脚本（当 item.autoExecute 为 true 且是 Type 2 笔记时）
  useEffect(() => {
    if (item?.autoExecute && data && data.type === 2 && data.id) {
      // 延迟一下，确保 UI 已经渲染
      const timer = setTimeout(async () => {
        setExecuting(true)
        setExecResult(null)
        
        try {
          const result = await window.go.backend.App.ExecuteScript(data.id)
          if (result) {
            setExecResult({
              stdout: result.stdout || '',
              stderr: result.stderr || '',
              success: result.success !== false
            })
            if (result.success) {
              message.success('脚本执行成功')
            } else {
              message.warning('脚本执行完成，但有错误输出')
            }
          } else {
            setExecResult({
              stdout: '',
              stderr: '未知错误',
              success: false
            })
            message.error('执行脚本失败: 未知错误')
          }
        } catch (e) {
          console.error('执行脚本失败:', e)
          const errorMsg = e?.message || '未知错误'
          setExecResult({ 
            stdout: '', 
            stderr: errorMsg, 
            success: false 
          })
          message.error('执行脚本失败: ' + errorMsg)
        } finally {
          setExecuting(false)
        }
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [item?.autoExecute, data?.id, data?.type])

  // 计算派生值（必须在所有 hooks 之前，但可以在 useEffect 之后）
  const raw = data?.contentMd || ''
  const html = renderMarkdown(raw)
  
  // 处理本地图片
  useEffect(() => {
    const processLocalImages = async () => {
      if (!html || !data || data.type === 1 || data.type === 2) {
        setProcessedHtml(html || '')
        return
      }
      
      // 使用 processMarkdownHtml 处理，它会从原始 Markdown 中恢复丢失的图片 src
      console.log('raw',raw);
      console.log('html',html);
      
      const processedHtml = await processMarkdownHtml(raw, html)
      setProcessedHtml(processedHtml)
    }
    
    processLocalImages()
  }, [html, raw, data])
  
  // 提取标题（必须在组件顶层调用，不能在条件渲染中）
  const headings = useMemo(() => {
    if (!data || !item || item.type !== 'note' || !item.id) {
      return []
    }
    if (!raw) {
      return []
    }
    try {
      // 统一使用 Markdown 格式提取标题
      const extracted = extractHeadings(raw, false)
      console.log('extracted',extracted);
      
      return extracted
    } catch (e) {
      console.error('Error extracting headings:', e)
      return []
    }
  }, [data, item, raw])

  // 处理标题点击，滚动到对应位置（必须在 headings 定义之后）
  const handleHeadingClick = useCallback((headingId) => {
    console.log('headingId',headingId);
    
    // 在容器内查找标题元素
    // 使用 data-heading-id 属性查找（避免 CSS id 命名规范冲突）
    let element = contentContainer.querySelector(`[data-heading-id="${headingId}"]`)
    console.log('element',element);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth',block:'start' });
      // 高亮一下（可选）
      const originalBg = element.style.backgroundColor
      const originalTransition = element.style.transition
      element.style.transition = 'background-color 0.3s'
      element.style.backgroundColor = 'rgba(47, 128, 237, 0.15)'
      setTimeout(() => {
        element.style.backgroundColor = originalBg
        setTimeout(() => {
          element.style.transition = originalTransition
        }, 300)
      }, 1500)
    }else{
    }
  }, [])

  // 切换目录显示/隐藏
  const handleToggleTOC = useCallback(() => {
    setTocVisible(prev => !prev)
  }, [])

  // 处理目录拖拽调整大小
  const handleTOCMouseDown = useCallback((e) => {
    e.preventDefault()
    setIsResizingTOC(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingTOC) return
      
      // 计算新的目录宽度（限制在 150px 到 400px 之间）
      const newWidth = e.clientX - (contentRef.current?.getBoundingClientRect().left || 0)
      const clampedWidth = Math.max(150, Math.min(400, newWidth))
      setTocWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizingTOC(false)
    }

    if (isResizingTOC) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizingTOC])

  // 处理执行脚本
  const handleExecuteScript = useCallback(async () => {
    if (!data || !data.id) return
    
    setExecuting(true)
    setExecResult(null)
    
    try {
      const result = await window.go.backend.App.ExecuteScript(data.id)
      // ExecuteScript 返回 ScriptResult 对象
      if (result) {
        setExecResult({
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          success: result.success !== false
        })
        if (result.success) {
          message.success('脚本执行成功')
        } else {
          message.warning('脚本执行完成，但有错误输出')
        }
      } else {
        setExecResult({
          stdout: '',
          stderr: '未知错误',
          success: false
        })
        message.error('执行脚本失败: 未知错误')
      }
    } catch (e) {
      console.error('执行脚本失败:', e)
      const errorMsg = e?.message || '未知错误'
      setExecResult({ 
        stdout: '', 
        stderr: errorMsg, 
        success: false 
      })
      message.error('执行脚本失败: ' + errorMsg)
    } finally {
      setExecuting(false)
    }
  }, [data])

  // 处理修改目录
  const handleChangeCategory = useCallback(async () => {
    if (!data || !data.id) return
    
    try {
      // 更新笔记的目录（PDF 和普通笔记都使用 UpdateNoteMD）
      await window.go.backend.App.UpdateNoteMD(
        data.id,
        data.title || '',
        data.language || 'md',
        data.contentMd || '',
        selectedCategoryId || 0
      )
      
      message.success('目录修改成功')
      setCategoryModalVisible(false)
      
      // 重新加载数据
      const list = await window.go.backend.App.ListNotes(null)
      const found = (list || []).find(n => n.id === data.id)
      if (found) {
        setData(found)
      }
    } catch (e) {
      console.error('修改目录失败:', e)
      message.error('修改目录失败: ' + (e?.message || '未知错误'))
    }
  }, [data, selectedCategoryId])

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

  // 如果是 PDF 类型，获取文件内容并创建 blob URL
  useEffect(() => {
    async function loadPDFContent() {
      if (data && data.type === 1 && data.id) {
        try {
          
          const base64Data = await window.go.backend.App.GetPDFContent(data.id)
          
          // 转换为 blob URL
          const byteCharacters = atob(base64Data)
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: 'application/pdf' })
          const blobUrl = URL.createObjectURL(blob)
          setPdfPath(blobUrl)
          
        } catch (e) {
          console.error('获取 PDF 内容失败:', e)
          setPdfPath(null)
        }
      } else {
        setPdfPath(null)
      }
    }
    loadPDFContent()
    
    // 清理 blob URL
    return () => {
      if (pdfPath && pdfPath.startsWith('blob:')) {
        URL.revokeObjectURL(pdfPath)
      }
    }
  }, [data])

  // 每次内容变更后，对代码块执行 highlight.js 高亮，并确保标题有 ID
  useEffect(() => {
    // 在 effect 内部计算，避免依赖外部变量
    const currentRaw = data?.contentMd || ''
    let currentHeadings = []
    if (data && item && item.type === 'note' && item.id && currentRaw) {
      try {
        currentHeadings = extractHeadings(currentRaw, false)
      } catch (e) {
        // 忽略错误，继续执行
      }
    }
    
    // 延迟到 DOM 更新完成后执行
    const timer = setTimeout(() => {
      try {
        const contentContainer = contentRef.current
        if (!contentContainer) return
        
        // 确保所有标题元素都有 data-heading-id（Markdown 渲染的标题通常已经有，但确保一下）
        if (currentHeadings && currentHeadings.length > 0) {
          const headingElements = contentContainer.querySelectorAll('h1, h2, h3, h4, h5, h6')
          headingElements.forEach((element, index) => {
            // 检查是否已有 data-heading-id
            const existingDataId = element.getAttribute('data-heading-id')
            if (!existingDataId) {
              // 从 headings 数组中查找匹配的标题
              const text = element.textContent || element.innerText || ''
              const matchingHeading = currentHeadings.find(h => 
                h.text.trim() === text.trim() || 
                text.trim().includes(h.text.trim()) ||
                h.text.trim().includes(text.trim())
              )
              
              if (matchingHeading) {
                element.setAttribute('data-heading-id', matchingHeading.id)
                // 如果存在 id 属性，移除它（避免 CSS 命名规范冲突）
                if (element.id) {
                  element.removeAttribute('id')
                }
              } else {
                // 如果没有匹配的，生成一个 ID
                const generatedId = text
                  .toLowerCase()
                  .trim()
                  .replace(/[^\w\s-]/g, '')
                  .replace(/\s+/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-+|-+$/g, '') || `heading-${index}`
                element.setAttribute('data-heading-id', generatedId)
                // 如果存在 id 属性，移除它
                if (element.id) {
                  element.removeAttribute('id')
                }
              }
            } else {
              // 如果已有 data-heading-id，但还存在 id 属性，移除 id（清理旧数据）
              if (element.id) {
                element.removeAttribute('id')
              }
            }
          })
        }
        
        // 对代码块执行高亮
        const blocks = contentContainer.querySelectorAll('pre code, pre')
        blocks.forEach((block) => {
          // 尝试对 <code> 标签高亮，否则直接对 <pre> 高亮
          const el = block.tagName === 'PRE' && block.firstElementChild ? block.firstElementChild : block
          // 检查是否已经有语言类，如果没有则尝试检测
          if (!el.className || !el.className.includes('language-')) {
            const detected = hljs.highlightAuto(el.textContent || '')
            if (detected.language) {
              el.className = `language-${detected.language}`
            }
          }
          hljs.highlightElement(el)
        })
        
        // 为所有图片添加双击放大功能
        const images = contentContainer.querySelectorAll('img')
        images.forEach((img) => {
          // 检查是否已经添加过事件监听器
          if (img.dataset.dblclickAdded) {
            return
          }
          
          // 标记已添加
          img.dataset.dblclickAdded = 'true'
          
          // 添加双击事件
          const handleDoubleClick = (e) => {
            e.preventDefault()
            e.stopPropagation()
            const src = img.src || img.getAttribute('src') || ''
            if (src) {
              setPreviewImage({ visible: true, src })
            }
          }
          
          img.addEventListener('dblclick', handleDoubleClick)
          
          // 添加鼠标样式提示
          img.style.cursor = 'zoom-in'
          img.title = '双击放大图片'
        })
      } catch (e) {
        console.error('Error in post-render effect:', e)
      }
    }, 100) // 增加延迟，确保 DOM 完全更新
    return () => clearTimeout(timer)
  }, [data, item])

  if (!item) return null
  if (!data) return <div>加载中...</div>

  if (item.type === 'note' && item.id) {
    // PDF 类型
    if (data.type === 1) {
      return (
        <div className="pane-viewer">
          <div className="pane-actions-inline">
            <Button
              type="text"
              size="small"
              icon={<ColumnWidthOutlined />}
              onClick={onSplitPane}
              title="分屏"
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={onClosePane}
              disabled={!canClose}
              title="关闭面板"
            />
          </div>
          <ErrorBoundary>
            {pdfPath ? (
              <PDFViewer filePath={pdfPath} title={data.title} noteId={data.id} />
            ) : (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Typography.Text>加载 PDF 路径中...</Typography.Text>
              </div>
            )}
          </ErrorBoundary>
        </div>
      )
    }

    // 命令行工具类型 (Type 2)
    if (data.type === 2) {
      const scriptContent = data.contentMd || ''
      
      return (
        <ErrorBoundary>
          <div className="pane-viewer">
            <div className="pane-actions-inline">
              <Button
                type="text"
                size="small"
                icon={<ColumnWidthOutlined />}
                onClick={onSplitPane}
                title="分屏"
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={onClosePane}
                disabled={!canClose}
                title="关闭面板"
              />
            </div>
            <div
              style={{
                display: 'grid',
                gap: 12,
                overflow: 'auto',
                height: '90vh',
                alignContent: 'start',
                alignItems: 'start',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <CodeOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                <Typography.Title level={4} style={{ margin: 0 }}>{data.title}</Typography.Title>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleExecuteScript}
                    loading={executing}
                    disabled={executing || !scriptContent.trim()}
                  >
                    执行
                  </Button>
                  <Button
                    size="small"
                    type="default"
                    icon={<EditOutlined />}
                    onClick={() => onEdit && onEdit({ item, data })}
                  >
                    编辑
                  </Button>
                  <Button
                    size="small"
                    type="text"
                    icon={<FolderOutlined />}
                    onClick={() => setCategoryModalVisible(true)}
                    title="修改目录"
                  />
                </div>
              </div>
              
              {/* 脚本内容显示区域 */}
              <Card title="脚本内容" size="small">
                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 4,
                    overflow: 'auto',
                    fontSize: 13,
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
                  }}
                >
                  <code className="language-bash">{scriptContent || '(空脚本)'}</code>
                </pre>
              </Card>

              {/* 执行结果区域 */}
              {execResult && (
                <Collapse defaultActiveKey={['result']}>
                  <Panel 
                    header={
                      <span>
                        {execResult.success ? (
                          <span style={{ color: '#52c41a' }}>执行结果 (成功)</span>
                        ) : (
                          <span style={{ color: '#ff4d4f' }}>执行结果 (失败)</span>
                        )}
                      </span>
                    } 
                    key="result"
                  >
                    {execResult.stdout && (
                      <div style={{ marginBottom: 12 }}>
                        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                          标准输出 (stdout):
                        </Typography.Text>
                        <pre
                          style={{
                            margin: 0,
                            padding: 12,
                            border: '1px solid #b7eb8f',
                            borderRadius: 4,
                            overflow: 'auto',
                            fontSize: 12,
                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {execResult.stdout}
                        </pre>
                      </div>
                    )}
                    {execResult.stderr && (
                      <div>
                        <Typography.Text strong style={{ display: 'block', marginBottom: 8, color: '#ff4d4f' }}>
                          错误输出 (stderr):
                        </Typography.Text>
                        <pre
                          style={{
                            margin: 0,
                            padding: 12,
                            backgroundColor: '#fff2f0',
                            border: '1px solid #ffccc7',
                            borderRadius: 4,
                            overflow: 'auto',
                            fontSize: 12,
                            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: '#ff4d4f',
                          }}
                        >
                          {execResult.stderr}
                        </pre>
                      </div>
                    )}
                    {!execResult.stdout && !execResult.stderr && (
                      <Typography.Text type="secondary">无输出</Typography.Text>
                    )}
                  </Panel>
                </Collapse>
              )}

              {/* 执行中提示 */}
              {executing && (
                <Alert
                  message="正在执行脚本..."
                  description="请稍候，脚本执行可能需要一些时间"
                  type="info"
                  icon={<Spin size="small" />}
                  showIcon
                />
              )}
            </div>
            {/* 修改目录对话框 */}
            <Modal
              title="修改目录"
              open={categoryModalVisible}
              onOk={handleChangeCategory}
              onCancel={() => setCategoryModalVisible(false)}
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
        </ErrorBoundary>
      )
    }

    // 普通笔记类型
    return (
      <ErrorBoundary>
        <div className="pane-viewer">
        <div className="pane-actions-inline">
          {headings.length > 0 && (
            <Button
              type="text"
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={handleToggleTOC}
              title={tocVisible ? `隐藏目录 (${headings.length} 个标题)` : `显示目录 (${headings.length} 个标题)`}
            />
          )}
            <Button
              type="text"
              size="small"
              icon={<ColumnWidthOutlined />}
              onClick={onSplitPane}
              title="分屏"
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={onClosePane}
              disabled={!canClose}
              title="关闭面板"
            />
          </div>
          <div
            style={{
              display: 'flex',
              height: '90vh',
              overflow: 'hidden',
            }}
          >
            {/* 左侧目录 */}
            {tocVisible && headings.length > 0 && (
              <>
                <div
                  style={{
                    width: `${tocWidth}px`,
                    flexShrink: 0,
                    borderRight: '1px solid #d9d9d9',
                    overflow: 'auto',
                    backgroundColor: '#fafafa',
                  }}
                >
                  <TOCViewer headings={headings} onHeadingClick={handleHeadingClick} />
                </div>
                {/* 可拖拽的分隔条 */}
                {/* <div
                  onMouseDown={handleTOCMouseDown}
                  style={{
                    width: '8px',
                    cursor: 'col-resize',
                    backgroundColor: isResizingTOC ? '#1890ff' : '#d9d9d9',
                    // transition: isResizingTOC ? 'none' : 'background-color 0.2s',
                    position: 'relative',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="拖拽调整目录宽度"
                >
                  <div style={{
                    width: '2px',
                    height: '40px',
                    backgroundColor: isResizingTOC ? '#fff' : '#999',
                    borderRadius: '1px'
                  }} />
                </div> */}
              </>
            )}
            {/* 右侧内容 */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'auto',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gap: 12,
                  padding: '16px',
                  alignContent: 'start',
                  alignItems: 'start',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <Typography.Title level={4} style={{ margin: 0 }}>{data.title}</Typography.Title>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => onEdit && onEdit({ item, data })}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      type="text"
                      icon={<FolderOutlined />}
                      onClick={() => setCategoryModalVisible(true)}
                      title="修改目录"
                    />
                  </div>
                </div>
                <div 
                  ref={contentRef}
                  className="viewer-content" 
                  dangerouslySetInnerHTML={{ __html: processedHtml || html }} 
                />
              </div>
            </div>
          </div>
          {/* 图片预览 */}
          {previewImage.src && (
            <Image
              width={0}
              height={0}
              style={{ display: 'none' }}
              src={previewImage.src}
              preview={{
                visible: previewImage.visible,
                src: previewImage.src,
                onVisibleChange: (visible) => {
                  setPreviewImage(prev => ({ ...prev, visible }))
                  if (!visible) {
                    // 关闭时清空 src，避免预览组件残留
                    setTimeout(() => {
                      setPreviewImage({ visible: false, src: '' })
                    }, 300)
                  }
                },
              }}
            />
          )}
          {/* 修改目录对话框 */}
          <Modal
            title="修改目录"
            open={categoryModalVisible}
            onOk={handleChangeCategory}
            onCancel={() => setCategoryModalVisible(false)}
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
      </ErrorBoundary>
    )
  }
  return null
}
