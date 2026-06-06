import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, Card, App } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import api from '../api.js'
import { initSocket, closeSocket } from '../socket.js'

const Login = ({ onLogin }) => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/login', values)
      closeSocket()
      onLogin(res.user, res.token)
      initSocket()
      message.success('登录成功')
      navigate('/')
    } catch (e) {
      message.error(e.error || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card title="登录" style={{ width: 400 }}>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" block htmlType="submit" loading={loading}>登 录</Button>
          </Form.Item>
          <div style={{ textAlign: 'center', color: '#999' }}>
            还没有账号？<Link to="/register">立即注册</Link>
          </div>
          <div style={{ textAlign: 'center', color: '#bbb', fontSize: 12, marginTop: 12 }}>
            测试账号：admin / 123456，buyer1 / 123456
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default Login
