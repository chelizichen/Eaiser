import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Button, Input, List, Typography, Tag, message, AutoComplete, Spin, theme } from 'antd'
import { ColumnWidthOutlined, CloseOutlined, SendOutlined, RobotOutlined, FolderOutlined, FileTextOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { renderMarkdown } from '../lib/markdown'
import striptags from 'striptags'
const { TextArea } = Input

export default function AIChatTab({ 
  activeCategory, 
  categories = [], 
  onSplitPane, 
  onClosePane, 
  canClose = true,
  ensureUnlocked 
}) {
  const { token } = theme.useToken()
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState([])
  const [showMentionMenu, setShowMentionMenu] = useState(false)
  const [mentionOptions, setMentionOptions] = useState([])
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 })
  const [selectedContexts, setSelectedContexts] = useState([]) // [{ type: 'category'|'note', id, name }]
  const inputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const mentionMenuRef = useRef(null)

  // 加载当前目录下的笔记
  useEffect(() => {
    async function loadNotes() {
      if (activeCategory) {
        try {
          const notesList = await window.go.backend.App.ListNotes(activeCategory)
          setNotes(notesList || [])
        } catch (e) {
          console.error('加载笔记失败:', e)
        }
      } else {
        setNotes([])
      }
    }
    loadNotes()
  }, [activeCategory])

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 构建提及选项（目录和笔记）
  const buildMentionOptions = useMemo(() => {
    const options = []
    
    // 添加当前目录
    if (activeCategory) {
      const cat = categories.find(c => c.id === activeCategory)
      if (cat) {
        options.push({
          value: `@category:${cat.name}`,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderOutlined />
              <span>目录: {cat.name}</span>
            </div>
          ),
          type: 'category',
          id: cat.id,
          name: cat.name
        })
      }
    }

    // 添加当前目录下的笔记
    notes.forEach(note => {
      if (note.type !== 1) { // 排除 PDF
        options.push({
          value: `@note:${note.title}`,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileTextOutlined />
              <span>笔记: {note.title}</span>
            </div>
          ),
          type: 'note',
          id: note.id,
          name: note.title
        })
      }
    })

    return options
  }, [activeCategory, categories, notes])

  // 处理输入变化，检测 @ 符号
  const handleInputChange = (e) => {
    const value = e.target.value
    setInputValue(value)

    // 检测 @ 符号后的文本
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = value.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
      // 如果没有空格，说明正在输入提及
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        // 过滤选项
        const searchText = textAfterAt.toLowerCase()
        const filtered = buildMentionOptions.filter(opt => 
          opt.name.toLowerCase().includes(searchText)
        )
        setMentionOptions(filtered)
        setShowMentionMenu(true)
        
        // 计算菜单位置（简化版，实际可以使用更精确的计算）
        if (inputRef.current) {
          const rect = inputRef.current.resizableTextArea?.textArea?.getBoundingClientRect()
          if (rect) {
            setMentionPosition({
              top: rect.top + rect.height,
              left: rect.left
            })
          }
        }
        return
      }
    }
    
    setShowMentionMenu(false)
    
    // 解析内联格式的提及
    parseInlineMentions(value)
  }

  // 解析内联格式的提及 (@category:名称 或 @note:标题)
  const parseInlineMentions = (text) => {
    const contexts = []
    // 修改正则：匹配 @category: 或 @note: 后直到下一个 @ 或行尾的所有内容（包括空格）
    // 使用非贪婪匹配，遇到 @ 或行尾停止
    const categoryRegex = /@category:([^@\n]+?)(?=\s|@|$)/g
    const noteRegex = /@note:([^@\n]+?)(?=\s|@|$)/g

    console.log('[AIChatTab] parseInlineMentions 输入文本:', text)
    console.log('[AIChatTab] 可用目录列表:', categories.map(c => ({ id: c.id, name: c.name })))
    
    let match
    while ((match = categoryRegex.exec(text)) !== null) {
      const name = match[1].trim() // 去除首尾空格
      console.log(`[AIChatTab] 解析到目录名称: "${name}"`)
      const cat = categories.find(c => c.name === name)
      if (cat) {
        console.log(`[AIChatTab] 找到目录: id=${cat.id}, name=${cat.name}`)
        contexts.push({ type: 'category', id: cat.id, name: cat.name })
      } else {
        console.warn(`[AIChatTab] 未找到目录: "${name}"`)
        // 尝试模糊匹配（包含关系）
        const fuzzyMatch = categories.find(c => c.name.includes(name) || name.includes(c.name))
        if (fuzzyMatch) {
          console.log(`[AIChatTab] 模糊匹配到目录: id=${fuzzyMatch.id}, name=${fuzzyMatch.name}`)
          contexts.push({ type: 'category', id: fuzzyMatch.id, name: fuzzyMatch.name })
        }
      }
    }

    while ((match = noteRegex.exec(text)) !== null) {
      const title = match[1].trim()
      console.log(`[AIChatTab] 解析到笔记标题: "${title}"`)
      const note = notes.find(n => n.title === title)
      if (note) {
        console.log(`[AIChatTab] 找到笔记: id=${note.id}, title=${note.title}`)
        contexts.push({ type: 'note', id: note.id, name: note.title })
      } else {
        console.warn(`[AIChatTab] 未找到笔记: "${title}"`)
      }
    }

    // 去重
    const uniqueContexts = []
    const seen = new Set()
    contexts.forEach(ctx => {
      const key = `${ctx.type}-${ctx.id}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueContexts.push(ctx)
      }
    })

    console.log('[AIChatTab] parseInlineMentions 解析结果:', uniqueContexts)
    setSelectedContexts(uniqueContexts)
  }

  // 选择提及项
  const handleMentionSelect = (value, option) => {
    const cursorPos = inputRef.current?.resizableTextArea?.textArea?.selectionStart || 0
    const textBeforeCursor = inputValue.substring(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIndex !== -1) {
      const before = inputValue.substring(0, lastAtIndex)
      const after = inputValue.substring(cursorPos)
      const newValue = before + value + ' ' + after
      setInputValue(newValue)
      
      // 添加关联上下文
      const existing = selectedContexts.find(c => c.type === option.type && c.id === option.id)
      if (!existing) {
        setSelectedContexts(prev => [...prev, { type: option.type, id: option.id, name: option.name }])
      }
    }
    
    setShowMentionMenu(false)
    
    // 聚焦输入框
    setTimeout(() => {
      inputRef.current?.focus()
      const newCursorPos = inputValue.length + value.length + 1
      inputRef.current?.resizableTextArea?.textArea?.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  // 移除关联上下文
  const removeContext = (type, id) => {
    setSelectedContexts(prev => prev.filter(c => !(c.type === type && c.id === id)))
    // 同时从输入文本中移除对应的提及
    const regex = type === 'category' 
      ? new RegExp(`@category:${categories.find(c => c.id === id)?.name || ''}\\s*`, 'g')
      : new RegExp(`@note:${notes.find(n => n.id === id)?.title || ''}\\s*`, 'g')
    setInputValue(prev => prev.replace(regex, ''))
  }

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim() && selectedContexts.length === 0) {
      message.warning('请输入消息或选择关联内容')
      return
    }

    const userMessage = inputValue.trim()
    if (!userMessage && selectedContexts.length === 0) {
      return
    }

    // 检查加密目录
    if (selectedContexts.some(ctx => ctx.type === 'category')) {
      for (const ctx of selectedContexts) {
        if (ctx.type === 'category') {
          const cat = categories.find(c => c.id === ctx.id)
          if (cat?.colorPreset?.encrypted && ensureUnlocked) {
            const ok = await ensureUnlocked(ctx.id, '目录')
            if (!ok) {
              message.warning('需要解锁加密目录')
              return
            }
          }
        }
      }
    }

    // 添加用户消息
    const newUserMessage = {
      role: 'user',
      content: userMessage || '（仅关联内容）',
      contexts: [...selectedContexts]
    }
    setMessages(prev => [...prev, newUserMessage])
    setInputValue('')
    setSelectedContexts([])
    setLoading(true)

    try {
      // 收集上下文内容
      const contextTexts = []
      console.log('[AIChatTab] 开始收集上下文，selectedContexts:', selectedContexts)
      
      for (const ctx of selectedContexts) {
        try {
          console.log(`[AIChatTab] 处理上下文: type=${ctx.type}, id=${ctx.id}, name=${ctx.name}`)
          
          if (ctx.type === 'category') {
            console.log(`[AIChatTab] 调用 GetCategoryContent: categoryId=${ctx.id}`)
            const content = await window.go.backend.App.GetCategoryContent(ctx.id)
            console.log(`[AIChatTab] GetCategoryContent 返回: length=${content?.length || 0}, content=${content?.substring(0, 100) || 'empty'}...`)
            
            if (content && content.trim()) {
              let _content = striptags(content);
              console.log(`[AIChatTab] 处理后内容长度: ${_content.length}`)
              contextTexts.push(`[目录: ${ctx.name}]\n${_content}`)
              console.log(`[AIChatTab] 已添加目录上下文: ${ctx.name}`)
            } else {
              console.warn(`[AIChatTab] 目录内容为空: ${ctx.name} (id=${ctx.id})`)
            }
          } else if (ctx.type === 'note') {
            console.log(`[AIChatTab] 调用 GetNoteContent: noteId=${ctx.id}`)
            const content = await window.go.backend.App.GetNoteContent(ctx.id)
            console.log(`[AIChatTab] GetNoteContent 返回: length=${content?.length || 0}`)
            
            if (content && content.trim()) {
              let _content = striptags(content);
              contextTexts.push(`[笔记: ${ctx.name}]\n${_content}`)
              console.log(`[AIChatTab] 已添加笔记上下文: ${ctx.name}`)
            } else {
              console.warn(`[AIChatTab] 笔记内容为空: ${ctx.name} (id=${ctx.id})`)
            }
          }
        } catch (e) {
          console.error(`[AIChatTab] 获取${ctx.type}内容失败:`, e)
        }
      }
      
      console.log(`[AIChatTab] 上下文收集完成，contextTexts.length=${contextTexts.length}`)

      // 加入历史对话（只带最近若干条，避免上下文过长）
      if (messages.length > 0) {
        const historyLimit = 10 // 只保留最近 10 条
        const recent = messages.slice(-historyLimit)
        const historyText = recent
          .map(msg => {
            const roleLabel = msg.role === 'user' ? '用户' : '助手'
            const plain = striptags(msg.content || '')
            return `${roleLabel}: ${plain}`
          })
          .join('\n\n')

        if (historyText.trim()) {
          contextTexts.unshift(`[对话历史]\n${historyText}`)
        }
      }

      // 调用 AI API
      const response = await window.go.backend.App.ChatWithAI(
        userMessage || '请分析关联的内容',
        contextTexts
      )
      
      // 添加 AI 回复
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response
      }])
    } catch (e) {
      console.error('AI 对话失败:', e)
      message.error('AI 对话失败: ' + (e.message || '未知错误'))
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，发生了错误：' + (e.message || '未知错误')
      }])
    } finally {
      setLoading(false)
    }
  }

  // 清空对话
  const handleClear = () => {
    setMessages([])
    setInputValue('')
    setSelectedContexts([])
  }

  // 处理键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%',minHeight:'60vh' }}>
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 关联上下文标签 */}
        {selectedContexts.length > 0 && (
          <div style={{ 
            padding: '8px 12px', 
            borderBottom: `1px solid ${token.colorBorderSecondary}`, 
            display: 'flex', 
            gap: 8, 
            flexWrap: 'wrap', 
            alignItems: 'center' 
          }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>关联内容：</Typography.Text>
            {selectedContexts.map((ctx, idx) => (
              <Tag
                key={`${ctx.type}-${ctx.id}-${idx}`}
                closable
                onClose={() => removeContext(ctx.type, ctx.id)}
                icon={ctx.type === 'category' ? <FolderOutlined /> : <FileTextOutlined />}
                color="blue"
              >
                {ctx.type === 'category' ? '目录' : '笔记'}: {ctx.name}
              </Tag>
            ))}
          </div>
        )}

        {/* 消息列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: token.colorTextTertiary }}>
              <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <Typography.Text type="secondary">
                输入 @ 符号可以关联目录或笔记内容，然后与 AI 进行对话
              </Typography.Text>
            </div>
          ) : (
            <List
              dataSource={messages}
              renderItem={(msg, idx) => (
                <List.Item style={{ border: 'none', padding: '12px 0' }}>
                  <div style={{ 
                    width: '100%', 
                    display: 'flex', 
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    gap: 12
                  }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: msg.role === 'user' ? token.colorPrimary : token.colorSuccess,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      flexShrink: 0
                    }}>
                      {msg.role === 'user' ? '我' : <RobotOutlined />}
                    </div>
                    <div style={{
                      flex: 1,
                      backgroundColor: msg.role === 'user' 
                        ? token.colorPrimaryBg 
                        : token.colorSuccessBg,
                      color: token.colorText,
                      padding: '12px 16px',
                      borderRadius: 8,
                      maxWidth: '80%',
                      border: `1px solid ${msg.role === 'user' ? token.colorPrimaryBorder : token.colorSuccessBorder}`
                    }}>
                      {msg.contexts && msg.contexts.length > 0 && (
                        <div style={{ 
                          marginBottom: 8, 
                          paddingBottom: 8, 
                          borderBottom: `1px solid ${token.colorBorderSecondary}` 
                        }}>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            关联内容：
                          </Typography.Text>
                          {msg.contexts.map((ctx, i) => (
                            <Tag key={i} size="small" style={{ marginLeft: 4 }}>
                              {ctx.type === 'category' ? '目录' : '笔记'}: {ctx.name}
                            </Tag>
                          ))}
                        </div>
                      )}
                      {msg.role === 'assistant' ? (
                        <div 
                          style={{ 
                            fontSize: 14, 
                            lineHeight: 1.6,
                            color: token.colorText
                          }}
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                        />
                      ) : (
                        <Typography.Text style={{ 
                          fontSize: 14, 
                          whiteSpace: 'pre-wrap',
                          color: token.colorText
                        }}>
                          {msg.content}
                        </Typography.Text>
                      )}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
          {loading && (
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <Spin />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div style={{ padding: '12px', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <div style={{ position: 'relative' }}>
            <TextArea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... 使用 @ 符号关联目录或笔记"
              autoSize={{ minRows: 2, maxRows: 6 }}
              style={{ marginBottom: 8 }}
            />
            {showMentionMenu && mentionOptions.length > 0 && (
              <div
                ref={mentionMenuRef}
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: 8,
                  backgroundColor: token.colorBgElevated,
                  border: `1px solid ${token.colorBorder}`,
                  borderRadius: 4,
                  boxShadow: token.boxShadowSecondary,
                  maxHeight: 200,
                  overflowY: 'auto',
                  zIndex: 1000,
                  minWidth: 300
                }}
              >
                {mentionOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleMentionSelect(opt.value, opt)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      color: token.colorText,
                      borderBottom: idx < mentionOptions.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = token.colorFillSecondary}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button onClick={handleClear} disabled={messages.length === 0}>
              清空对话
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
              disabled={!inputValue.trim() && selectedContexts.length === 0}
            >
              发送
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

