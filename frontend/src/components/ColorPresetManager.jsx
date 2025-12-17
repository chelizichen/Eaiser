import React, { useEffect, useState } from 'react'
import { Button, Input, List, ColorPicker, Checkbox, Tag } from 'antd'

export default function ColorPresetManager({ onChanged }) {
  const [list, setList] = useState([])
  const [name, setName] = useState('')
  const [hex, setHex] = useState('#7c3aed')
  const [encrypted, setEncrypted] = useState(false)

  async function load() {
    const items = await window.go.backend.App.ListColorPresets()
    setList(items || [])
  }

  async function add() {
    const value = typeof hex === 'string' ? hex : hex.toHexString()
    await window.go.backend.App.CreateColorPreset(name, value, encrypted)
    setName('')
    setEncrypted(false)
    load()
    onChanged && onChanged()
  }

  async function update(item, nextName, nextHex, nextEncrypted = item.encrypted) {
    const value = typeof nextHex === 'string' ? nextHex : nextHex.toHexString()
    await window.go.backend.App.UpdateColorPreset(item.id, nextName, value, nextEncrypted)
    load()
    onChanged && onChanged()
  }

  async function remove(id) {
    await window.go.backend.App.DeleteColorPreset(id)
    load()
    onChanged && onChanged()
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <List
        dataSource={list}
        renderItem={(item) => (
          <List.Item>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <span style={{ width: 16, height: 16, background: item.hex, display: 'inline-block', borderRadius: 4 }} />
              <Input style={{ width: 160 }} value={item.name} onChange={(e) => update(item, e.target.value, item.hex)} />
              <ColorPicker value={item.hex} onChange={(v) => update(item, item.name, v)} />
              <Checkbox
                checked={item.encrypted}
                onChange={(e) => update(item, item.name, item.hex, e.target.checked)}
              >
                加密
              </Checkbox>
              {item.encrypted && <Tag color="red">🔒</Tag>}
              <Button danger onClick={() => remove(item.id)}>删除</Button>
            </div>
          </List.Item>
        )}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Input placeholder="名称" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 160 }} />
        <ColorPicker value={hex} onChange={setHex} />
        <Checkbox checked={encrypted} onChange={(e) => setEncrypted(e.target.checked)}>加密颜色</Checkbox>
        <Button type="primary" onClick={add}>添加预设</Button>
      </div>
    </div>
  )
}
