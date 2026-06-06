import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Tabs, Avatar, Button, Table, Tag, Modal, App, Empty, List, Divider, InputNumber, Rate, Tooltip } from 'antd'
import { UserOutlined, PlusOutlined, DollarOutlined, TrophyOutlined, RiseOutlined, ShoppingCartOutlined, HistoryOutlined, HeartOutlined, StarFilled, SafetyCertificateOutlined, EyeOutlined, RobotOutlined, StopOutlined } from '@ant-design/icons'
import api, { proxyBidApi } from '../api.js'
import { formatPrice, formatTime, StatusBadge, Countdown, CreditScore, CertifiedBadge, renderStars } from '../utils.jsx'

const Profile = ({ user, setUser }) => {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const [myAuctions, setMyAuctions] = useState([])
  const [myBids, setMyBids] = useState([])
  const [myWon, setMyWon] = useState([])
  const [transactions, setTransactions] = useState([])
  const [favorites, setFavorites] = useState([])
  const [watchlist, setWatchlist] = useState([])
  const [myReviews, setMyReviews] = useState([])
  const [rechargeModal, setRechargeModal] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState(1000)
  const [bidHistory, setBidHistory] = useState(null)
  const [historyAuction, setHistoryAuction] = useState(null)
  const [creditScore, setCreditScore] = useState(5)
  const [activeKey, setActiveKey] = useState('published')
  const [proxyBids, setProxyBids] = useState([])

  const loadAll = async () => {
    try {
      const [a, b, w, t, f, wt, mr, cr, pb] = await Promise.all([
        api.get('/my/auctions').catch(() => []),
        api.get('/my/bids').catch(() => []),
        api.get('/my/won').catch(() => []),
        api.get('/my/transactions').catch(() => []),
        api.get('/favorites').catch(() => []),
        api.get('/watchlist').catch(() => []),
        api.get(`/users/${user.id}/reviews`).catch(() => []),
        api.get(`/users/${user.id}/credit`).catch(() => ({ score: 5 })),
        proxyBidApi.myList().catch(() => [])
      ])
      setMyAuctions(Array.isArray(a) ? a : [])
      setMyBids(Array.isArray(b) ? b : [])
      setMyWon(Array.isArray(w) ? w : [])
      setTransactions(Array.isArray(t) ? t : [])
      setFavorites(Array.isArray(f) ? f : [])
      setWatchlist(Array.isArray(wt) ? wt : [])
      setMyReviews(Array.isArray(mr) ? mr : [])
      setCreditScore(cr?.score ?? 5)
      setProxyBids(Array.isArray(pb) ? pb : [])
    } catch (e) {
      if (e.error === '未登录') navigate('/login')
    }
  }

  useEffect(() => {
    if (user) loadAll()
  }, [user])

  const handleRecharge = async () => {
    try {
      const res = await api.post('/wallet/recharge', { amount: rechargeAmount })
      const newUser = { ...user, balance: res.balance }
      setUser(newUser)
      localStorage.setItem('auction_user', JSON.stringify(newUser))
      message.success(`充值成功！已到账 ${formatPrice(rechargeAmount)}`)
      setRechargeModal(false)
      loadAll()
    } catch (e) {
      message.error(e.error || '充值失败')
    }
  }

  const viewBidHistory = async (auction) => {
    try {
      const bids = await api.get(`/auctions/${auction.id}/bids`)
      setBidHistory(bids)
      setHistoryAuction(auction)
    } catch (e) {}
  }

  const cancelProxyBid = async (pb) => {
    modal.confirm({
      title: '确认取消代理出价？',
      content: `拍品：${pb.auction?.title || pb.auctionTitle}\n上限：${formatPrice(pb.maxPrice)}`,
      onOk: async () => {
        try {
          await proxyBidApi.cancel(pb.auctionId || pb.auction_id)
          message.success('已取消代理出价')
          loadAll()
        } catch (e) {
          message.error(e.error || '取消失败')
        }
      }
    })
  }

  const txColumns = [
    { title: '类型', dataIndex: 'type', width: 100, render: t => <Tag color={t === 'income' ? 'green' : t === 'deposit' ? 'orange' : 'red'}>{t === 'income' ? '收入' : t === 'deposit' ? '保证金' : '支出'}</Tag> },
    { title: '金额', dataIndex: 'amount', width: 140, render: (v, r) => <span style={{ color: r.type === 'income' ? '#2ed573' : '#ff4757', fontWeight: 'bold' }}>{r.type === 'income' ? '+' : '-'}{formatPrice(v)}</span> },
    { title: '描述', dataIndex: 'description' },
    { title: '时间', dataIndex: 'createdAt', width: 180, render: v => formatTime(v) }
  ]

  const myAuctionColumns = [
    { title: '拍品', dataIndex: 'title', render: (v, r) => <a onClick={() => navigate(`/auction/${r.id}`)} style={{ color: '#f5f5f5' }}>{v}</a> },
    { title: '分类', dataIndex: 'category', width: 100, render: v => <span className="gold-tag">{v}</span> },
    { title: '当前价', dataIndex: 'currentPrice', width: 120, render: v => <b style={{ color: '#d4af37' }}>{formatPrice(v)}</b> },
    { title: '出价数', dataIndex: 'bidCount', width: 80 },
    { title: '状态', dataIndex: 'status', width: 100, render: s => <StatusBadge status={s} /> },
    { title: '操作', width: 120, render: (_, r) => (
      <Button type="link" onClick={() => viewBidHistory(r)}>出价历史</Button>
    ) }
  ]

  const renderAuctionList = (items, emptyText) => (items || []).length === 0 ? <Empty description={emptyText} /> : (
    <Row gutter={[16, 16]}>
      {(items || []).map(item => (
        <Col xs={24} sm={12} lg={8} xl={6} key={item.id}>
          <Card
            className="auction-card small"
            hoverable
            onClick={() => navigate(`/auction/${item.id}`)}
            cover={item.images?.[0] ? <img src={item.images[0]} style={{ height: 160, objectFit: 'cover' }} /> : undefined}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
              <span className="gold-tag">{item.category}</span>
              {item.hasCertification && <CertifiedBadge small />}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#f5f5f5', height: 40, overflow: 'hidden', lineHeight: 1.3 }}>{item.title}</div>
            <div className="price" style={{ marginTop: 8 }}>{formatPrice(item.currentPrice || item.finalPrice)}</div>
            <div className="meta">
              <span><TrophyOutlined style={{ color: '#d4af37' }} /> {item.bidCount || 0} 次出价</span>
              {item.status === 'active' ? <Countdown endTime={item.endTime} /> : <StatusBadge status={item.status} />}
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  )

  if (!user) return <div className="empty-state">请先登录</div>

  const tabItems = [
    {
      key: 'published', label: <span><RiseOutlined /> 我发布的 ({(myAuctions || []).length})</span>, children: (myAuctions || []).length === 0 ? <Empty description="还没有发布任何拍品" /> : (
        <Table columns={myAuctionColumns} dataSource={myAuctions || []} rowKey="id" pagination={{ pageSize: 5 }} />
      )
    },
    {
      key: 'bidding', label: <span><ShoppingCartOutlined /> 我参与竞价的 ({(myBids || []).length})</span>, children: (myBids || []).length === 0 ? <Empty description="还没有参与任何竞价" /> : (
        <Table
          rowKey="id"
          pagination={{ pageSize: 5 }}
          columns={[
            { title: '拍品', dataIndex: 'title', render: (v, r) => <a onClick={() => navigate(`/auction/${r.id}`)} style={{ color: '#f5f5f5' }}>{v}</a> },
            { title: '分类', dataIndex: 'category', width: 100, render: v => <span className="gold-tag">{v}</span> },
            { title: '我的最高出价', dataIndex: 'myMaxBid', width: 140, render: v => <b style={{ color: '#d4af37' }}>{formatPrice(v)}</b> },
            { title: '当前价', dataIndex: 'currentPrice', width: 140, render: (v, r) => <b style={{ color: v > r.myMaxBid ? '#ff4757' : '#2ed573' }}>{formatPrice(v)}</b> },
            { title: '状态', dataIndex: 'status', width: 100, render: s => <StatusBadge status={s} /> }
          ]}
          dataSource={myBids || []}
        />
      )
    },
    {
      key: 'won', label: <span><TrophyOutlined /> 我拍得的 ({(myWon || []).length})</span>, children: renderAuctionList(myWon, '还没有拍得任何商品')
    },
    {
      key: 'proxy', label: <span><RobotOutlined /> 代理出价 ({(proxyBids || []).length})</span>, children: (proxyBids || []).length === 0 ? (
        <Empty description="暂无代理出价，去拍品详情页设置自动跟价">
          <Button className="gold-btn" onClick={() => navigate('/')}>去竞拍</Button>
        </Empty>
      ) : (
        <Table
          rowKey="id"
          pagination={{ pageSize: 8 }}
          dataSource={proxyBids || []}
          columns={[
            {
              title: '拍品',
              dataIndex: 'auction',
              render: (v, r) => {
                const auction = v || r
                return (
                  <a onClick={() => navigate(`/auction/${auction.id || r.auctionId}`)} style={{ color: '#f5f5f5', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {auction.images?.[0] && <img src={auction.images[0]} style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />}
                    <span>{auction.title || r.auctionTitle}</span>
                  </a>
                )
              }
            },
            { title: '分类', dataIndex: 'auction', width: 100, render: (v, r) => <span className="gold-tag">{v?.category || r.category}</span> },
            {
              title: '当前价',
              dataIndex: 'auction',
              width: 140,
              render: (v, r) => <b style={{ color: '#d4af37' }}>{formatPrice(v?.currentPrice || r.currentPrice)}</b>
            },
            {
              title: '代理上限',
              dataIndex: 'maxPrice',
              width: 140,
              render: v => <Tag color="purple" icon={<RobotOutlined />} style={{ fontSize: 12 }}>{formatPrice(v)}</Tag>
            },
            {
              title: '拍品状态',
              dataIndex: 'auction',
              width: 110,
              render: v => <StatusBadge status={v?.status || 'active'} />
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 160,
              render: v => formatTime(v)
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: s => s === 'cancelled'
                ? <Tag color="default">已取消</Tag>
                : s === 'completed'
                  ? <Tag color="blue">已完成</Tag>
                  : <Tag color="green">生效中</Tag>
            },
            {
              title: '操作',
              width: 100,
              render: (_, r) => r.status !== 'active' ? null : (
                <Tooltip title="取消代理出价">
                  <Button type="text" danger icon={<StopOutlined />} onClick={() => cancelProxyBid(r)}>取消</Button>
                </Tooltip>
              )
            }
          ]}
        />
      )
    },
    {
      key: 'favorites', label: <span><HeartOutlined /> 我的收藏 ({(favorites || []).length})</span>, children: renderAuctionList(favorites, '还没有收藏任何拍品')
    },
    {
      key: 'watchlist', label: <span><EyeOutlined /> 我的关注 ({(watchlist || []).length})</span>, children: renderAuctionList(watchlist, '还没有关注任何拍品')
    },
    {
      key: 'reviews', label: <span><StarFilled /> 我的评价 ({(myReviews || []).length})</span>, children: (
        <div>
          <div style={{ padding: 24, background: 'rgba(212, 175, 55, 0.06)', borderRadius: 8, border: '1px solid rgba(212, 175, 55, 0.15)', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 13, color: '#b8b8b8', marginBottom: 4 }}>我的综合信用</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CreditScore score={creditScore} large />
                  <span style={{ color: creditScore >= 3 ? '#d4af37' : '#ff4757', fontWeight: 600, fontSize: 28, fontFamily: '"Playfair Display", serif' }}>
                    {creditScore.toFixed(1)}
                  </span>
                  <span style={{ color: '#6c6c7a', fontSize: 13 }}>满分 5.0</span>
                </div>
              </div>
              {creditScore < 3 && (
                <Tag color="red" style={{ padding: '6px 12px', fontSize: 12 }}>
                  信用分较低，请注意交易诚信</Tag>
              )}
            </div>
          </div>
          {(myReviews || []).length === 0 ? (
            <Empty description="暂无评价" style={{ color: '#6c6c7a' }} />
          ) : (
            (myReviews || []).map(r => (
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
                    相关拍品：<a onClick={() => navigate('/auction/' + r.auctionId)} style={{ color: '#d4af37' }}>{r.auctionTitle}</a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )
    },
    {
      key: 'transactions', label: <span><HistoryOutlined /> 交易记录 ({(transactions || []).length})</span>, children: (transactions || []).length === 0 ? <Empty description="暂无交易记录" /> : (
        <Table columns={txColumns} dataSource={transactions || []} rowKey="id" pagination={{ pageSize: 10 }} />
      )
    }
  ]

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 32px' }}>
      <Card className="luxury-card profile-header" style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={[24, 24]}>
          <Col flex="none">
            <div className="profile-avatar-wrapper">
              <Avatar src={user.avatar} size={88} style={{ border: '3px solid rgba(212, 175, 55, 0.5)' }} />
            </div>
          </Col>
          <Col flex="auto">
            <h2 style={{ margin: 0, fontFamily: '"Playfair Display", serif', fontSize: 26, color: '#f5f5f5' }}>{user.nickname}</h2>
            <div style={{ color: '#b8b8b8', marginTop: 6 }}>用户名：{user.username}</div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SafetyCertificateOutlined style={{ color: '#d4af37' }} />
              <span style={{ color: '#b8b8b8' }}>信用分</span>
              <CreditScore score={creditScore} />
              <span style={{ color: creditScore >= 3 ? '#d4af37' : '#ff4757', fontWeight: 600 }}>{creditScore.toFixed(1)}</span>
              </div>
              <Tag color="gold" className="gold-tag">已发布 {(myAuctions || []).length}</Tag>
              <Tag color="gold" className="gold-tag">收藏 {(favorites || []).length}</Tag>
              <Tag color="gold" className="gold-tag">关注 {(watchlist || []).length}</Tag>
            </div>
          </Col>
          <Col xs={24} sm={24} lg="auto">
            <div className="wallet-card" onClick={() => setRechargeModal(true)}>
              <div style={{ color: '#b8b8b8', fontSize: 12 }}>账户余额</div>
              <div className="wallet-balance">{formatPrice(user.balance)}</div>
              <Button className="gold-btn" size="small" icon={<PlusOutlined />}>

              充值</Button>
            </div>
          </Col>
        </Row>
      </Card>

      <Card className="luxury-card">
        <Tabs activeKey={activeKey} onChange={setActiveKey} className="tab-luxury" items={tabItems} />
      </Card>

      <Modal title={<span style={{ fontFamily: '"Playfair Display", serif' }}>账户充值</span>} open={rechargeModal} onOk={handleRecharge} onCancel={() => setRechargeModal(false)} okText="确认充值" okButtonProps={{ className: 'gold-btn' }}>
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ color: '#b8b8b8', marginBottom: 16 }}>请输入充值金额（模拟充值）</div>
          <InputNumber size="large" min={1} max={1000000} value={rechargeAmount} onChange={setRechargeAmount} style={{ width: 240 }} formatter={v => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v.replace(/\D/g, '')} className="luxury-input" />
          <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[100, 500, 1000, 5000, 10000].map(amount => (
              <Button key={amount} onClick={() => setRechargeAmount(amount)} className="gold-btn" size="large">¥{amount.toLocaleString()}</Button>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        title={<span style={{ fontFamily: '"Playfair Display", serif' }}>《{historyAuction?.title}》出价历史</span>}
        open={!!bidHistory}
        onCancel={() => { setBidHistory(null); setHistoryAuction(null) }}
        footer={null}
        width={600}
      >
        {(bidHistory || []).length === 0 ? (
          <Empty description="暂无出价" />
        ) : (
          (bidHistory || []).map(b => (
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
      </Modal>
    </div>
  )
}

export default Profile
