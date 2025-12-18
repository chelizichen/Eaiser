import React, { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button, Typography } from 'antd'
import { LeftOutlined, RightOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons'

// 设置 PDF.js worker
// 在 Wails 中，使用简单的字符串路径，避免 URL.parse 错误
// react-pdf 内部可能会尝试解析 worker URL，使用字符串路径可以避免这个问题
if (typeof window !== 'undefined') {
  // 直接使用字符串路径，不要使用 new URL() 或任何 URL 对象
  // 这可以避免 react-pdf 内部使用 URL.parse 时的错误
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
}

export default function PDFViewer({ filePath, title }) {
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages)
    setLoading(false)
    setError(null)
  }

  function onDocumentLoadError(error) {
    const errorMsg = error?.message || String(error) || '未知错误'
    setError('加载 PDF 失败: ' + errorMsg)
    setLoading(false)
  }

  function goToPrevPage() {
    setPageNumber(prev => Math.max(1, prev - 1))
  }

  function goToNextPage() {
    setPageNumber(prev => Math.min(numPages || 1, prev + 1))
  }

  function zoomIn() {
    setScale(prev => Math.min(3.0, prev + 0.2))
  }

  function zoomOut() {
    setScale(prev => Math.max(0.5, prev - 0.2))
  }

  if (!filePath) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Typography.Text type="warning">PDF 文件路径为空</Typography.Text>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Typography.Text type="danger">{error}</Typography.Text>
        <div style={{ marginTop: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            文件路径: {filePath ? '已提供' : '未提供'}
          </Typography.Text>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '90vh' }}>
      {/* 控制栏 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid #f0f0f0',
        background: '#fafafa'
      }}>
        <Typography.Text strong style={{ color: 'black' }}>{title}</Typography.Text>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button
            size="small"
            icon={<ZoomOutOutlined />}
            onClick={zoomOut}
            disabled={scale <= 0.5}
          />
          <Typography.Text style={{ minWidth: 60, textAlign: 'center', color: 'black' }}>
            {Math.round(scale * 100)}%
          </Typography.Text>
          <Button
            size="small"
            icon={<ZoomInOutlined />}
            onClick={zoomIn}
            disabled={scale >= 3.0}
          />
          <div style={{ width: 1, height: 20, background: '#d9d9d9', margin: '0 8px' }} />
          <Button
            size="small"
            icon={<LeftOutlined />}
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          />
          <Typography.Text style={{ minWidth: 80, textAlign: 'center', color: 'black' }}>
            {pageNumber} / {numPages || '?'}
          </Typography.Text>
          <Button
            size="small"
            icon={<RightOutlined />}
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 1)}
          />
        </div>
      </div>

      {/* PDF 内容 */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto', 
        display: 'flex', 
        justifyContent: 'center',
        padding: '20px',
        background: '#525252'
      }}>
        {loading && (
          <div style={{ padding: 40, color: '#fff' }}>加载中...</div>
        )}
        <Document
          file={filePath}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(error) => {
            console.error('Document onLoadError:', error)
            onDocumentLoadError(error)
          }}
          loading={<div style={{ padding: 40, color: '#fff' }}>加载 PDF...</div>}
          error={(error) => {
            console.error('Document error prop:', error)
            return (
              <div style={{ padding: 40, color: '#fff', textAlign: 'center' }}>
                <Typography.Text style={{ color: '#fff' }}>
                  无法加载 PDF 文件: {error?.message || '未知错误'}
                </Typography.Text>
              </div>
            )
          }}
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            error={
              <div style={{ padding: 40, color: '#fff', textAlign: 'center' }}>
                <Typography.Text style={{ color: '#fff' }}>
                  无法渲染 PDF 页面
                </Typography.Text>
              </div>
            }
          />
        </Document>
      </div>
    </div>
  )
}
