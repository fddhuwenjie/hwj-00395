import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Row, Col, Card, Empty, Avatar, Tag, Tooltip, Button, message } from 'antd'
import { HeartOutlined, HeartFilled, EyeOutlined, StarFilled, TrophyOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import api, { specialApi } from '../api.js'
import { Countdown, formatPrice, StatusBadge, CreditScore, CertifiedBadge } from '../utils.jsx'

const SpecialDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [special, setSpecial] = useState(null)
  const [favoriteIds, setFavoriteIds] = useState([])
  const [watchIds, setWatchIds] = useState([])
  const [user] = useState(() => {
    try {
      const saved = localStorage.getItem('auction_user')
      return saved ? JSON.parse(saved) : null
    } catch (e) { return null }
  })

  const loadMyLists = async () => {
    if (!user) return
    try {
      const [f, w] = await Promise.all([
        api.get('/favorites').catch(() => []),
        api.get('/watchlist').catch(() => [])
      ])
      setFavoriteIds(Array.isArray(f) ? f : [])
      setWatchIds(Array.isArray(w) ? w : [])
    } catch (e) {}
  }

  useEffect(() => {
    const load = async () => {
      try {
        const sp = await specialApi.get(id)
        setSpecial(sp)
      } catch (e) {
        message.error('专场不存在')
      }
    }
    load()
    loadMyLists()
  }, [id, user])

  const toggleFavorite = async (auctionId, e) => {
    e.stopPropagation()
    if (!user) { message.warning('请先登录'); return }
    try {
      const res = await api.post(`/auctions/${auctionId}/favorite`)
      setFavoriteIds(prev => res.favorited ? [...prev, auctionId] : prev.filter(x => x !== auctionId))
      message.success(res.favorited ? '已收藏' : '已取消收藏')
    } catch (e) {}
  }

  const toggleWatch = async (auctionId, e) => {
    e.stopPropagation()
    if (!user) { message.warning('请先登录'); return }
    try {
      const res = await api.post(`/auctions/${auctionId}/watch`)
      setWatchIds(prev => res.watched ? [...prev, auctionId] : prev.filter(x => x !== auctionId))
      message.success(res.watched ? '已关注' : '已取消关注')
    } catch (e) {}
  }

  if (!special) return <div style={{ padding: 40, textAlign: 'center', color: '#b8b8b8' }}>加载中...</div>

  const auctions = special.auctions || []

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 32px' }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/specials')}
        style={{ color: '#d4af37', marginBottom: 16 }}
      >
        返回专场列表
      </Button>

      <Card className="luxury-card" style={{ marginBottom: 24 }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={8}>
            <img
              src={special.coverImage}
              alt={special.name}
              style={{ width: '100%', borderRadius: 8, height: 200, objectFit: 'cover' }}
            />
          </Col>
          <Col xs={24} md={16}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <Tag color="gold" className="gold-tag" style={{ fontSize: 14 }}>🎭 专场拍卖</Tag>
              <Tag color="green">{Date.now() < special.endTime ? (Date.now() > special.startTime ? '进行中' : '即将开始') : '已结束'}</Tag>
            </div>
            <h1 style={{ margin: '0 0 12px', fontFamily: '"Playfair Display", serif', fontSize: 32, color: '#f5f5f5' }}>
              {special.name}
            </h1>
            <div style={{ color: '#b8b8b8', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
              {special.description}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#b8b8b8', fontSize: 12 }}>拍品总数</div>
                <div style={{ color: '#d4af37', fontSize: 22, fontWeight: 600, fontFamily: '"Playfair Display", serif' }}>
                  {auctions.length}
                </div>
              </div>
              <div>
                <div style={{ color: '#b8b8b8', fontSize: 12 }}>
                  {Date.now() > special.endTime ? '结束时间' : (Date.now() < special.startTime ? '距开始' : '距结束')}
                </div>
                <div style={{ color: '#f5f5f5' }}>
                  {Date.now() < special.startTime
                    ? <Countdown startTime={special.startTime} mode="start" />
                    : Date.now() < special.endTime
                      ? <Countdown endTime={special.endTime} />
                      : '已结束'}
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      <Card
        className="luxury-card"
        title={<span style={{ fontFamily: '"Playfair Display", serif' }}>🏛 专场拍品 ({auctions.length})</span>}
      >
        {auctions.length === 0 ? (
          <Empty description="本专场暂无拍品" style={{ color: '#6c6c7a' }} />
        ) : (
          <Row gutter={[20, 20]}>
            {auctions.map(a => {
              const isFav = favoriteIds.includes(a.id)
              const isWatch = watchIds.includes(a.id)
              return (
                <Col xs={24} sm={12} lg={6} key={a.id}>
                  <Card
                    className="auction-card"
                    hoverable
                    cover={
                      <div style={{ position: 'relative' }}>
                        <img src={a.images?.[0]} className="cover" alt={a.title} style={{ height: 240 }} />
                        <div className="card-floating-info">
                          <div>
                            <StatusBadge status={a.status} />
                          </div>
                          <div className="card-actions">
                            <Tooltip title={isFav ? '取消收藏' : '收藏'}>
                              <div className="action-btn" onClick={(e) => toggleFavorite(a.id, e)}>
                                {isFav ? <HeartFilled style={{ color: '#ff4757' }} /> : <HeartOutlined />}
                              </div>
                            </Tooltip>
                            <Tooltip title={isWatch ? '取消关注' : '关注'}>
                              <div className="action-btn" onClick={(e) => toggleWatch(a.id, e)}>
                                {isWatch ? <StarFilled /> : <EyeOutlined />}
                              </div>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    }
                    onClick={() => navigate(`/auction/${a.id}`)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                      <span className="gold-tag">{a.category}</span>
                      {a.hasCertification && <CertifiedBadge />}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 500, height: 48, overflow: 'hidden', lineHeight: 1.4, color: '#f5f5f5' }}>{a.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                      <Avatar size={22} src={a.sellerAvatar} style={{ border: '1px solid rgba(212, 175, 55, 0.3)' }} />
                      <span style={{ fontSize: 12, color: '#b8b8b8' }}>{a.sellerNickname}</span>
                      <span style={{ marginLeft: 'auto' }}><CreditScore score={a.sellerCreditScore} /></span>
                    </div>
                    <div className="price" style={{ marginTop: 12 }}>{formatPrice(a.currentPrice)}</div>
                    <div className="meta">
                      <span style={{ display: 'flex', gap: 8 }}>
                        <TrophyOutlined style={{ color: '#d4af37' }} /> {a.bidCount} 次出价
                      </span>
                      {a.status === 'active' ? <Countdown endTime={a.endTime} /> : a.status === 'preview' || a.status === 'upcoming' ? <Countdown startTime={a.startTime} mode="start" /> : <span>已结束</span>}
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>
        )}
      </Card>
    </div>
  )
}

export default SpecialDetail
