import React, { useMemo, useEffect } from 'react'
import { Tree, Typography, Empty } from 'antd'

const { Text } = Typography

/**
 * 目录查看器组件
 * @param {Array} headings - 标题数组，每个元素包含 { level, text, id }
 * @param {Function} onHeadingClick - 点击标题时的回调函数，接收 (id) 参数
 */
export default function TOCViewer({ headings = [], onHeadingClick }) {
  // 将扁平化的标题数组转换为树形结构
  const treeData = useMemo(() => {
    try {
      if (!headings || headings.length === 0) {
        return []
      }

      const tree = []
      const stack = [] // 用于跟踪当前路径

      headings.forEach((heading, index) => {
        if (!heading || !heading.id || !heading.text) {
          console.warn('Invalid heading at index', index, heading)
          return
        }

        const node = {
          title: (
            <Text
              style={{
                fontSize: 14 - (heading.level - 1) * 0.5,
                fontWeight: heading.level === 1 ? 600 : heading.level === 2 ? 500 : 400,
              }}
            >
              {heading.text}
            </Text>
          ),
          key: heading.id,
          level: heading.level,
          id: heading.id,
        }

        // 找到合适的父节点
        while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
          stack.pop()
        }

        if (stack.length === 0) {
          // 顶级节点
          tree.push(node)
        } else {
          // 子节点
          const parent = stack[stack.length - 1]
          if (!parent.children) {
            parent.children = []
          }
          parent.children.push(node)
        }

        stack.push(node)
      })

      
      return tree
    } catch (e) {
      console.error('Error building tree data:', e)
      return []
    }
  }, [headings])

  const handleSelect = (selectedKeys, info) => {
    try {
      if (selectedKeys.length > 0 && onHeadingClick) {
        const nodeId = selectedKeys[0]
        console.log('handleSelect', info)
        onHeadingClick(nodeId)
      }
    } catch (e) {
      console.error('Error handling TOC select:', e)
    }
  }

  if (treeData.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Empty description="暂无目录" />
      </div>
    )
  }

  return (
    <div style={{ padding: 12, height: '100%', overflow: 'auto' }}>
      <Typography.Title level={5} style={{ marginBottom: 12, marginTop: 0, fontSize: 16 }}>
        目录
      </Typography.Title>
      <Tree
        treeData={treeData}
        onSelect={handleSelect}
        defaultExpandAll={true}
        showLine={false}
        blockNode={true}
        style={{
          background: 'transparent',
        }}
      />
    </div>
  )
}
