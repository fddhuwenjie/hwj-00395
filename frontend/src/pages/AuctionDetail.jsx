import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Row, Col, Card, Avatar, Button, InputNumber, Descriptions, Tag, Modal, App, Carousel, Divider, Empty, Tooltip } from 'antd'
import { HeartOutlined, HeartFilled, DollarOutlined, RiseOutlined, UserOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import api from '../api.js'
import { getSocket } from '../socket.js'
import { Countdown, formatPrice, formatTime, StatusBadge } from '../utils.jsx'

const AuctionDetail = ({ user, setUser }) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const [auction, setAuction] = useState(null)
  const [bids, setBids] = useState([])
  const [bidAmount, setBidAmount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [watched, setWatched] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [endTime, setEndTime] = useState(null)

  const loadAuction = async () => {
    try {
      const a = await api.get(`/auctions/${id}`)
      setAuction(a)
      setEndTime(a.endTime)
      setBidAmount(a.currentPrice + a.minIncrement)
    } catch (e) {
      message.error(e.error || '加载失败')
    }
  }

  const loadBids = async () => {
    try {
      const b = await api.get(`/auctions/${id}/bids`)
      setBids(b)
    } catch (e) {}
  }

  const loadWatchStatus = async () => {
    if (!user) return
    try {
      const list = await api.get('/watchlist')
      setWatched(list.includes(id))
    } catch (e) {}
  }

  useEffect(() => {
    loadAuction()
    loadBids()
    loadWatchStatus()
  }, [id, user])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    const bidHandler = (data) => {
      if (data.auctionId !== id) return
      setBids(prev => [{
        id: data.id,
        userId: data.userId,
        nickname: data.nickname,
        avatar: data.avatar,
        price: data.price,
        time: data.time
      }, ...prev])
      setAuction(prev => prev ? { ...prev, currentPrice: data.price, bidCount: prev.bidCount + 1 } : prev)
      setBidAmount(data.price + (auction?.minIncrement || 0))
      if (data.auctionEndTime) setEndTime(data.auctionEndTime)
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
  }, [id, auction])

  const handleBid = async (buyNow = false) => {
    if (!user) {
      modal.confirm({ title: '请先登录', content: '出价需要登录账户', okText: '去登录', onOk: () => navigate('/login') })
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
    modal.confirm({
      title: buyNow ? '确认一口价购买？' : '确认出价？',
      content: (
        <div>
          <p>拍品：<b>{auction.title}</b></p>
          <p>金额：<b style={{ color: '#f5222d' }}>{formatPrice(price)}</b></p>
          {!buyNow && <p style={{ color: '#fa8c16' }}>将冻结保证金 {formatPrice(auction.deposit)}，未拍得可退回</p>}
        </div>
      ),
      onOk: async () => {
        setLoading(true)
        try {
          const res = await api.post(`/auctions/${id}/bid`, { price, buyNow })
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
      message.success(res.watched ? '已关注' : '已取消关注')
    } catch (e) {}
  }

  if (!auction) return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>

  const isActive = auction.status === 'active'
  const minBid = auction.currentPrice + auction.minIncrement

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px' }}>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={15}>
          <Card className="detail-gallery">
            {auction.images?.length > 0 ? (
              <>
                <img src={auction.images[activeImage]} className="main-image" />
                {auction.images.length > 1 && (
                  <div className="thumbs">
                    {auction.images.map((img, idx) => (
                      <img key={idx} src={img} className={idx === activeImage ? 'active' : ''} onClick={() => setActiveImage(idx)} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ height: 400, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>暂无图片</div>
            )}
          </Card>

          <Card title="商品详情" style={{ marginTop: 24 }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="分类"><Tag color="blue">{auction.category}</Tag></Descriptions.Item>
              <Descriptions.Item label="状态"><StatusBadge status={auction.status} /></Descriptions.Item>
              <Descriptions.Item label="起拍价">{formatPrice(auction.startPrice)}</Descriptions.Item>
              <Descriptions.Item label="加价幅度">{formatPrice(auction.minIncrement)}</Descriptions.Item>
              <Descriptions.Item label="保证金">{formatPrice(auction.deposit)}</Descriptions.Item>
              {auction.buyNowPrice && <Descriptions.Item label="一口价">{formatPrice(auction.buyNowPrice)}</Descriptions.Item>}
              <Descriptions.Item label="开始时间">{formatTime(auction.startTime)}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{formatTime(auction.endTime)}</Descriptions.Item>
              <Descriptions.Item label="卖家" span={2}>
                <Avatar size={20} src={auction.sellerAvatar} /> <span style={{ marginLeft: 8 }}>{auction.sellerNickname}</span>
              </Descriptions.Item>
            </Descriptions>
            <Divider />
            <div dangerouslySetInnerHTML={{ __html: auction.description }} />
          </Card>

          <Card title={`出价记录 (${auction.bidCount})`} style={{ marginTop: 24 }}>
            {bids.length === 0 ? (
              <Empty description="暂无出价" />
            ) : (
              bids.map(b => (
                <div className="bid-record" key={b.id}>
                  <Avatar src={b.avatar} size={36} />
                  <div className="info">
                    <div className="nickname">{b.nickname}</div>
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
              <StatusBadge status={auction.status} />
              <Button
                type="text"
                icon={watched ? <HeartFilled style={{ color: '#f5222d' }} /> : <HeartOutlined />}
                onClick={handleWatch}
              >
                {watched ? '已关注' : '关注'} ({auction.watcherCount})
              </Button>
            </div>
            <h2 style={{ margin: '16px 0', lineHeight: 1.4 }}>{auction.title}</h2>

            {auction.status === 'ended' ? (
              <div>
                <div style={{ color: '#999', marginBottom: 8 }}>最终成交价</div>
                <div className="current-price">{formatPrice(auction.finalPrice || auction.currentPrice)}</div>
                {auction.winnerId ? (
                  <div style={{ color: '#52c41a', marginTop: 12 }}>
                    <span className="won-badge">已成交</span>
                    <span style={{ marginLeft: 8 }}>得主：{auction.winnerNickname || '匿名买家'}</span>
                  </div>
                ) : (
                  <div style={{ color: '#999', marginTop: 12 }}>流拍，无买家成交</div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ color: '#999', marginBottom: 8 }}>当前价格</div>
                <div className="current-price">{formatPrice(auction.currentPrice)}</div>

                <div style={{ background: '#fff', padding: 12, borderRadius: 6, marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#666' }}>距结束</span>
                    <Countdown endTime={endTime || auction.endTime} />
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>
                    <ExclamationCircleOutlined /> 最后5分钟内有新出价将自动延时3分钟
                  </div>
                </div>

                {isActive && (
                  <>
                    <div style={{ marginTop: 16 }}>
                      <div style={{ marginBottom: 8, color: '#666' }}>
                        最低出价：<b style={{ color: '#f5222d' }}>{formatPrice(minBid)}</b>
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
                      />
                    </div>
                    <Button
                      type="primary"
                      danger
                      block
                      className="big-btn"
                      loading={loading}
                      icon={<RiseOutlined />}
                      style={{ marginTop: 12 }}
                      onClick={() => handleBid(false)}
                    >
                      出 价
                    </Button>
                    {auction.buyNowPrice && (
                      <Button
                        type="primary"
                        block
                        className="big-btn"
                        loading={loading}
                        icon={<DollarOutlined />}
                        style={{ marginTop: 8, background: '#fa8c16', borderColor: '#fa8c16' }}
                        onClick={() => handleBid(true)}
                      >
                        一口价购买 {formatPrice(auction.buyNowPrice)}
                      </Button>
                    )}
                    <div style={{ marginTop: 12, color: '#999', fontSize: 12, lineHeight: 1.6 }}>
                      <div>• 出价前将冻结保证金 {formatPrice(auction.deposit)}</div>
                      <div>• 拍得后扣除尾款，未拍得保证金自动退回</div>
                      <div>• 账户余额：<b>{user ? formatPrice(user.balance) : '-'}</b></div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default AuctionDetail
