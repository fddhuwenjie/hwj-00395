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
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card title="注册" style={{ width: 400 }}>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="nickname" rules={[{ required: true, message: '请输入昵称' }]}>
            <Input prefix={<IdcardOutlined />} placeholder="昵称" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item name="confirmPassword" rules={[{ required: true, message: '请确认密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" block htmlType="submit" loading={loading}>注 册</Button>
          </Form.Item>
          <div style={{ textAlign: 'center', color: '#999' }}>
            已有账号？<Link to="/login">立即登录</Link>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default Register
