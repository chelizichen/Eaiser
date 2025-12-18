import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// Polyfill for URL.parse (Node.js API used by react-pdf/pdfjs-dist)
// This is needed because react-pdf internally uses URL.parse which doesn't exist in browsers
// Node.js url.parse returns: { protocol, slashes, host, hostname, hash, search, query, pathname, path, href, port, auth }
if (typeof window !== 'undefined' && typeof URL !== 'undefined' && !URL.parse) {
  URL.parse = function(url, parseQueryString, slashesDenoteHost) {
    try {
      // Handle relative URLs by resolving against current location
      const baseUrl = window.location.href
      const urlObj = new URL(url, baseUrl)
      
      // Parse query string if requested (Node.js behavior)
      let query = urlObj.search
      if (parseQueryString && urlObj.search) {
        const params = new URLSearchParams(urlObj.search)
        query = {}
        for (const [key, value] of params.entries()) {
          // Handle multiple values (Node.js returns array for duplicate keys)
          if (query[key]) {
            if (Array.isArray(query[key])) {
              query[key].push(value)
            } else {
              query[key] = [query[key], value]
            }
          } else {
            query[key] = value
          }
        }
      }
      
      // Node.js url.parse format
      return {
        protocol: urlObj.protocol.replace(':', ''), // Remove colon to match Node.js
        slashes: url.includes('//') || urlObj.protocol !== 'file:',
        host: urlObj.host,
        hostname: urlObj.hostname,
        hash: urlObj.hash.replace('#', ''), // Remove # to match Node.js
        search: urlObj.search,
        query: query,
        pathname: urlObj.pathname,
        path: urlObj.pathname + urlObj.search,
        href: urlObj.href,
        port: urlObj.port || '',
        auth: '' // Browser URL doesn't expose auth, but Node.js does
      }
    } catch (e) {
      // Fallback for invalid URLs - return minimal structure matching Node.js format
      const hasSlashes = url.includes('//')
      const hashMatch = url.match(/#(.*)$/)
      const searchMatch = url.match(/\?(.*?)(?:#|$)/)
      const protocolMatch = url.match(/^([a-z][a-z0-9+\-.]*):/i)
      
      let query = searchMatch ? '?' + searchMatch[1] : ''
      if (parseQueryString && searchMatch) {
        try {
          const params = new URLSearchParams(searchMatch[1])
          query = {}
          for (const [key, value] of params.entries()) {
            query[key] = value
          }
        } catch {
          query = searchMatch[1]
        }
      }
      
      return {
        protocol: protocolMatch ? protocolMatch[1] : null,
        slashes: hasSlashes,
        host: '',
        hostname: '',
        hash: hashMatch ? hashMatch[1] : '',
        search: searchMatch ? '?' + searchMatch[1] : '',
        query: query,
        pathname: url.split('?')[0].split('#')[0],
        path: url.split('#')[0],
        href: url,
        port: '',
        auth: ''
      }
    }
  }
  console.log('URL.parse polyfill installed for react-pdf compatibility')
}

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
  const errorInfo = {
    event: 'error',
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error ? {
      message: event.error.message,
      stack: event.error.stack,
      name: event.error.name
    } : null,
    target: event.target ? {
      tagName: event.target.tagName,
      src: event.target.src,
      href: event.target.href
    } : null
  }
  console.error('Global error:', errorInfo)
  if (window.go?.backend?.App?.LogFrontend) {
    window.go.backend.App.LogFrontend(JSON.stringify(errorInfo))
  }
})

window.addEventListener('unhandledrejection', (event) => {
  const errorInfo = {
    event: 'unhandledrejection',
    reason: event.reason ? {
      message: event.reason.message,
      stack: event.reason.stack,
      name: event.reason.name,
      toString: String(event.reason)
    } : String(event.reason)
  }
  console.error('Unhandled rejection:', errorInfo)
  if (window.go?.backend?.App?.LogFrontend) {
    window.go.backend.App.LogFrontend(JSON.stringify(errorInfo))
  }
})