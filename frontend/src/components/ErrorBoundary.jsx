import React from 'react'
import { Typography, Button } from 'antd'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
    
    // 记录到后端
    if (window.go?.backend?.App?.LogFrontend) {
      window.go.backend.App.LogFrontend(JSON.stringify({
        event: 'ErrorBoundary.catch',
        error: {
          message: error?.message,
          stack: error?.stack,
          name: error?.name
        },
        errorInfo: {
          componentStack: errorInfo?.componentStack
        }
      }))
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Typography.Title level={4}>出现错误</Typography.Title>
          <Typography.Text type="danger">
            {this.state.error?.message || '未知错误'}
          </Typography.Text>
          {this.state.error?.stack && (
            <details style={{ marginTop: 20, textAlign: 'left' }}>
              <summary>错误详情</summary>
              <pre style={{ 
                background: '#f5f5f5', 
                padding: 10, 
                overflow: 'auto',
                fontSize: 12
              }}>
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <div style={{ marginTop: 20 }}>
            <Button onClick={() => window.location.reload()}>
              重新加载
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
