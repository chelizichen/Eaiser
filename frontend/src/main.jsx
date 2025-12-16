import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// 监听窗口大小改变，触发界面重新布局
window.addEventListener('resize', () => {
  // 触发一个自定义事件，让需要适配的组件可以监听并响应
  window.dispatchEvent(new CustomEvent('window-resized', { 
    detail: { width: window.innerWidth, height: window.innerHeight } 
  }))
})

createRoot(document.getElementById('root')).render(<App />)


