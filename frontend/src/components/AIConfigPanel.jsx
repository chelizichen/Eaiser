import React, { useEffect, useState } from 'react'
import { Button, Input, Form, Card, message, Typography, Space, Alert } from 'antd'
import { SettingOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons'

const { TextArea } = Input

export default function AIConfigPanel({ onClose }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [configPath, setConfigPath] = useState('')

  async function loadConfig() {
    try {
      const config = await window.go.backend.App.GetAIConfig()
      form.setFieldsValue({
        apiKey: config.apiKey || '',
        apiURL: config.apiURL || '',
        model: config.model || ''
      })
      
      // 获取配置文件路径
      const path = await window.go.backend.App.GetConfigFilePath()
      setConfigPath(path)
    } catch (e) {
      console.error('加载配置失败:', e)
      message.error('加载配置失败: ' + (e.message || '未知错误'))
    }
  }

  async function saveConfig() {
    try {
      setLoading(true)
      const values = await form.validateFields()
      await window.go.backend.App.UpdateAIConfig({
        apiKey: values.apiKey || '',
        apiURL: values.apiURL || '',
        model: values.model || ''
      })
      message.success('配置已保存')
      if (onClose) {
        onClose()
      }
    } catch (e) {
      console.error('保存配置失败:', e)
      if (e.errorFields) {
        // 表单验证错误
        return
      }
      message.error('保存配置失败: ' + (e.message || '未知错误'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>AI 配置</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadConfig}
            >
              重新加载
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={saveConfig}
              loading={loading}
            >
              保存
            </Button>
          </Space>
        }
      >
        <Alert
          message="配置说明"
          description={
            <div>
              <p>配置将保存到本地配置文件：<code>{configPath}</code></p>
              <p>修改配置后需要保存才能生效。</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={saveConfig}
        >
          <Form.Item
            label="API Key"
            name="apiKey"
            rules={[
              { required: true, message: '请输入 API Key' }
            ]}
            tooltip="OpenAI API Key 或兼容的 API Key"
          >
            <Input.Password
              placeholder="sk-..."
              autoComplete="off"
            />
          </Form.Item>

          <Form.Item
            label="API URL"
            name="apiURL"
            rules={[
              { required: true, message: '请输入 API URL' },
              { type: 'url', message: '请输入有效的 URL' }
            ]}
            tooltip="AI API 的完整 URL 地址"
          >
            <Input
              placeholder="https://api.example.com/v1/chat/completions"
            />
          </Form.Item>

          <Form.Item
            label="Model"
            name="model"
            rules={[
              { required: true, message: '请输入模型名称' }
            ]}
            tooltip="要使用的 AI 模型名称"
          >
            <Input
              placeholder="gpt-3.5-turbo"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={loading}
              >
                保存配置
              </Button>
              <Button
                onClick={() => {
                  form.resetFields()
                  loadConfig()
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

