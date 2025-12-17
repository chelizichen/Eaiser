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


// 添加全局异常捕获
window.addEventListener('error', (event) => {
  // 打印到后端
  window.go.backend.App.LogFrontend(JSON.stringify({ event: 'error', error: event.error }))
})

window.addEventListener('unhandledrejection', (event) => {
  // 打印到后端
  window.go.backend.App.LogFrontend(JSON.stringify({ event: 'unhandledrejection', error: event.error }))
})