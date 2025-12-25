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
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(-1) // 当前选中的菜单项索引
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
        setSelectedMentionIndex(filtered.length > 0 ? 0 : -1) // 默认选中第一项
        
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
    setSelectedMentionIndex(-1) // 重置选中索引
    
    // 解析内联格式的提及
    parseInlineMentions(value)
  }

  // 解析内联格式的提及 (@category:名称 或 @note:标题)
  const parseInlineMentions = (text) => {
    const contexts = []
    // 改进的正则：匹配 @category: 或 @note: 后直到下一个 @ 符号或行尾的所有内容（包括空格）
    // 使用非贪婪匹配，匹配到下一个 @ 符号或行尾，而不是在空格处停止
    const categoryRegex = /@category:([^@\n]+?)(?=@|$)/g
    const noteRegex = /@note:([^@\n]+?)(?=@|$)/g

    console.log('[AIChatTab] parseInlineMentions 输入文本:', text)
    console.log('[AIChatTab] 可用目录列表:', categories.map(c => ({ id: c.id, name: c.name })))
    console.log('[AIChatTab] 可用笔记列表:', notes.map(n => ({ id: n.id, title: n.title, type: n.type })))
    
    let match
    while ((match = categoryRegex.exec(text)) !== null) {
      let name = match[1].trim()
      
      // 尝试精确匹配和前缀匹配，找到最合适的目录名
      // 如果匹配到的内容后面还有文本，尝试扩展匹配
      const matchStart = match.index + '@category:'.length
      const matchEnd = match.index + match[0].length
      
      // 尝试从文本中提取完整的目录名
      // 查找下一个 @ 或行尾
      const nextAt = text.indexOf('@', matchEnd)
      const nextNewline = text.indexOf('\n', matchStart)
      const textEnd = nextAt === -1 ? (nextNewline === -1 ? text.length : nextNewline) : Math.min(nextAt, nextNewline === -1 ? nextAt : nextNewline)
      
      // 提取从 @category: 到下一个 @ 或行尾的所有内容
      let fullText = text.substring(matchStart, textEnd).trim()
      
      // 尝试精确匹配完整文本
      let matchedCat = categories.find(c => c.name === fullText)
      if (!matchedCat) {
        // 尝试匹配原始匹配的内容
        matchedCat = categories.find(c => c.name === name)
      }
      
      // 如果还没找到，尝试前缀匹配
      if (!matchedCat) {
        const startsWithMatches = categories.filter(c => c.name.startsWith(name))
        if (startsWithMatches.length > 0) {
          // 选择最短的（最精确的匹配）
          matchedCat = startsWithMatches.reduce((best, current) => 
            current.name.length < best.name.length ? current : best
          )
        }
      }
      
      // 如果还没找到，尝试模糊匹配
      if (!matchedCat) {
        const fuzzyMatches = categories.filter(c => 
          c.name.includes(name) || name.includes(c.name)
        )
        if (fuzzyMatches.length > 0) {
          matchedCat = fuzzyMatches.reduce((best, current) => {
            const bestScore = current.name.includes(name) ? (current.name.length - name.length) : Infinity
            const currentScore = best.name.includes(name) ? (best.name.length - name.length) : Infinity
            return currentScore < bestScore ? current : best
          })
        }
      }
      
      if (matchedCat) {
        console.log(`[AIChatTab] 找到目录: id=${matchedCat.id}, name=${matchedCat.name} (匹配文本: "${name}", 完整文本: "${fullText}")`)
        contexts.push({ type: 'category', id: matchedCat.id, name: matchedCat.name })
      } else {
        console.warn(`[AIChatTab] 未找到目录: "${name}" (完整文本: "${fullText}")`)
      }
    }

    // 重置正则表达式的 lastIndex，避免全局匹配的问题
    noteRegex.lastIndex = 0
    while ((match = noteRegex.exec(text)) !== null) {
      let title = match[1].trim()
      
      // 尝试精确匹配和前缀匹配，找到最合适的笔记标题
      // 如果匹配到的内容后面还有文本，尝试扩展匹配
      const matchStart = match.index + '@note:'.length
      const matchEnd = match.index + match[0].length
      
      // 查找下一个 @ 或行尾
      const nextAt = text.indexOf('@', matchEnd)
      const nextNewline = text.indexOf('\n', matchStart)
      const textEnd = nextAt === -1 ? (nextNewline === -1 ? text.length : nextNewline) : Math.min(nextAt, nextNewline === -1 ? nextAt : nextNewline)
      
      // 提取从 @note: 到下一个 @ 或行尾的所有内容
      let fullText = text.substring(matchStart, textEnd).trim()
      
      // 尝试精确匹配完整文本
      let matchedNote = notes.find(n => n.type !== 1 && n.title === fullText)
      
      // 如果完整文本不匹配，尝试从完整文本中提取可能的笔记标题
      // 例如："BoeLink 12-25  25 号我干了啥1" -> 尝试 "BoeLink 12-25"
      if (!matchedNote && fullText && fullText.length > title.length) {
        // 尝试匹配完整文本的前几个词（逐步增加）
        const words = fullText.split(/\s+/)
        for (let i = words.length; i > 0; i--) {
          const potentialTitle = words.slice(0, i).join(' ')
          matchedNote = notes.find(n => n.type !== 1 && n.title === potentialTitle)
          if (matchedNote) {
            console.log(`[AIChatTab] 通过词匹配找到笔记: "${potentialTitle}" -> id=${matchedNote.id}, title=${matchedNote.title}`)
            break
          }
        }
      }
      
      if (!matchedNote) {
        // 尝试匹配原始匹配的内容
        matchedNote = notes.find(n => n.type !== 1 && n.title === title)
      }
      
      // 如果还没找到，尝试前缀匹配（这是关键：优先匹配以 title 开头的笔记）
      if (!matchedNote) {
        const startsWithMatches = notes.filter(n => 
          n.type !== 1 && n.title.startsWith(title)
        )
        if (startsWithMatches.length > 0) {
          // 如果有完整文本，优先选择与完整文本最接近的匹配
          // 例如：title="BoeLink", fullText="BoeLink 12-25" 时，优先选择 "BoeLink 12-25"
          if (fullText && fullText.startsWith(title)) {
            // 尝试找到与完整文本最接近的匹配（长度最接近，且是完整文本的前缀）
            const validMatches = startsWithMatches.filter(n => fullText.startsWith(n.title))
            if (validMatches.length > 0) {
              // 选择最长的匹配（最完整的匹配）
              matchedNote = validMatches.reduce((best, current) => 
                current.title.length > best.title.length ? current : best
              )
            } else {
              // 如果没有完全匹配的，选择与完整文本长度最接近的
              matchedNote = startsWithMatches.reduce((best, current) => {
                const bestDiff = Math.abs(best.title.length - fullText.length)
                const currentDiff = Math.abs(current.title.length - fullText.length)
                return currentDiff < bestDiff ? current : best
              })
            }
          } else {
            // 没有完整文本时，选择最短的（最精确的匹配）
            matchedNote = startsWithMatches.reduce((best, current) => 
              current.title.length < best.title.length ? current : best
            )
          }
        }
      }
      
      // 如果还没找到，尝试模糊匹配
      if (!matchedNote) {
        const fuzzyMatches = notes.filter(n => 
          n.type !== 1 && (n.title.includes(title) || title.includes(n.title))
        )
        if (fuzzyMatches.length > 0) {
          matchedNote = fuzzyMatches.reduce((best, current) => {
            const bestScore = current.title.includes(title) ? (current.title.length - title.length) : Infinity
            const currentScore = best.title.includes(title) ? (best.title.length - title.length) : Infinity
            return currentScore < bestScore ? current : best
          })
        }
      }
      
      if (matchedNote) {
        console.log(`[AIChatTab] 找到笔记: id=${matchedNote.id}, title=${matchedNote.title} (匹配文本: "${title}", 完整文本: "${fullText}")`)
        contexts.push({ type: 'note', id: matchedNote.id, name: matchedNote.title })
      } else {
        console.warn(`[AIChatTab] 未找到笔记: "${title}" (完整文本: "${fullText}")`)
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
        console.log(`[AIChatTab] handleMentionSelect 添加上下文: type=${option.type}, id=${option.id}, name=${option.name}`)
        setSelectedContexts(prev => {
          const updated = [...prev, { type: option.type, id: option.id, name: option.name }]
          console.log('[AIChatTab] handleMentionSelect 更新后的上下文:', updated)
          return updated
        })
      }
      
      // 重新解析输入文本，确保同步
      setTimeout(() => {
        parseInlineMentions(newValue)
      }, 0)
    }
    
    setShowMentionMenu(false)
    
    // 聚焦输入框
    setTimeout(() => {
      inputRef.current?.focus()
      const newCursorPos = lastAtIndex + value.length + 1
      if (inputRef.current?.resizableTextArea?.textArea) {
        inputRef.current.resizableTextArea.textArea.setSelectionRange(newCursorPos, newCursorPos)
      }
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
    // 如果菜单显示，处理上下键和回车键
    if (showMentionMenu && mentionOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedMentionIndex(prev => {
          const next = prev < mentionOptions.length - 1 ? prev + 1 : 0
          // 滚动到选中项
          scrollToMentionItem(next)
          return next
        })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedMentionIndex(prev => {
          const next = prev > 0 ? prev - 1 : mentionOptions.length - 1
          // 滚动到选中项
          scrollToMentionItem(next)
          return next
        })
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (selectedMentionIndex >= 0 && selectedMentionIndex < mentionOptions.length) {
          const selectedOption = mentionOptions[selectedMentionIndex]
          handleMentionSelect(selectedOption.value, selectedOption)
        } else {
          // 如果没有选中项，选择第一项
          if (mentionOptions.length > 0) {
            handleMentionSelect(mentionOptions[0].value, mentionOptions[0])
          }
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowMentionMenu(false)
        setSelectedMentionIndex(-1)
        return
      }
    }
    
    // 普通回车键处理
    if (e.key === 'Enter' && !e.shiftKey && !showMentionMenu) {
      e.preventDefault()
      handleSend()
    }
  }

  // 滚动到选中的菜单项
  const scrollToMentionItem = (index) => {
    if (!mentionMenuRef.current) return
    
    const menuElement = mentionMenuRef.current
    const items = menuElement.querySelectorAll('[data-mention-item]')
    if (items[index]) {
      // 使用 scrollIntoView 确保选中项在可视区域内
      items[index].scrollIntoView({ 
        block: 'nearest', 
        behavior: 'smooth',
        inline: 'nearest'
      })
    }
  }

  // 当菜单选项变化时，重置选中索引
  useEffect(() => {
    if (showMentionMenu && mentionOptions.length > 0) {
      // 如果当前选中的索引超出范围，重置为 0
      if (selectedMentionIndex >= mentionOptions.length || selectedMentionIndex < 0) {
        setSelectedMentionIndex(0)
      }
    }
  }, [mentionOptions, showMentionMenu])

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
                    data-mention-item
                    onClick={() => {
                      console.log('[AIChatTab] 点击提及选项:', opt)
                      handleMentionSelect(opt.value, opt)
                    }}
                    onMouseEnter={() => setSelectedMentionIndex(idx)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      color: token.colorText,
                      backgroundColor: selectedMentionIndex === idx ? token.colorPrimaryBg : 'transparent',
                      borderBottom: idx < mentionOptions.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseLeave={() => {
                      // 鼠标离开时不重置选中索引，保持键盘导航的状态
                    }}
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

