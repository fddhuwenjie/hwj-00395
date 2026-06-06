import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Tabs, Button, Empty, Tag, Avatar, Carousel, Tooltip, message } from 'antd'
import { FireOutlined, EyeOutlined, RiseOutlined, DollarOutlined, HeartOutlined, HeartFilled, StarFilled, TrophyFilled, BellOutlined, BellFilled, TrophyOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import api, { specialApi, previewApi, reminderApi } from '../api.js'
import { getSocket } from '../socket.js'
import { Countdown, formatPrice, formatTime, StatusBadge, CreditScore, CertifiedBadge } from '../utils.jsx'

const Home = ({ user }) => {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [auctions, setAuctions] = useState([])
  const [tabKey, setTabKey] = useState('active')
  const [favoriteIds, setFavoriteIds] = useState([])
  const [watchIds, setWatchIds] = useState([])
  const [specials, setSpecials] = useState([])
  const [previewAuctions, setPreviewAuctions] = useState([])
  const [reminderIds, setReminderIds] = useState([])

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

  const loadData = async () => {
    try {
      const [s, a, sp, pr] = await Promise.all([
        api.get('/stats').catch(() => null),
        api.get('/auctions').catch(() => []),
        specialApi.list().catch(() => []),
        previewApi.list().catch(() => [])
      ])
      setStats(s && typeof s === 'object' ? s : null)
      setAuctions(Array.isArray(a) ? a : [])
      setSpecials(Array.isArray(sp) ? sp : [])
      setPreviewAuctions(Array.isArray(pr) ? pr : [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
    loadMyLists()
    const socket = getSocket()
    if (socket) {
      const handler = () => loadData()
      socket.on('bid:new', handler)
      socket.on('auction:timers', handler)
      socket.on('auction:started', handler)
      return () => {
        socket.off('bid:new', handler)
        socket.off('auction:timers', handler)
        socket.off('auction:started', handler)
      }
    }
  }, [user])

  const toggleFavorite = async (auctionId, e) => {
    e.stopPropagation()
    if (!user) { message.warning('请先登录'); return }
    try {
      const res = await api.post(`/auctions/${auctionId}/favorite`)
      setFavoriteIds(prev => res.favorited ? [...prev, auctionId] : prev.filter(id => id !== auctionId))
      setAuctions(prev => prev.map(a => a.id === auctionId ? { ...a, favoriteCount: Math.max(0, a.favoriteCount + (res.favorited ? 1 : -1)) } : a))
      message.success(res.favorited ? '已收藏' : '已取消收藏')
    } catch (e) {}
  }

  const toggleWatch = async (auctionId, e) => {
    e.stopPropagation()
    if (!user) { message.warning('请先登录'); return }
    try {
      const res = await api.post(`/auctions/${auctionId}/watch`)
      setWatchIds(prev => res.watched ? [...prev, auctionId] : prev.filter(id => id !== auctionId))
      setAuctions(prev => prev.map(a => a.id === auctionId ? { ...a, watcherCount: Math.max(0, a.watcherCount + (res.watched ? 1 : -1)) } : a))
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

  const filtered = auctions.filter(a => {
    if (tabKey === 'active') return a.status === 'active'
    if (tabKey === 'ended') return a.status === 'ended'
    return true
  })

  const activeAuctions = auctions.filter(a => a.status === 'active')
  const hotAuctions = [...activeAuctions].sort((a, b) => b.bidCount - a.bidCount).slice(0, 5)

  const trendOption = stats ? {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(22, 33, 62, 0.95)', borderColor: 'rgba(212, 175, 55, 0.3)', textStyle: { color: '#f5f5f5' } },
    legend: { data: ['出价次数', '成交额'], bottom: 0, textStyle: { color: '#b8b8b8' } },
    grid: { left: 50, right: 50, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: stats.dailyTrend.map(d => d.date), axisLabel: { color: '#b8b8b8' }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
    yAxis: [
      { type: 'value', name: '次数', axisLabel: { color: '#b8b8b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, nameTextStyle: { color: '#6c6c7a' } },
      { type: 'value', name: '金额(¥)', axisLabel: { color: '#b8b8b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }, nameTextStyle: { color: '#6c6c7a' } }
    ],
    series: [
      {
        name: '出价次数',
        type: 'line',
        smooth: true,
        data: stats.dailyTrend.map(d => d.bidCount),
        itemStyle: { color: '#d4af37' },
        lineStyle: { color: '#d4af37', width: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(212, 175, 55, 0.25)' }, { offset: 1, color: 'rgba(212, 175, 55, 0)' }] } }
      },
      {
        name: '成交额',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: stats.dailyTrend.map(d => d.salesAmount),
        itemStyle: { color: '#2ed573' },
        lineStyle: { color: '#2ed573', width: 2 }
      }
    ]
  } : null

  const priceOption = stats ? {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(22, 33, 62, 0.95)', borderColor: 'rgba(212, 175, 55, 0.3)', textStyle: { color: '#f5f5f5' } },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: stats.priceDistribution.map(d => d.range), axisLabel: { fontSize: 11, color: '#b8b8b8' }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } } },
    yAxis: { type: 'value', axisLabel: { color: '#b8b8b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } } },
    series: [{
      type: 'bar',
      data: stats.priceDistribution.map(d => d.count),
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#d4af37' }, { offset: 1, color: '#b8960c' }] },
        borderRadius: [4, 4, 0, 0]
      },
      barWidth: '50%'
    }]
  } : null

  const AuctionCard = ({ a, showWatchFav = true, showReminder = false }) => {
    const isFav = favoriteIds.includes(a.id)
    const isWatch = watchIds.includes(a.id)
    const hasReminder = reminderIds.includes(a.id)
    return (
      <Card
        className="auction-card"
        hoverable
        cover={
          <div style={{ position: 'relative' }}>
            <img src={a.images?.[0]} className="cover" alt={a.title} style={{ height: 240 }} />
            {showWatchFav && (
              <div className="card-floating-info">
                <div>
                  {a.status === 'active' && <StatusBadge status={a.status} />}
                  {a.status !== 'active' && <StatusBadge status={a.status} />}
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
                  {showReminder && (
                    <Tooltip title={hasReminder ? '取消开拍提醒' : '开拍提醒'}>
                      <div className="action-btn" onClick={(e) => toggleReminder(a.id, e)}>
                        {hasReminder ? <BellFilled style={{ color: '#ffa502' }} /> : <BellOutlined />}
                      </div>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}
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
          {a.status === 'active'
            ? <Countdown endTime={a.endTime} />
            : a.status === 'preview' || a.status === 'upcoming'
              ? <Countdown startTime={a.startTime} mode="start" />
              : <span>已结束</span>}
        </div>
      </Card>
    )
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 32px' }}>
      {hotAuctions.length > 0 && (
        <Carousel autoplay autoplaySpeed={4000} className="hero-banner" effect="fade">
          {hotAuctions.map(a => (
            <div key={a.id} className="banner-slide" onClick={() => navigate(`/auction/${a.id}`)} style={{ cursor: 'pointer' }}>
              <img src={a.images?.[0]} alt={a.title} />
              <div className="banner-overlay" />
              <div className="banner-content">
                <div style={{ marginBottom: 12 }}>
                  <span className="gold-tag" style={{ marginRight: 10 }}><FireOutlined /> 热门拍卖</span>
                  {a.hasCertification && <CertifiedBadge />}
                </div>
                <h1 className="banner-title">{a.title}</h1>
                <div className="banner-price">{formatPrice(a.currentPrice)}</div>
                <div className="banner-meta">
                  <Avatar size={36} src={a.sellerAvatar} style={{ border: '2px solid rgba(212, 175, 55, 0.5)' }} />
                  <div>
                    <div style={{ color: '#f5f5f5', fontWeight: 500 }}>{a.sellerNickname}</div>
                    <div style={{ color: '#b8b8b8', fontSize: 12 }}><CreditScore score={a.sellerCreditScore} /></div>
                  </div>
                  <div style={{ marginLeft: 20, color: '#b8b8b8' }}>
                    <TrophyFilled style={{ color: '#d4af37', marginRight: 4 }} />
                    {a.bidCount} 次出价
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <Countdown endTime={a.endTime} />
                  </div>
                  <Button className="gold-btn" style={{ marginLeft: 16 }} size="large">立即参拍</Button>
                </div>
              </div>
            </div>
          ))}
        </Carousel>
      )}

      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card">
              <div className="number">¥{Number(stats.todayAmount).toLocaleString()}</div>
              <div className="label"><DollarOutlined /> 今日成交额</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card">
              <div className="number" style={{ color: '#2ed573' }}>{stats.activeCount}</div>
              <div className="label"><RiseOutlined /> 活跃拍品数</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card">
              <div className="number" style={{ color: '#ffa502' }}>{stats.totalBidCount}</div>
              <div className="label"><FireOutlined /> 总出价次数</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card">
              <div className="number" style={{ color: '#ff4757' }}>{(stats.top5 || []).length}</div>
              <div className="label"><EyeOutlined /> 热门拍品 TOP5</div>
            </Card>
          </Col>
        </Row>
      )}

      {activeAuctions.length > 0 && (
        <div className="horizontal-scroll-section">
          <div className="section-title">🔥 正在热拍</div>
          <div className="scroll-container">
            <div style={{ display: 'flex', gap: 20, minWidth: 'min-content' }}>
              {activeAuctions.slice(0, 12).map(a => (
                <div key={a.id} style={{ width: 280, flexShrink: 0 }}>
                  <AuctionCard a={a} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {specials.length > 0 && (
        <div className="horizontal-scroll-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="section-title">🎭 热门专场</div>
            <Button type="link" onClick={() => navigate('/specials')} style={{ color: '#d4af37' }}>查看全部 →</Button>
          </div>
          <div className="scroll-container">
            <div style={{ display: 'flex', gap: 20, minWidth: 'min-content' }}>
              {specials.slice(0, 6).map(sp => {
                const isActive = Date.now() >= sp.startTime && Date.now() < sp.endTime
                const isUpcoming = Date.now() < sp.startTime
                return (
                  <Card
                    key={sp.id}
                    className="special-card"
                    hoverable
                    style={{ width: 320, flexShrink: 0 }}
                    onClick={() => navigate(`/special/${sp.id}`)}
                    cover={
                      <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
                        <img src={sp.coverImage} alt={sp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)'
                        }} />
                        <div style={{ position: 'absolute', top: 10, right: 10 }}>
                          <Tag color={isActive ? 'green' : isUpcoming ? 'blue' : 'default'} style={{ fontSize: 11 }}>
                            {isActive ? '进行中' : isUpcoming ? '即将开始' : '已结束'}
                          </Tag>
                        </div>
                        <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
                          <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: '"Playfair Display", serif' }}>
                            {sp.name}
                          </div>
                        </div>
                      </div>
                    }
                  >
                    <div style={{ color: '#b8b8b8', fontSize: 12, lineHeight: 1.6, height: 36, overflow: 'hidden' }}>
                      {sp.description}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                      <div style={{ fontSize: 13 }}>
                        <TrophyOutlined style={{ color: '#d4af37', marginRight: 4 }} />
                        <span style={{ color: '#f5f5f5' }}>{sp.auctionCount || 0} 件拍品</span>
                      </div>
                      <div style={{ marginLeft: 'auto' }}>
                        {isUpcoming
                          ? <Countdown startTime={sp.startTime} mode="start" />
                          : isActive
                            ? <Countdown endTime={sp.endTime} />
                            : <span style={{ color: '#6c6c7a', fontSize: 12 }}>已结束</span>}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {previewAuctions.length > 0 && (
        <div className="horizontal-scroll-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="section-title">🕒 即将开拍 · 预展中</div>
            <Button type="link" onClick={() => navigate('/preview')} style={{ color: '#d4af37' }}>全部预展 →</Button>
          </div>
          <div className="scroll-container">
            <div style={{ display: 'flex', gap: 20, minWidth: 'min-content' }}>
              {previewAuctions.slice(0, 8).map(a => (
                <div key={a.id} style={{ width: 280, flexShrink: 0 }}>
                  <AuctionCard a={a} showReminder={true} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          <Col xs={24} lg={14}>
            <Card className="luxury-card" title={<span style={{ fontFamily: '"Playfair Display", serif' }}>📈 近7天交易趋势</span>}>
              {trendOption && <ReactECharts option={trendOption} style={{ height: 280 }} />}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card className="luxury-card" title={<span style={{ fontFamily: '"Playfair Display", serif' }}>💰 成交价格分布</span>}>
              {priceOption && <ReactECharts option={priceOption} style={{ height: 280 }} />}
            </Card>
          </Col>
        </Row>
      )}

      <Card
        className="luxury-card"
        title={<span style={{ fontFamily: '"Playfair Display", serif' }}>🏛 拍卖广场</span>}
        extra={
          <Tabs activeKey={tabKey} onChange={setTabKey} size="small" className="tab-luxury" items={[
            { key: 'active', label: '进行中' },
            { key: 'ended', label: '已结束' },
            { key: 'all', label: '全部' }
          ]} />
        }
      >
        {filtered.length === 0 ? (
          <Empty description="暂无拍品" style={{ color: '#6c6c7a' }} />
        ) : (
          <Row gutter={[20, 20]}>
            {filtered.map(a => (
              <Col xs={24} sm={12} lg={6} key={a.id}>
                <AuctionCard a={a} />
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  )
}

export default Home
