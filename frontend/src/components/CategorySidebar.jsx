import React, { useEffect, useState } from 'react'
import { Button, Input, List, Popover, ColorPicker, Typography, Modal, Tree, message, Tooltip } from 'antd'
import { PlusOutlined, BgColorsOutlined } from '@ant-design/icons'
import ColorPresetManager from './ColorPresetManager.jsx'

export default function CategorySidebar({ categories, activeCategory, onSelect, onSelectItem, onChanged }) {
  const [name, setName] = useState('')
  const [palette, setPalette] = useState([])
  const [selectedPresetId, setSelectedPresetId] = useState(null)
  const [managerOpen, setManagerOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createChildModalOpen, setCreateChildModalOpen] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState([])
  const [autoExpandParent, setAutoExpandParent] = useState(true)
  const [addingParentId, setAddingParentId] = useState(null)
  const [childName, setChildName] = useState('')
  const [childPresetId, setChildPresetId] = useState(null)
  const [filesByCategory, setFilesByCategory] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')

  async function loadPalette() {
    const list = await window.go.backend.App.ListColorPresets()
    setPalette(list || [])
  }

  async function create() {
    if (!name.trim()) {
      message.error('请输入分类名称')
      return
    }
    await window.go.backend.App.CreateCategory(name, selectedPresetId, null)
    setName('')
    setSelectedPresetId(null)
    setCreateModalOpen(false)
    onChanged()
  }

  async function createChild() {
    if (!childName.trim()) {
      message.error('请输入分类名称')
      return
    }
    await window.go.backend.App.CreateCategory(childName, childPresetId, addingParentId)
    setAddingParentId(null)
    setChildName('')
    setChildPresetId(null)
    setCreateChildModalOpen(false)
    onChanged()
  }
  async function updateColor(cat, presetId) {
    await window.go.backend.App.UpdateCategory(cat.id, cat.name, presetId, cat.parentId)
    onChanged()
  }

  useEffect(() => { loadPalette() }, [])

  function truncate(s) {
    if (!s) return ''
    const t = s.trim()
    return t.length > 5 ? t.slice(0, 5) + '…' : t
  }

  function startEdit(cat) {
    setEditingId(cat.id)
    setEditingName(cat.name || '')
  }

  async function saveEdit(cat) {
    const next = (editingName || '').trim()
    setEditingId(null)
    if (!next) {
      setEditingName('')
      return
    }
    await window.go.backend.App.UpdateCategory(cat.id, next, cat.colorPresetId, cat.parentId)
    setEditingName('')
    onChanged()
  }

  async function loadCatFiles(catId) {
    try {
      const cid = Number(catId)
      const notes = await window.go.backend.App.ListNotes(cid)
      setFilesByCategory(prev => ({ ...prev, [cid]: { notes: notes || [] } }))
    } catch (e) {
      // noop
    }
  }

  // 根据颜色预设 ID 获取对应的 hex 值
  function getColorHex(colorPresetId) {
    if (!colorPresetId) return '#7c3aed' // 默认紫色
    const preset = palette.find(p => p.id === colorPresetId)
    return preset ? preset.hex : '#7c3aed'
  }

  function buildTree(list) {
    const map = new Map()
    list.forEach(c => {
      const colorHex = getColorHex(c.colorPresetId)
      map.set(c.id, {
        key: String(c.id),
        title: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            {editingId === c.id ? (
              <Input
                value={editingName}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditingName(e.target.value)}
                autoFocus
                onBlur={() => saveEdit(c)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); saveEdit(c) }
                  if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); setEditingName('') }
                }}
                style={{ flex: 1, color: colorHex }}
              />
            ) : (
              <div
                style={{ flex: 1, color: colorHex, cursor: 'pointer' }}
                onDoubleClick={(e) => { e.stopPropagation(); startEdit(c) }}
              >
                {c.name}
              </div>
            )}
            <Button type="text" icon={<PlusOutlined />} onClick={(e) => { e.stopPropagation(); setAddingParentId(c.id); setCreateChildModalOpen(true) }} />
          </div>
        ),
        children: [],
        data: c
      })
    })
    const roots = []
    list.forEach(c => {
      if (c.parentId) {
        const parent = map.get(c.parentId)
        if (parent) parent.children.push(map.get(c.id))
        else roots.push(map.get(c.id))
      } else {
        roots.push(map.get(c.id))
      }
    })
    // Append file nodes under each category if available（仅笔记）
    // for (const c of list) {
    //   const entry = filesByCategory[c.id]
    //   if (entry) { // 已经加载过的直接展开
    //     const parent = map.get(c.id)
    //     const children = parent.children
    //     // Notes
    //     entry.notes.forEach(n => {
    //       if (n.categoryId !== c.id) return
    //       children.push({
    //         key: `note-${n.id}`,
    //         title: (
    //           <Tooltip title={n.title}>
    //             <span>{truncate(n.title)}</span>
    //           </Tooltip>
    //         ),
    //         file: { type: 'note', id: n.id, categoryId: c.id, title: n.title }
    //       })
    //     })
    //   }
    // }
    return roots
  }

  const treeData = buildTree(categories || [])
  const selectedHex = (palette.find(p => p.id === selectedPresetId)?.hex) || undefined

  return (
    <div style={{ padding: '36px 12px 12px 12px',boxSizing:'border-box','--wails-draggable':'drag' }}>
      <div className="sidebar-header">
        <Typography.Text 
          strong 
          style={{ cursor: 'pointer' }}
          onClick={() => onSelect(null)}
        >
          目录
        </Typography.Text>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)} />
          <Button size="small" icon={<BgColorsOutlined />} onClick={() => setManagerOpen(true)} />
        </div>
      </div>
      <div style={{ marginTop: 8, height: '60vh', overflow: 'auto' }}>
        <Tree
          treeData={treeData}
          expandedKeys={expandedKeys}
          onExpand={async (keys) => {
            setExpandedKeys(keys)
            setAutoExpandParent(false)
            // Load files for newly expanded categories
            for (const k of keys) {
              const idNum = Number(k)
              if (!Number.isNaN(idNum) && !filesByCategory[idNum]) {
                await loadCatFiles(idNum)
              }
            }
          }}
          autoExpandParent={autoExpandParent}
          showLine
          onSelect={(keys, info) => {
            if (!info || !info.node) return
            if (info.node.data) {
              try {
                window.go.backend.App.LogFrontend(JSON.stringify({
                  event: 'CategorySidebar.select',
                  categoryId: info.node.data.id,
                  name: info.node.data.name,
                  presetId: info.node.data.colorPresetId,
                  encrypted: info.node.data.colorPreset?.encrypted,
                }))
              } catch (e) {
                // ignore
              }
              onSelect(info.node.data.id)
              if (onSelectItem) onSelectItem(null)
            } else if (info.node.file && onSelectItem) {
              onSelectItem(info.node.file)
            }
          }}
        />
      </div>
      <Modal 
        open={createModalOpen} 
        onCancel={() => { 
          setCreateModalOpen(false)
          setName('')
          setSelectedPresetId(null)
        }} 
        title="新建分类"
        onOk={create}
        okText="添加"
        okButtonProps={{ disabled: !name.trim() }}
      >
        <div style={{ display: 'grid', gap: 16, paddingTop: 16 }}>
          <Input 
            placeholder="分类名称" 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            onPressEnter={create}
            style={{ color: selectedHex }} 
          />
          <div>
            <Typography.Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>选择颜色</Typography.Text>
            <div className="palette-grid-v2">
              {palette.map(p => (
                <div
                  key={p.id}
                  className={`palette-item-v2 ${selectedPresetId === p.id ? 'active' : ''}`}
                  style={{ 
                    borderColor: p.hex,
                    color: selectedPresetId === p.id ? '#fff' : p.hex,
                    background: selectedPresetId === p.id ? p.hex : 'transparent'
                  }}
                  onClick={() => setSelectedPresetId(p.id)}
                >
                  <div 
                    className="palette-dot" 
                    style={{ background: p.hex }}
                  />
                  <span className="palette-name">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
      <Modal 
        open={createChildModalOpen} 
        onCancel={() => { 
          setCreateChildModalOpen(false)
          setAddingParentId(null)
          setChildName('')
          setChildPresetId(null)
        }} 
        title={`新建子分类${addingParentId ? ` - ${categories?.find(c => c.id === addingParentId)?.name || ''}` : ''}`}
        onOk={createChild}
        okText="添加"
        okButtonProps={{ disabled: !childName.trim() }}
      >
        <div style={{ display: 'grid', gap: 16, paddingTop: 16 }}>
          <Input 
            placeholder="子分类名称" 
            value={childName} 
            onChange={(e) => setChildName(e.target.value)}
            onPressEnter={createChild}
            style={{ color: (palette.find(p => p.id === childPresetId)?.hex) || undefined }} 
          />
          <div>
            <Typography.Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>选择颜色</Typography.Text>
            <div className="palette-grid-v2">
              {palette.map(p => (
                <div
                  key={p.id}
                  className={`palette-item-v2 ${childPresetId === p.id ? 'active' : ''}`}
                  style={{ 
                    borderColor: p.hex,
                    color: childPresetId === p.id ? '#fff' : p.hex,
                    background: childPresetId === p.id ? p.hex : 'transparent'
                  }}
                  onClick={() => setChildPresetId(p.id)}
                >
                  <div 
                    className="palette-dot" 
                    style={{ background: p.hex }}
                  />
                  <span className="palette-name">{p.name}{p.encrypted ? ' 🔒' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
      <Modal open={managerOpen} onCancel={() => setManagerOpen(false)} footer={null} title="颜色预设管理">
        <ColorPresetManager onChanged={() => { loadPalette(); onChanged() }} />
      </Modal>
    </div>
  )
}
