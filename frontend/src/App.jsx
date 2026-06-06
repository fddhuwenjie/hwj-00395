import React, { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Button, notification, Badge } from 'antd'
import { HomeOutlined, PlusOutlined, UserOutlined, HistoryOutlined, TrophyOutlined, FundOutlined, LogoutOutlined, DollarOutlined, HeartOutlined, BellOutlined } from '@ant-design/icons'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import AuctionDetail from './pages/AuctionDetail.jsx'
import Publish from './pages/Publish.jsx'
import Profile from './pages/Profile.jsx'
import { initSocket, closeSocket } from './socket.js'

const { Header, Content } = Layout

const App = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [outbidCount, setOutbidCount] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem('auction_user')
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    const socket = initSocket()
    const handler = (data) => {
      notification.warning({
        message: '您关注的拍品被超价',
        description: `${data.bidderNickname} 以 ¥${Number(data.newPrice).toLocaleString()} 超过了您在《${data.auctionTitle}》的出价`,
        duration: 5,
        onClick: () => navigate(`/auction/${data.auctionId}`)
      })
      setOutbidCount(c => c + 1)
    }
    socket.on('bid:outbid', handler)
    socket.on('bid:new', (data) => {
      notification.info({
        message: '新出价通知',
        description: `${data.nickname} 在拍品中出价 ¥${Number(data.price).toLocaleString()}`,
        duration: 3
      })
    })
    return () => {
      socket.off('bid:outbid', handler)
    }
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('auction_token')
    localStorage.removeItem('auction_user')
    setUser(null)
    closeSocket()
    navigate('/')
  }

  const loginUser = (u, token) => {
    localStorage.setItem('auction_token', token)
    localStorage.setItem('auction_user', JSON.stringify(u))
    setUser(u)
  }

  const menuItems = useMemo(() => [
    { key: '/', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
  ], [])

  const profileMenu = [
    { key: 'profile', icon: <UserOutlined />, label: <Link to="/profile">个人中心</Link> },
    { key: 'publish', icon: <PlusOutlined />, label: <Link to="/publish">发布拍品</Link> },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout }
  ]

  const selectedKey = location.pathname === '/' ? '/' : location.pathname.startsWith('/profile') ? '/profile' : ''

  return (
    <Layout className="page-layout" style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#141414', padding: '0 24px' }}>
        <div className="logo">
          <span className="icon">🏛️</span>
          <span>在线拍卖</span>
        </div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ flex: 1, minWidth: 0, background: 'transparent', borderBottom: 'none' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user ? (
            <>
              {outbidCount > 0 && (
                <Badge count={outbidCount} offset={[-4, 4]}>
                  <Button type="text" icon={<BellOutlined />} style={{ color: '#fff' }} onClick={() => setOutbidCount(0)} />
                </Badge>
              )}
              <Dropdown menu={{ items: profileMenu }} placement="bottomRight">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#fff' }}>
                  <Avatar src={user.avatar} size={32} />
                  <span>{user.nickname}</span>
                  <span style={{ color: '#ffd666' }}>¥{Number(user.balance || 0).toLocaleString()}</span>
                </div>
              </Dropdown>
            </>
          ) : (
            <>
              <Link to="/login"><Button type="text" style={{ color: '#fff' }}>登录</Button></Link>
              <Link to="/register"><Button type="primary">注册</Button></Link>
            </>
          )}
        </div>
      </Header>
      <Content style={{ padding: '24px 0' }}>
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/login" element={<Login onLogin={loginUser} />} />
          <Route path="/register" element={<Register onLogin={loginUser} />} />
          <Route path="/auction/:id" element={<AuctionDetail user={user} setUser={setUser} />} />
          <Route path="/publish" element={<Publish user={user} />} />
          <Route path="/profile" element={<Profile user={user} setUser={setUser} />} />
        </Routes>
      </Content>
    </Layout>
  )
}

export default App
