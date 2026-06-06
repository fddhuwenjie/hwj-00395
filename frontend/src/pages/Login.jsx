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
    <div className="auth-page">
      <div className="auth-bg" />
      <Card className="auth-card luxury-card" title={<span style={{ fontFamily: '"Playfair Display", serif', fontSize: 22, color: '#d4af37' }}>⚜ 会员登录</span>}>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined style={{ color: '#d4af37' }} />} placeholder="用户名" className="luxury-input" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#d4af37' }} />} placeholder="密码" className="luxury-input" />
          </Form.Item>
          <Form.Item>
            <Button className="gold-btn" block htmlType="submit" loading={loading} style={{ height: 46, fontSize: 15 }}>登 录</Button>
          </Form.Item>
          <div style={{ textAlign: 'center', color: '#b8b8b8' }}>
            还没有账号？<Link to="/register" style={{ color: '#d4af37' }}>立即注册</Link>
          </div>
          <div style={{ textAlign: 'center', color: '#6c6c7a', fontSize: 12, marginTop: 16, padding: 12, background: 'rgba(212, 175, 55, 0.05)', borderRadius: 6 }}>
            测试账号：admin / 123456，buyer1 / 123456
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default Login
