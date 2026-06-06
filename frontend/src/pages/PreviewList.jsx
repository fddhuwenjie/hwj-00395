import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Empty, Tag, Avatar, Tooltip, Button, message } from 'antd'
import { HeartOutlined, HeartFilled, EyeOutlined, StarFilled, BellOutlined, BellFilled, TrophyOutlined } from '@ant-design/icons'
import api, { previewApi, reminderApi } from '../api.js'
import { Countdown, formatPrice, StatusBadge, CreditScore, CertifiedBadge } from '../utils.jsx'

const PreviewList = () => {
  const navigate = useNavigate()
  const [auctions, setAuctions] = useState([])
  const [favoriteIds, setFavoriteIds] = useState([])
  const [watchIds, setWatchIds] = useState([])
  const [reminderIds, setReminderIds] = useState([])
  const [user] = useState(() => {
    try {
      const saved = localStorage.getItem('auction_user')
      return saved ? JSON.parse(saved) : null
    } catch (e) { return null }
  })

  const loadData = async () => {
    try {
      const list = await previewApi.list()
      setAuctions(Array.isArray(list) ? list : [])
    } catch (e) {}
  }

  const loadMyLists = async () => {
    if (!user) return
    try {
      const [f, w, r] = await Promise.all([
        api.get('/favorites').catch(() => []),
        api.get('/watchlist').catch(() => []),
        reminderApi.myIds().catch(() => [])
      ])
      setFavoriteIds(Array.isArray(f) ? f : [])
      setWatchIds(Array.isArray(w) ? w : [])
      setReminderIds(Array.isArray(r) ? r : [])
    } catch (e) {}
  }

  useEffect(() => {
    loadData()
    loadMyLists()
  }, [user])

  const toggleFavorite = async (auctionId, e) => {
    e.stopPropagation()
    if (!user) { message.warning('请先登录'); return }
    try {
      const res = await api.post(`/auctions/${auctionId}/favorite`)
      setFavoriteIds(prev => res.favorited ? [...prev, auctionId] : prev.filter(id => id !== auctionId))
      message.success(res.favorited ? '已收藏' : '已取消收藏')
    } catch (e) {}
  }

  const toggleWatch = async (auctionId, e) => {
    e.stopPropagation()
    if (!user) { message.warning('请先登录'); return }
    try {
      const res = await api.post(`/auctions/${auctionId}/watch`)
      setWatchIds(prev => res.watched ? [...prev, auctionId] : prev.filter(id => id !== auctionId))
      message.success(res.watched ? '已关注' : '已取消关注')
    } catch (e) {}
  }

  const toggleReminder = async (auctionId, e) => {
    e.stopPropagation()
    if (!user) { message.warning('请先登录'); return }
    try {
      const res = await reminderApi.toggle(auctionId)
      setReminderIds(prev => res.set ? [...prev, auctionId] : prev.filter(id => id !== auctionId))
      message.success(res.set ? '已设置开拍提醒' : '已取消开拍提醒')
    } catch (e) {}
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 32px' }}>
      <Card className="luxury-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32 }}>🕒</span>
          <div>
            <h1 style={{ margin: 0, fontFamily: '"Playfair Display", serif', fontSize: 28, color: '#f5f5f5' }}>预展拍品</h1>
            <div style={{ color: '#b8b8b8', marginTop: 4 }}>即将开拍的珍品 · 抢先预览 · 设开拍提醒不错过</div>
          </div>
        </div>
      </Card>

      {auctions.length === 0 ? (
        <Empty description="暂无预展拍品" style={{ color: '#6c6c7a' }} />
      ) : (
        <Row gutter={[20, 20]}>
          {auctions.map(a => {
            const isFav = favoriteIds.includes(a.id)
            const isWatch = watchIds.includes(a.id)
            const hasReminder = reminderIds.includes(a.id)
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
                          <Tooltip title={hasReminder ? '取消开拍提醒' : '开拍提醒'}>
                            <div className="action-btn" onClick={(e) => toggleReminder(a.id, e)}>
                              {hasReminder ? <BellFilled style={{ color: '#ffa502' }} /> : <BellOutlined />}
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
                  {a.specialName && (
                    <Tag color="gold" style={{ fontSize: 11, marginBottom: 6 }}>🎭 {a.specialName}</Tag>
                  )}
                  <div style={{ fontSize: 15, fontWeight: 500, height: 48, overflow: 'hidden', lineHeight: 1.4, color: '#f5f5f5' }}>{a.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <Avatar size={22} src={a.sellerAvatar} style={{ border: '1px solid rgba(212, 175, 55, 0.3)' }} />
                    <span style={{ fontSize: 12, color: '#b8b8b8' }}>{a.sellerNickname}</span>
                    <span style={{ marginLeft: 'auto' }}><CreditScore score={a.sellerCreditScore} /></span>
                  </div>
                  <div className="price" style={{ marginTop: 12 }}>{formatPrice(a.currentPrice)}</div>
                  <div className="meta">
                    <span style={{ display: 'flex', gap: 8 }}>
                      <TrophyOutlined style={{ color: '#d4af37' }} /> 起始价
                    </span>
                    <Countdown startTime={a.startTime} mode="start" />
                  </div>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}
    </div>
  )
}

export default PreviewList
