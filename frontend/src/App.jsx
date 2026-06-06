import React, { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Button, notification, Badge, Tooltip } from 'antd'
import { HomeOutlined, PlusOutlined, UserOutlined, LogoutOutlined, BellOutlined, HeartFilled, EyeOutlined, TrophyOutlined, ShopOutlined } from '@ant-design/icons'
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
    const outbidHandler = (data) => {
      notification.warning({
        message: '您的出价已被超越',
        description: `${data.bidderNickname} 以 ¥${Number(data.newPrice).toLocaleString()} 超过了您在《${data.auctionTitle}》的出价`,
        duration: 5,
        className: 'toast-gold',
        onClick: () => navigate(`/auction/${data.auctionId}`)
      })
      setOutbidCount(c => c + 1)
    }
    const watchNotifyHandler = (data) => {
      notification.info({
        message: '您关注的拍品有人出价',
        description: `《${data.auctionTitle}》${data.bidderNickname} 出价 ¥${Number(data.newPrice).toLocaleString()}`,
        duration: 5,
        className: 'toast-gold',
        onClick: () => navigate(`/auction/${data.auctionId}`)
      })
    }
    socket.on('bid:outbid', outbidHandler)
    socket.on('watch:bid_notify', watchNotifyHandler)
    return () => {
      socket.off('bid:outbid', outbidHandler)
      socket.off('watch:bid_notify', watchNotifyHandler)
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
    { key: 'favorites', icon: <HeartFilled />, label: <Link to="/profile?tab=favorites">我的收藏</Link> },
    { key: 'watchlist', icon: <EyeOutlined />, label: <Link to="/profile?tab=watchlist">我的关注</Link> },
    { key: 'won', icon: <TrophyOutlined />, label: <Link to="/profile?tab=won">拍得商品</Link> },
    { type: 'divider' },
    { key: 'publish', icon: <PlusOutlined />, label: <Link to="/publish">发布拍品</Link> },
    { key: 'mysold', icon: <ShopOutlined />, label: <Link to="/profile?tab=published">我发布的</Link> },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout }
  ]

  const selectedKey = location.pathname === '/' ? '/' : location.pathname.startsWith('/profile') ? '/profile' : ''

  return (
    <Layout className="page-layout" style={{ minHeight: '100vh', background: 'transparent' }}>
      <Header className="luxury-header" style={{ display: 'flex', alignItems: 'center' }}>
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span className="icon">⚜</span>
          <span>LUXE AUCTION</span>
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
                  <Tooltip title="消息通知">
                    <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} style={{ color: '#d4af37' }} onClick={() => setOutbidCount(0)} />
                  </Tooltip>
                </Badge>
              )}
              <Dropdown menu={{ items: profileMenu }} placement="bottomRight">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: '#f5f5f5' }}>
                  <Avatar src={user.avatar} size={36} style={{ border: '2px solid rgba(212, 175, 55, 0.5)' }} />
                  <div style={{ lineHeight: 1.2 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{user.nickname}</div>
                    <div style={{ fontSize: 12, color: '#d4af37', fontFamily: '"Playfair Display", serif' }}>¥{Number(user.balance || 0).toLocaleString()}</div>
                  </div>
                </div>
              </Dropdown>
            </>
          ) : (
            <>
              <Link to="/login"><Button className="gold-btn-outline">登录</Button></Link>
              <Link to="/register"><Button className="gold-btn">注册</Button></Link>
            </>
          )}
        </div>
      </Header>
      <Content style={{ padding: '32px 0' }}>
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
