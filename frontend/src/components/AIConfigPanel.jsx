import React, { useEffect, useState } from 'react'
import { Button, Input, Form, Card, message, Typography, Space, Alert, Modal, Progress, List } from 'antd'
import { SettingOutlined, SaveOutlined, ReloadOutlined, PictureOutlined } from '@ant-design/icons'

const { TextArea } = Input

export default function AIConfigPanel({ onClose }) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [configPath, setConfigPath] = useState('')
  const [migrateModalVisible, setMigrateModalVisible] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState(null)

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

  // 执行图片迁移
  async function handleMigrateImages() {
    try {
      setMigrating(true)
      setMigrateResult(null)
      const result = await window.go.backend.App.MigrateBase64ImagesToLocal()
      setMigrateResult(result)
      if (result.success) {
        message.success(`迁移完成！处理了 ${result.processedNotes} 条笔记，迁移了 ${result.migratedImages} 张图片`)
      } else {
        message.warning(`迁移完成，但有 ${result.errors?.length || 0} 个错误`)
      }
    } catch (e) {
      console.error('迁移失败:', e)
      message.error('迁移失败: ' + (e.message || '未知错误'))
    } finally {
      setMigrating(false)
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

        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #f0f0f0' }}>
          <Alert
            message="图片迁移工具"
            description="将笔记中的 base64 格式图片转换为本地文件格式，可以节省数据库空间并提高性能。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Button
            type="default"
            icon={<PictureOutlined />}
            onClick={() => setMigrateModalVisible(true)}
            block
          >
            迁移 Base64 图片到本地
          </Button>
        </div>
      </Card>

      {/* 迁移对话框 */}
      <Modal
        title="图片迁移"
        open={migrateModalVisible}
        onCancel={() => {
          setMigrateModalVisible(false)
          setMigrateResult(null)
        }}
        footer={[
          <Button key="close" onClick={() => {
            setMigrateModalVisible(false)
            setMigrateResult(null)
          }}>
            {migrateResult ? '关闭' : '取消'}
          </Button>,
          !migrateResult && (
            <Button
              key="migrate"
              type="primary"
              onClick={handleMigrateImages}
              loading={migrating}
            >
              开始迁移
            </Button>
          )
        ]}
        width={600}
      >
        {!migrateResult ? (
          <div>
            <Alert
              message="迁移说明"
              description={
                <div>
                  <p>此操作将：</p>
                  <ul>
                    <li>扫描所有笔记中的 base64 格式图片</li>
                    <li>将图片保存到本地文件系统</li>
                    <li>更新笔记内容，将 base64 替换为本地路径</li>
                  </ul>
                  <p style={{ marginTop: 12, color: '#ff4d4f' }}>
                    <strong>注意：此操作不可逆，建议先备份数据。</strong>
                  </p>
                </div>
              }
              type="warning"
              showIcon
            />
            {migrating && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Progress percent={100} status="active" />
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  正在迁移中，请稍候...
                </Typography.Text>
              </div>
            )}
          </div>
        ) : (
          <div>
            <Alert
              message={migrateResult.success ? "迁移成功" : "迁移完成（有错误）"}
              type={migrateResult.success ? "success" : "warning"}
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div style={{ marginBottom: 16 }}>
              <Typography.Text strong>统计信息：</Typography.Text>
              <List size="small" style={{ marginTop: 8 }}>
                <List.Item>
                  <Typography.Text>总笔记数：</Typography.Text>
                  <Typography.Text strong style={{ marginLeft: 8 }}>
                    {migrateResult.totalNotes}
                  </Typography.Text>
                </List.Item>
                <List.Item>
                  <Typography.Text>已处理笔记：</Typography.Text>
                  <Typography.Text strong style={{ marginLeft: 8 }}>
                    {migrateResult.processedNotes}
                  </Typography.Text>
                </List.Item>
                <List.Item>
                  <Typography.Text>找到图片数：</Typography.Text>
                  <Typography.Text strong style={{ marginLeft: 8 }}>
                    {migrateResult.totalImages}
                  </Typography.Text>
                </List.Item>
                <List.Item>
                  <Typography.Text>已迁移图片：</Typography.Text>
                  <Typography.Text strong style={{ marginLeft: 8, color: '#52c41a' }}>
                    {migrateResult.migratedImages}
                  </Typography.Text>
                </List.Item>
              </List>
            </div>
            {migrateResult.errors && migrateResult.errors.length > 0 && (
              <div>
                <Typography.Text strong type="danger">错误信息：</Typography.Text>
                <List
                  size="small"
                  style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}
                  dataSource={migrateResult.errors}
                  renderItem={(error) => (
                    <List.Item>
                      <Typography.Text type="danger" style={{ fontSize: 12 }}>
                        {error}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

