import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Row, Col, Card, Avatar, Button, InputNumber, Descriptions, Tag, Modal, App, Carousel, Divider, Empty, Tooltip, Tabs, Input, Rate, Form, Select, message as antdMessage, Switch } from 'antd'
import { HeartOutlined, HeartFilled, DollarOutlined, RiseOutlined, UserOutlined, ExclamationCircleOutlined, EyeOutlined, EyeInvisibleOutlined, StarFilled, FlagOutlined, SafetyCertificateOutlined, HistoryOutlined, WarningOutlined, CheckCircleFilled, BellOutlined, BellFilled, RobotOutlined, TrophyOutlined } from '@ant-design/icons'
import api, { proxyBidApi, reminderApi } from '../api.js'
import { getSocket } from '../socket.js'
import { Countdown, formatPrice, formatTime, StatusBadge, CreditScore, CertifiedBadge, renderStars } from '../utils.jsx'

const { TextArea } = Input
const { Option } = Select

const AuctionDetail = ({ user, setUser }) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const [auction, setAuction] = useState(null)
  const [bids, setBids] = useState([])
  const [bidAmount, setBidAmount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [watched, setWatched] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [endTime, setEndTime] = useState(null)
  const [delayCount, setDelayCount] = useState(0)
  const [delayRecords, setDelayRecords] = useState([])
  const [reviewStatus, setReviewStatus] = useState({})
  const [reviewModal, setReviewModal] = useState(false)
  const [reviewForm] = Form.useForm()
  const [reportModal, setReportModal] = useState(false)
  const [reportForm] = Form.useForm()
  const [sellerReviews, setSellerReviews] = useState([])
  const [certModal, setCertModal] = useState(false)
  const [proxyBid, setProxyBid] = useState(null)
  const [hasReminder, setHasReminder] = useState(false)
  const [proxyModal, setProxyModal] = useState(false)
  const [proxyMaxPrice, setProxyMaxPrice] = useState(null)

  const loadAuction = async () => {
    try {
      const a = await api.get(`/auctions/${id}`)
      setAuction(a)
      setEndTime(a.endTime)
      setBidAmount(a.currentPrice + a.minIncrement)
      setDelayCount(a.delayCount || 0)
      setDelayRecords(a.delayRecords || [])
    } catch (e) {
      message.error(e.error || '加载失败')
    }
  }

  const loadBids = async () => {
    try {
      const b = await api.get(`/auctions/${id}/bids`)
      setBids(Array.isArray(b) ? b : [])
    } catch (e) {}
  }

  const loadStatuses = async () => {
    if (!user || !auction?.sellerId) return
    try {
      const [f, w, rs, sr, pb, rm] = await Promise.all([
        api.get('/favorites').catch(() => []),
        api.get('/watchlist').catch(() => []),
        api.get(`/auctions/${id}/review-status`).catch(() => ({})),
        api.get(`/users/${auction.sellerId}/reviews`).catch(() => []),
        proxyBidApi.get(id).catch(() => null),
        reminderApi.myIds().catch(() => [])
      ])
      setFavorited(Array.isArray(f) ? f.includes(id) || f.includes(Number(id)) : false)
      setWatched(Array.isArray(w) ? w.includes(id) || w.includes(Number(id)) : false)
      setReviewStatus(rs && typeof rs === 'object' ? rs : {})
      setSellerReviews(Array.isArray(sr) ? sr : [])
      setProxyBid(pb && pb.id ? pb : null)
      setHasReminder(Array.isArray(rm) ? rm.includes(id) || rm.includes(Number(id)) : false)
    } catch (e) {}
  }

  useEffect(() => {
    loadAuction()
    loadBids()
  }, [id])

  useEffect(() => {
    if (auction) loadStatuses()
  }, [auction?.sellerId, user])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const bidHandler = (data) => {
      if (data.auctionId !== Number(id)) return
      setBids(prev => [{
        id: data.id,
        userId: data.userId,
        nickname: data.nickname,
        avatar: data.avatar,
        price: data.price,
        time: data.time,
        isProxy: data.isProxy
      }, ...prev])
      setAuction(prev => prev ? { ...prev, currentPrice: data.price, bidCount: prev.bidCount + 1 } : prev)
      setBidAmount(data.price + (auction?.minIncrement || 0))
      if (data.auctionEndTime) setEndTime(data.auctionEndTime)
      if (data.delayed) {
        setDelayCount(prev => prev + 1)
        setDelayRecords(prev => [{
          id: Date.now(),
          delayNumber: prev.length + 1,
          triggerTime: new Date().toISOString(),
          triggerUserNickname: data.nickname,
          triggeredBy: data.userId,
          oldEndTime: endTime,
          newEndTime: data.auctionEndTime
        }, ...prev])
      }
    }
    const timerHandler = (statuses) => {
      if (statuses[id]) {
        setEndTime(statuses[id].endTime)
        setAuction(prev => prev ? { ...prev, currentPrice: statuses[id].currentPrice, bidCount: statuses[id].bidCount, status: statuses[id].status } : prev)
      }
    }
    socket.on('bid:new', bidHandler)
    socket.on('auction:timers', timerHandler)
    return () => {
      socket.off('bid:new', bidHandler)
      socket.off('auction:timers', timerHandler)
    }
  }, [id, auction, endTime])

  const handleReminder = async () => {
    if (!user) {
      modal.confirm({ title: '请先登录', okText: '去登录', onOk: () => navigate('/login') })
      return
    }
    try {
      const res = await reminderApi.toggle(id)
      setHasReminder(res.set)
      message.success(res.set ? '已设置开拍提醒，开拍时会通知您' : '已取消开拍提醒')
    } catch (e) {}
  }

  const handleSetProxy = async () => {
    if (!user) {
      modal.confirm({ title: '请先登录', okText: '去登录', onOk: () => navigate('/login') })
      return
    }
    if (auction?.sellerId === user?.id) {
      message.warning('不能对自己的拍品设置代理出价')
      return
    }
    if (!proxyMaxPrice || proxyMaxPrice < minBid) {
      message.warning(`代理出价上限必须不低于 ${formatPrice(minBid)}`)
      return
    }
    try {
      const res = await proxyBidApi.set(id, proxyMaxPrice)
      setProxyBid(res)
      setProxyModal(false)
      message.success(`代理出价已设置，上限 ${formatPrice(proxyMaxPrice)}`)
    } catch (e) {
      message.error(e.error || '设置失败')
    }
  }

  const handleCancelProxy = async () => {
    try {
      await proxyBidApi.cancel(id)
      setProxyBid(null)
      message.success('已取消代理出价')
    } catch (e) {}
  }

  const handleBid = async (buyNow = false, confirmed = false) => {
    if (!user) {
      modal.confirm({ title: '请先登录', content: '出价需要登录账户', okText: '去登录', onOk: () => navigate('/login') })
      return
    }
    if (auction?.status === 'preview' || auction?.status === 'upcoming') {
      message.warning('拍品正在预展中，尚未开始出价')
      return
    }
    if (auction?.sellerId === user?.id) {
      message.warning('不能对自己的拍品出价')
      return
    }
    const price = buyNow ? auction.buyNowPrice : bidAmount
    if (!buyNow && price < auction.currentPrice + auction.minIncrement) {
      message.warning(`出价必须不低于 ${formatPrice(auction.currentPrice + auction.minIncrement)}`)
      return
    }

    if (!confirmed && user.creditScore !== undefined && user.creditScore < 3) {
      modal.confirm({
        title: <span style={{ color: '#ff4757' }}><WarningOutlined /> 信用风险提示</span>,
        icon: null,
        content: (
          <div style={{ color: '#b8b8b8' }}>
            <p>您当前的信用评分为 <b style={{ color: '#ff4757' }}>{user.creditScore.toFixed(1)}</b> / 5.0</p>
            <p>信用分低于3分的出价需特别提示：</p>
            <ul>
              <li>若拍得后不付款，将扣除保证金并进一步降低信用分</li>
              <li>严重违规将被限制参与拍卖</li>
            </ul>
            <p>是否确认继续出价？</p>
          </div>
        ),
        okText: '确认出价',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: () => handleBid(buyNow, true)
      })
      return
    }

    modal.confirm({
      title: buyNow ? '确认一口价购买？' : '确认出价？',
      content: (
        <div>
          <p style={{ color: '#f5f5f5' }}>拍品：<b>{auction.title}</b></p>
          <p style={{ color: '#f5f5f5' }}>金额：<b style={{ color: '#d4af37', fontSize: 20 }}>{formatPrice(price)}</b></p>
          {!buyNow && <p style={{ color: '#ffa502' }}>将冻结保证金 {formatPrice(auction.deposit)}，未拍得可退回</p>}
          {delayCount >= 4 && <p style={{ color: '#ff4757' }}><WarningOutlined /> 本次拍卖已延时 {delayCount} 次，最多延时5次</p>}
        </div>
      ),
      onOk: async () => {
        setLoading(true)
        try {
          const res = await api.post(`/auctions/${id}/bid`, { price, buyNow, lowCreditConfirmed: confirmed })
          if (res.lowCredit) {
            setLoading(false)
            modal.confirm({
              title: <span style={{ color: '#ff4757' }}><WarningOutlined /> 信用风险提示</span>,
              icon: null,
              content: (
                <div style={{ color: '#b8b8b8' }}>
                  <p>您当前的信用评分为 <b style={{ color: '#ff4757' }}>{res.creditScore.toFixed(1)}</b> / 5.0</p>
                  <p>是否确认继续出价？</p>
                </div>
              ),
              okText: '确认出价',
              okButtonProps: { danger: true },
              onOk: () => handleBid(buyNow, true)
            })
            return
          }
          message.success(buyNow ? '购买成功！' : '出价成功！')
          setUser(prev => prev ? { ...prev, balance: prev.balance - (buyNow ? price : auction.deposit) } : prev)
          localStorage.setItem('auction_user', JSON.stringify({ ...user, balance: user.balance - (buyNow ? price : auction.deposit) }))
          loadAuction()
          loadBids()
        } catch (e) {
          message.error(e.error || '出价失败')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleWatch = async () => {
    if (!user) {
      modal.confirm({ title: '请先登录', okText: '去登录', onOk: () => navigate('/login') })
      return
    }
    try {
      const res = await api.post(`/auctions/${id}/watch`)
      setWatched(res.watched)
      message.success(res.watched ? '已关注，有新出价时将提醒您' : '已取消关注')
    } catch (e) {}
  }

  const handleFavorite = async () => {
    if (!user) {
      modal.confirm({ title: '请先登录', okText: '去登录', onOk: () => navigate('/login') })
      return
    }
    try {
      const res = await api.post(`/auctions/${id}/favorite`)
      setFavorited(res.favorited)
      message.success(res.favorited ? '已加入收藏' : '已取消收藏')
    } catch (e) {}
  }

  const submitReview = async () => {
    try {
      const values = await reviewForm.validateFields()
      await api.post(`/auctions/${id}/review`, values)
      message.success('评价提交成功！')
      setReviewModal(false)
      reviewForm.resetFields()
      loadStatuses()
    } catch (e) {
      message.error(e.error || '评价失败')
    }
  }

  const submitReport = async () => {
    try {
      const values = await reportForm.validateFields()
      await api.post('/reports', {
        auctionId: Number(id),
        reportedUserId: auction.sellerId,
        ...values
      })
      message.success('举报已提交，将在审核后处理')
      setReportModal(false)
      reportForm.resetFields()
    } catch (e) {
      message.error(e.error || '举报失败')
    }
  }

  if (!auction) return <div style={{ padding: 40, textAlign: 'center', color: '#b8b8b8' }}>加载中...</div>

  const isActive = auction.status === 'active'
  const minBid = auction.currentPrice + auction.minIncrement
  const isBuyer = user && auction.winnerId === user.id
  const isSeller = user && auction.sellerId === user.id

  const reviewTabContent = (
    <div>
      <div style={{ marginBottom: 20, padding: 20, background: 'rgba(212, 175, 55, 0.06)', borderRadius: 8, border: '1px solid rgba(212, 175, 55, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: '#b8b8b8', marginBottom: 4 }}>卖家综合信用</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CreditScore score={auction.sellerCreditScore} large />
              <span style={{ color: '#d4af37', fontWeight: 600, fontSize: 24, fontFamily: '"Playfair Display", serif' }}>
                {(auction.sellerCreditScore || 5).toFixed(1)}
              </span>
              <span style={{ color: '#6c6c7a', fontSize: 13 }}>基于 {(sellerReviews || []).length} 条评价</span>
            </div>
          </div>
          <Button className="gold-btn" icon={<FlagOutlined />} onClick={() => setReportModal(true)}>举报违规</Button>
        </div>
      </div>

      {(sellerReviews || []).length === 0 ? (
        <Empty description="暂无评价" style={{ color: '#6c6c7a' }} />
      ) : (
        (sellerReviews || []).map(r => (
          <div key={r.id} className="review-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar size={36} src={r.reviewerAvatar} style={{ border: '1px solid rgba(212, 175, 55, 0.3)' }} />
              <div>
                <div style={{ color: '#f5f5f5', fontWeight: 500 }}>{r.reviewerNickname}</div>
                <div style={{ color: '#6c6c7a', fontSize: 12 }}>{formatTime(r.createdAt)}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>{renderStars(r.rating)}</div>
            </div>
            {r.comment && <div style={{ marginTop: 12, color: '#b8b8b8', lineHeight: 1.7 }}>{r.comment}</div>}
            {r.auctionTitle && (
              <div style={{ marginTop: 10, color: '#6c6c7a', fontSize: 12 }}>
                拍品：{r.auctionTitle}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )

  const certificationTabContent = (
    <div>
      {auction.certification ? (
        <div className="certification-card">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <SafetyCertificateOutlined style={{ fontSize: 56, color: '#d4af37' }} />
            <div style={{ marginTop: 12, fontSize: 22, color: '#d4af37', fontWeight: 600, fontFamily: '"Playfair Display", serif' }}>已通过专业鉴定</div>
            <div style={{ color: '#b8b8b8', fontSize: 13, marginTop: 4 }}>本拍品由专业鉴定机构出具证书</div>
          </div>
          <Descriptions column={1} bordered size="middle" className="cert-descriptions">
            <Descriptions.Item label="鉴定机构">
              <span style={{ color: '#f5f5f5' }}>{auction.certification.agency}</span>
            </Descriptions.Item>
            <Descriptions.Item label="证书编号">
              <span style={{ color: '#d4af37', fontFamily: 'monospace' }}>{auction.certification.certificateNo}</span>
            </Descriptions.Item>
            <Descriptions.Item label="鉴定日期">
              <span style={{ color: '#f5f5f5' }}>{auction.certification.certDate}</span>
            </Descriptions.Item>
            <Descriptions.Item label="鉴定结论">
              <span style={{ color: '#2ed573' }}><CheckCircleFilled /> {auction.certification.conclusion}</span>
            </Descriptions.Item>
            <Descriptions.Item label="详细描述">
              <span style={{ color: '#b8b8b8', lineHeight: 1.7 }}>{auction.certification.description || '—'}</span>
            </Descriptions.Item>
          </Descriptions>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Button className="gold-btn" size="large" icon={<SafetyCertificateOutlined />} onClick={() => setCertModal(true)}>
              查看电子鉴定证书
            </Button>
          </div>
        </div>
      ) : (
        <Empty
          description={<span style={{ color: '#6c6c7a' }}>卖家未提供鉴定证书<br/>建议购买前与卖家确认拍品真伪</span>}
          style={{ padding: 40 }}
        />
      )}
    </div>
  )

  const delayTabContent = (
    <div>
      <div style={{ marginBottom: 24, padding: 20, background: 'rgba(212, 175, 55, 0.06)', borderRadius: 8, border: '1px solid rgba(212, 175, 55, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, color: '#b8b8b8', marginBottom: 4 }}>延时次数</div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: '"Playfair Display", serif', color: delayCount >= 4 ? '#ff4757' : '#d4af37' }}>
              {delayCount} <span style={{ fontSize: 14, color: '#6c6c7a' }}>/ 5</span>
            </div>
          </div>
          <div style={{ height: 40, width: 1, background: 'rgba(255,255,255,0.08)' }} />
          <div>
            <div style={{ fontSize: 13, color: '#b8b8b8', marginBottom: 4 }}>延时规则</div>
            <div style={{ color: '#f5f5f5', fontSize: 13 }}>最后5分钟出价 → 自动延时3分钟（最多5次）</div>
          </div>
        </div>
      </div>

      {(delayRecords || []).length === 0 ? (
        <Empty description="暂无延时记录" style={{ color: '#6c6c7a' }} />
      ) : (
        (delayRecords || []).map((r, idx) => (
          <div key={r.id || idx} className="delay-history-item">
            <div className="delay-number">#{r.delayNumber || (delayRecords || []).length - idx}</div>
            <div>
              <div style={{ color: '#f5f5f5' }}>
                <Avatar size={22} src={r.triggerUserAvatar} style={{ marginRight: 8 }} />
                {r.triggerUserNickname || '匿名用户'} 触发延时
              </div>
              <div style={{ color: '#6c6c7a', fontSize: 12, marginTop: 4 }}>
                <HistoryOutlined /> {formatTime(r.triggerTime)}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ color: '#b8b8b8', fontSize: 12 }}>原结束时间</div>
              <div style={{ color: '#ff4757', textDecoration: 'line-through', fontSize: 12 }}>{formatTime(r.oldEndTime)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#b8b8b8', fontSize: 12 }}>延时后</div>
              <div style={{ color: '#2ed573', fontSize: 12 }}>{formatTime(r.newEndTime)}</div>
            </div>
          </div>
        ))
      )}
    </div>
  )

  const detailTabItems = [
    { key: 'info', label: '商品详情', children: (
      <div>
        <Descriptions column={2} bordered size="middle" className="detail-descriptions">
          <Descriptions.Item label="分类"><span className="gold-tag">{auction.category}</span></Descriptions.Item>
          <Descriptions.Item label="状态"><StatusBadge status={auction.status} /></Descriptions.Item>
          {auction.specialName && (
            <Descriptions.Item label="所属专场" span={2}>
              <Tag color="gold" icon={<TrophyOutlined />} style={{ cursor: 'pointer' }} onClick={() => navigate(`/special/${auction.specialId}`)}>
                🎭 {auction.specialName}
              </Tag>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="起拍价">{formatPrice(auction.startPrice)}</Descriptions.Item>
          <Descriptions.Item label="加价幅度">{formatPrice(auction.minIncrement)}</Descriptions.Item>
          <Descriptions.Item label="保证金">{formatPrice(auction.deposit)}</Descriptions.Item>
          {auction.buyNowPrice && <Descriptions.Item label="一口价">{formatPrice(auction.buyNowPrice)}</Descriptions.Item>}
          <Descriptions.Item label="开始时间">{formatTime(auction.startTime)}</Descriptions.Item>
          <Descriptions.Item label="结束时间">{formatTime(auction.endTime)}</Descriptions.Item>
          <Descriptions.Item label="延时次数" span={2}>
            <Tag color={delayCount >= 4 ? 'red' : 'gold'}>已延时 {delayCount} 次 / 最多 5 次</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="卖家" span={2}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar size={28} src={auction.sellerAvatar} style={{ border: '1px solid rgba(212, 175, 55, 0.3)' }} />
              <span style={{ color: '#f5f5f5' }}>{auction.sellerNickname}</span>
              <CreditScore score={auction.sellerCreditScore} />
            </div>
          </Descriptions.Item>
        </Descriptions>
        <Divider />
        <div className="description-content" dangerouslySetInnerHTML={{ __html: auction.description }} />
      </div>
    )},
    { key: 'certification', label: <span><SafetyCertificateOutlined /> 鉴定证书</span>, children: certificationTabContent },
    { key: 'reviews', label: <span><StarFilled /> 卖家评价 ({sellerReviews.length})</span>, children: reviewTabContent },
    { key: 'delay', label: <span><HistoryOutlined /> 延时记录 ({delayRecords.length})</span>, children: delayTabContent }
  ]

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 32px' }}>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={15}>
          <Card className="detail-gallery luxury-card">
            {auction.images?.length > 0 ? (
              <>
                <div style={{ position: 'relative' }}>
                  <img src={auction.images[activeImage]} className="main-image" alt={auction.title} />
                  <div className="gallery-badges">
                    <StatusBadge status={auction.status} />
                    {auction.hasCertification && <CertifiedBadge />}
                    {delayCount > 0 && <Tag color="gold" className="gold-tag">已延时 {delayCount} 次</Tag>}
                  </div>
                </div>
                {auction.images.length > 1 && (
                  <div className="thumbs">
                    {auction.images.map((img, idx) => (
                      <img key={idx} src={img} className={idx === activeImage ? 'active' : ''} onClick={() => setActiveImage(idx)} alt="" />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ height: 400, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c6c7a' }}>暂无图片</div>
            )}
          </Card>

          <Card
            className="luxury-card"
            style={{ marginTop: 24 }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: '"Playfair Display", serif', fontSize: 18 }}>{auction.title}</span>
                {auction.hasCertification && <CertifiedBadge />}
              </div>
            }
          >
            <Tabs items={detailTabItems} defaultActiveKey="info" className="tab-luxury" />
          </Card>

          <Card className="luxury-card" title={<span style={{ fontFamily: '"Playfair Display", serif' }}>出价记录 ({auction.bidCount})</span>} style={{ marginTop: 24 }}>
            {(bids || []).length === 0 ? (
              <Empty description="暂无出价" style={{ color: '#6c6c7a' }} />
            ) : (
              (bids || []).map(b => (
                <div className="bid-record" key={b.id}>
                  <Avatar src={b.avatar} size={36} style={{ border: '1px solid rgba(212, 175, 55, 0.2)' }} />
                  <div className="info">
                    <div className="nickname" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {b.nickname}
                      {b.isProxy && <Tag color="purple" style={{ fontSize: 11 }} icon={<RobotOutlined />}>代理出价</Tag>}
                    </div>
                    <div className="time">{formatTime(b.time)}</div>
                  </div>
                  <div className="price">{formatPrice(b.price)}</div>
                </div>
              ))
            )}
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <div className="bid-panel" style={{ position: 'sticky', top: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <StatusBadge status={auction.status} />
                {auction.hasCertification && <CertifiedBadge />}
                {auction.specialName && (
                  <Tag color="gold" style={{ fontSize: 11 }} icon={<TrophyOutlined />}>🎭 {auction.specialName}</Tag>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <Tooltip title={favorited ? '取消收藏' : '收藏'}>
                  <Button
                    type="text"
                    icon={favorited ? <HeartFilled style={{ color: '#ff4757' }} /> : <HeartOutlined />}
                    onClick={handleFavorite}
                  >
                    {auction.favoriteCount || 0}
                  </Button>
                </Tooltip>
                <Tooltip title={watched ? '已关注，新出价提醒' : '关注拍品'}>
                  <Button
                    type="text"
                    icon={watched ? <StarFilled style={{ color: '#d4af37' }} /> : <EyeOutlined />}
                    onClick={handleWatch}
                  >
                    {auction.watcherCount || 0}
                  </Button>
                </Tooltip>
                {(auction.status === 'preview' || auction.status === 'upcoming') && (
                  <Tooltip title={hasReminder ? '取消开拍提醒' : '开拍提醒'}>
                    <Button
                      type="text"
                      icon={hasReminder ? <BellFilled style={{ color: '#ffa502' }} /> : <BellOutlined />}
                      onClick={handleReminder}
                    />
                  </Tooltip>
                )}
              </div>
            </div>

            <h2 style={{ margin: '16px 0', lineHeight: 1.4, fontFamily: '"Playfair Display", "Noto Serif SC", serif', color: '#f5f5f5' }}>{auction.title}</h2>

            {auction.status === 'ended' ? (
              <div>
                <div style={{ color: '#b8b8b8', marginBottom: 8 }}>最终成交价</div>
                <div className="current-price">{formatPrice(auction.finalPrice || auction.currentPrice)}</div>
                {auction.winnerId ? (
                  <div style={{ color: '#2ed573', marginTop: 12 }}>
                    <span className="won-badge">已成交</span>
                    <span style={{ marginLeft: 8 }}>得主：{auction.winnerNickname || '匿名买家'}</span>
                  </div>
                ) : (
                  <div style={{ color: '#b8b8b8', marginTop: 12 }}>流拍，无买家成交</div>
                )}
                <Divider />
                <div style={{ fontSize: 13, color: '#b8b8b8', marginBottom: 12 }}>卖家信用</div>
                <div style={{ marginBottom: 16 }}>
                  <Avatar size={28} src={auction.sellerAvatar} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  <span style={{ color: '#f5f5f5' }}>{auction.sellerNickname}</span>
                  <span style={{ marginLeft: 10 }}><CreditScore score={auction.sellerCreditScore} /></span>
                </div>
                {auction.status === 'ended' && (isBuyer || isSeller) && (
                  <>
                    {isBuyer && !reviewStatus.buyerReviewed && (
                      <Button className="gold-btn" block icon={<StarFilled />} onClick={() => { reviewForm.setFieldsValue({ role: 'buyer' }); setReviewModal(true) }}>
                        评价卖家
                      </Button>
                    )}
                    {isBuyer && reviewStatus.buyerReviewed && (
                      <Tag color="green" style={{ width: '100%', textAlign: 'center', padding: '8px 0', fontSize: 13, borderRadius: 6 }}>
                        <CheckCircleFilled /> 您已完成评价
                      </Tag>
                    )}
                    {isSeller && auction.winnerId && !reviewStatus.sellerReviewed && (
                      <Button className="gold-btn" block style={{ marginTop: 8 }} icon={<StarFilled />} onClick={() => { reviewForm.setFieldsValue({ role: 'seller' }); setReviewModal(true) }}>
                        评价买家
                      </Button>
                    )}
                    {isSeller && auction.winnerId && reviewStatus.sellerReviewed && (
                      <Tag color="green" style={{ width: '100%', textAlign: 'center', padding: '8px 0', fontSize: 13, borderRadius: 6, marginTop: 8 }}>
                        <CheckCircleFilled /> 您已完成评价
                      </Tag>
                    )}
                  </>
                )}
              </div>
            ) : auction.status === 'preview' || auction.status === 'upcoming' ? (
              <div>
                <div style={{ color: '#b8b8b8', marginBottom: 8 }}>
                  {auction.status === 'preview' ? '预展起始价' : '起始价'}
                </div>
                <div className="current-price">{formatPrice(auction.startPrice)}</div>

                <div className="countdown-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                    <span style={{ color: '#b8b8b8' }}>
                      {auction.status === 'preview' ? '距开拍' : '距开始'}
                    </span>
                    {auction.status === 'preview' && <Tag color="blue" style={{ fontSize: 11 }}>预展中 · 可查看不可出价</Tag>}
                  </div>
                  <Countdown startTime={auction.startTime} mode="start" large />
                  <div style={{ color: '#b8b8b8', fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                    <ExclamationCircleOutlined style={{ color: '#ffa502' }} /> {auction.status === 'preview' ? '开拍前可查看详情，开拍后可以出价' : '距离开拍还有7天以上，开拍前7天进入预展'}
                  </div>
                </div>

                <div style={{ marginTop: 16, padding: 16, background: 'rgba(212, 175, 55, 0.06)', borderRadius: 8, border: '1px solid rgba(212, 175, 55, 0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ color: '#f5f5f5', fontWeight: 500 }}>
                        <BellOutlined style={{ color: '#ffa502' }} /> 开拍提醒
                      </div>
                      <div style={{ color: '#6c6c7a', fontSize: 12, marginTop: 4 }}>
                        {hasReminder ? '已开启，开拍时会通知您' : '开启后，开拍时将通过站内消息通知您'}
                      </div>
                    </div>
                    <Switch checked={hasReminder} onChange={handleReminder} />
                  </div>
                </div>

                <Divider />
                <div style={{ fontSize: 13, color: '#b8b8b8', marginBottom: 12 }}>卖家信用</div>
                <div>
                  <Avatar size={28} src={auction.sellerAvatar} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  <span style={{ color: '#f5f5f5' }}>{auction.sellerNickname}</span>
                  <span style={{ marginLeft: 10 }}><CreditScore score={auction.sellerCreditScore} /></span>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ color: '#b8b8b8', marginBottom: 8 }}>当前价格</div>
                <div className="current-price">{formatPrice(auction.currentPrice)}</div>

                {proxyBid && (
                  <div style={{ marginTop: 8, padding: 10, background: 'rgba(155, 89, 182, 0.1)', borderRadius: 6, border: '1px solid rgba(155, 89, 182, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Tag color="purple" icon={<RobotOutlined />} style={{ fontSize: 11 }}>代理出价中</Tag>
                      <div style={{ color: '#b8b8b8', fontSize: 12, marginTop: 4 }}>上限：<span style={{ color: '#d4af37' }}>{formatPrice(proxyBid.maxPrice)}</span></div>
                    </div>
                    <Button size="small" danger type="text" onClick={handleCancelProxy}>取消</Button>
                  </div>
                )}

                <div className="countdown-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                    <span style={{ color: '#b8b8b8' }}>距结束</span>
                    {delayCount > 0 && <Tag color="gold" className="gold-tag" style={{ fontSize: 11 }}>已延时 {delayCount}/5</Tag>}
                  </div>
                  <Countdown endTime={endTime || auction.endTime} large />
                  <div style={{ color: '#b8b8b8', fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                    <ExclamationCircleOutlined style={{ color: '#ffa502' }} /> 最后5分钟内有新出价将自动延时3分钟（最多5次）
                  </div>
                </div>

                {isActive && (
                  <>
                    <div style={{ marginTop: 16 }}>
                      <div style={{ marginBottom: 8, color: '#b8b8b8' }}>
                        最低出价：<b style={{ color: '#d4af37' }}>{formatPrice(minBid)}</b>
                      </div>
                      <InputNumber
                        size="large"
                        style={{ width: '100%' }}
                        min={minBid}
                        step={auction.minIncrement}
                        value={bidAmount}
                        onChange={setBidAmount}
                        formatter={v => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={v => v.replace(/[^\d]/g, '')}
                        className="luxury-input"
                      />
                    </div>
                    <Button
                      type="primary"
                      block
                      className="big-btn gold-btn"
                      loading={loading}
                      icon={<RiseOutlined />}
                      style={{ marginTop: 12 }}
                      onClick={() => handleBid(false)}
                    >
                      出 价
                    </Button>
                    <Button
                      block
                      className="big-btn"
                      style={{ marginTop: 8, background: 'rgba(155, 89, 182, 0.15)', border: '1px solid rgba(155, 89, 182, 0.4)', color: '#c586c0' }}
                      icon={<RobotOutlined />}
                      onClick={() => { setProxyMaxPrice(auction.currentPrice + auction.minIncrement * 5); setProxyModal(true) }}
                    >
                      {proxyBid ? '修改代理出价' : '设置代理出价（自动跟价）'}
                    </Button>
                    {auction.buyNowPrice && (
                      <Button
                        block
                        className="big-btn"
                        loading={loading}
                        icon={<DollarOutlined />}
                        style={{ marginTop: 8, background: 'linear-gradient(135deg, #ff4757 0%, #c0392b 100%)', border: 'none', color: '#fff' }}
                        onClick={() => handleBid(true)}
                      >
                        一口价购买 {formatPrice(auction.buyNowPrice)}
                      </Button>
                    )}
                    <div style={{ marginTop: 12, color: '#6c6c7a', fontSize: 12, lineHeight: 1.8 }}>
                      <div>• 出价前将冻结保证金 <b style={{ color: '#b8b8b8' }}>{formatPrice(auction.deposit)}</b></div>
                      <div>• 拍得后扣除尾款，未拍得保证金自动退回</div>
                      <div>• 账户余额：<b style={{ color: '#d4af37' }}>{user ? formatPrice(user.balance) : '-'}</b></div>
                      <div style={{ color: '#c586c0' }}>• 代理出价：系统会自动以最小加价幅度跟价，直到上限</div>
                      {user && user.creditScore < 3 && (
                        <div style={{ color: '#ff4757', marginTop: 8, padding: 8, background: 'rgba(255, 71, 87, 0.08)', borderRadius: 4 }}>
                          <WarningOutlined /> 您的信用分为 {user.creditScore.toFixed(1)}，出价需二次确认
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </Col>
      </Row>

      <Modal
        title={<span style={{ fontFamily: '"Playfair Display", serif', fontSize: 18 }}>发表评价</span>}
        open={reviewModal}
        onCancel={() => setReviewModal(false)}
        onOk={submitReview}
        okText="提交评价"
        okButtonProps={{ className: 'gold-btn' }}
        width={500}
      >
        <Form form={reviewForm} layout="vertical">
          <Form.Item name="role" hidden><Input /></Form.Item>
          <Form.Item name="rating" label="评分" rules={[{ required: true, message: '请选择评分' }]} initialValue={5}>
            <Rate style={{ fontSize: 24 }} />
          </Form.Item>
          <Form.Item name="comment" label="评价内容" rules={[{ max: 500, message: '评价最多500字' }]}>
            <TextArea rows={4} placeholder="请分享您的交易体验..." maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span style={{ fontFamily: '"Playfair Display", serif', fontSize: 18 }}><FlagOutlined /> 举报违规</span>}
        open={reportModal}
        onCancel={() => setReportModal(false)}
        onOk={submitReport}
        okText="提交举报"
        okButtonProps={{ danger: true }}
        width={500}
      >
        <Form form={reportForm} layout="vertical">
          <Form.Item name="type" label="违规类型" rules={[{ required: true, message: '请选择违规类型' }]}>
            <Select placeholder="请选择">
              <Option value="fake">虚假描述/假货</Option>
              <Option value="malicious_bid">恶意出价不付款</Option>
              <Option value="fraud">欺诈行为</Option>
              <Option value="other">其他违规</Option>
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="详细说明" rules={[{ required: true, message: '请填写举报说明' }, { max: 500, message: '最多500字' }]}>
            <TextArea rows={4} placeholder="请详细描述违规行为..." maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span style={{ fontFamily: '"Playfair Display", serif', fontSize: 18 }}><RobotOutlined style={{ color: '#c586c0' }} /> 设置代理出价</span>}
        open={proxyModal}
        onCancel={() => setProxyModal(false)}
        onOk={handleSetProxy}
        okText="确认设置"
        okButtonProps={{ style: { background: 'linear-gradient(135deg, #9b59b6 0%, #6c3483 100%)', border: 'none' } }}
        width={460}
      >
        <div style={{ color: '#b8b8b8', fontSize: 13, lineHeight: 1.8, padding: 12, background: 'rgba(155, 89, 182, 0.06)', borderRadius: 6, border: '1px solid rgba(155, 89, 182, 0.15)', marginBottom: 16 }}>
          <div>🤖 当有其他买家出价时，系统会自动以<b style={{ color: '#c586c0' }}>最小加价幅度</b>替您跟价</div>
          <div>直到达到您设置的<b style={{ color: '#d4af37' }}>上限价格</b>为止，帮您省去手动出价的麻烦</div>
          {proxyBid && <div style={{ marginTop: 6, color: '#ffa502' }}>⚠ 当前已有代理出价：上限 {formatPrice(proxyBid.maxPrice)}，设置新的将覆盖原有设置</div>}
        </div>
        <div style={{ marginBottom: 8, color: '#b8b8b8' }}>
          当前价：<b style={{ color: '#f5f5f5' }}>{formatPrice(auction?.currentPrice)}</b>
          <span style={{ margin: '0 12px', color: '#6c6c7a' }}>|</span>
          最低出价：<b style={{ color: '#d4af37' }}>{formatPrice(minBid)}</b>
        </div>
        <div style={{ color: '#b8b8b8', marginBottom: 8 }}>代理出价上限</div>
        <InputNumber
          size="large"
          style={{ width: '100%' }}
          min={minBid}
          step={auction?.minIncrement || 100}
          value={proxyMaxPrice}
          onChange={setProxyMaxPrice}
          formatter={v => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={v => v.replace(/[^\d]/g, '')}
          className="luxury-input"
        />
        <div style={{ color: '#6c6c7a', fontSize: 12, marginTop: 10 }}>
          建议设置高于当前价和您心理预期的价格，系统不会一开始就出到上限
        </div>
      </Modal>

      <Modal
        title={<span style={{ fontFamily: '"Playfair Display", serif', fontSize: 20, color: '#d4af37' }}><SafetyCertificateOutlined /> 电子鉴定证书</span>}
        open={certModal}
        onCancel={() => setCertModal(false)}
        footer={[<Button key="close" className="gold-btn" onClick={() => setCertModal(false)}>关闭</Button>]}
        width={680}
      >
        {auction.certification && (
          <div className="cert-template">
            <div className="cert-header">
              <div className="cert-logo">⚜</div>
              <div className="cert-title">LUXE AUCTION 鉴定证书</div>
              <div className="cert-subtitle">PROFESSIONAL CERTIFICATE OF AUTHENTICITY</div>
            </div>
            <div className="cert-body">
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 14, color: '#6c6c7a', marginBottom: 8 }}>证书编号 / Certificate No.</div>
                <div style={{ fontSize: 22, fontFamily: 'monospace', letterSpacing: 4, color: '#d4af37' }}>{auction.certification.certificateNo}</div>
              </div>
              <Descriptions column={1} bordered size="middle" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <Descriptions.Item label="鉴定机构"><span style={{ color: '#f5f5f5' }}>{auction.certification.agency}</span></Descriptions.Item>
                <Descriptions.Item label="拍品名称"><span style={{ color: '#f5f5f5' }}>{auction.title}</span></Descriptions.Item>
                <Descriptions.Item label="鉴定日期"><span style={{ color: '#f5f5f5' }}>{auction.certification.certDate}</span></Descriptions.Item>
                <Descriptions.Item label="鉴定结论">
                  <span style={{ color: '#2ed573', fontWeight: 600 }}>{auction.certification.conclusion}</span>
                </Descriptions.Item>
                {auction.certification.description && (
                  <Descriptions.Item label="鉴定描述">
                    <span style={{ color: '#b8b8b8', lineHeight: 1.7 }}>{auction.certification.description}</span>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
            <div className="cert-footer">
              <div className="cert-anti-counterfeit">
                防伪编号 / Anti-Counterfeit: <b>{`LUXE-${auction.certification.certificateNo}-${auction.id}-${Date.now().toString(36).toUpperCase()}`}</b>
              </div>
              <div className="cert-watermark">⚜ LUXE AUCTION ⚜</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AuctionDetail
