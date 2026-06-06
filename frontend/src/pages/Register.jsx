import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, Card, App } from 'antd'
import { UserOutlined, LockOutlined, IdcardOutlined } from '@ant-design/icons'
import api from '../api.js'
import { initSocket, closeSocket } from '../socket.js'

const Register = ({ onLogin }) => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/register', {
        username: values.username,
        password: values.password,
        nickname: values.nickname
      })
      closeSocket()
      onLogin(res.user, res.token)
      initSocket()
      message.success('注册成功，已赠送10000元体验金')
      navigate('/')
    } catch (e) {
      message.error(e.error || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <Card className="auth-card luxury-card" title={<span style={{ fontFamily: '"Playfair Display", serif', fontSize: 22, color: '#d4af37' }}>⚜ 加入会员</span>}>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined style={{ color: '#d4af37' }} />} placeholder="用户名" className="luxury-input" />
          </Form.Item>
          <Form.Item name="nickname" rules={[{ required: true, message: '请输入昵称' }]}>
            <Input prefix={<IdcardOutlined style={{ color: '#d4af37' }} />} placeholder="昵称" className="luxury-input" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#d4af37' }} />} placeholder="密码（至少6位）" className="luxury-input" />
          </Form.Item>
          <Form.Item name="confirmPassword" rules={[{ required: true, message: '请确认密码' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#d4af37' }} />} placeholder="确认密码" className="luxury-input" />
          </Form.Item>
          <Form.Item>
            <Button className="gold-btn" block htmlType="submit" loading={loading} style={{ height: 46, fontSize: 15 }}>注 册</Button>
          </Form.Item>
          <div style={{ textAlign: 'center', color: '#b8b8b8' }}>
            已有账号？<Link to="/login" style={{ color: '#d4af37' }}>立即登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default Register
