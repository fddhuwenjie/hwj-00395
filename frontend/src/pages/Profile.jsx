import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Tabs, Avatar, Button, Table, Tag, Modal, App, Empty, List, Divider, InputNumber } from 'antd'
import { UserOutlined, PlusOutlined, DollarOutlined, TrophyOutlined, RiseOutlined, ShoppingCartOutlined, HistoryOutlined } from '@ant-design/icons'
import api from '../api.js'
import { formatPrice, formatTime, StatusBadge, Countdown } from '../utils.jsx'

const Profile = ({ user, setUser }) => {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const [myAuctions, setMyAuctions] = useState([])
  const [myBids, setMyBids] = useState([])
  const [myWon, setMyWon] = useState([])
  const [transactions, setTransactions] = useState([])
  const [rechargeModal, setRechargeModal] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState(1000)
  const [bidHistory, setBidHistory] = useState(null)
  const [historyAuction, setHistoryAuction] = useState(null)

  const loadAll = async () => {
    try {
      const [a, b, w, t] = await Promise.all([
        api.get('/my/auctions'),
        api.get('/my/bids'),
        api.get('/my/won'),
        api.get('/my/transactions')
      ])
      setMyAuctions(a)
      setMyBids(b)
      setMyWon(w)
      setTransactions(t)
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

  const txColumns = [
    { title: '类型', dataIndex: 'type', width: 100, render: t => <Tag color={t === 'income' ? 'green' : 'red'}>{t === 'income' ? '收入' : '支出'}</Tag> },
    { title: '金额', dataIndex: 'amount', width: 140, render: (v, r) => <span style={{ color: r.type === 'income' ? '#52c41a' : '#f5222d', fontWeight: 'bold' }}>{r.type === 'income' ? '+' : '-'}{formatPrice(v)}</span> },
    { title: '描述', dataIndex: 'description' },
    { title: '时间', dataIndex: 'createdAt', width: 180, render: v => formatTime(v) }
  ]

  const myAuctionColumns = [
    { title: '拍品', dataIndex: 'title', render: (v, r) => <a onClick={() => navigate(`/auction/${r.id}`)}>{v}</a> },
    { title: '分类', dataIndex: 'category', width: 100, render: v => <Tag color="blue">{v}</Tag> },
    { title: '当前价', dataIndex: 'currentPrice', width: 120, render: v => <b style={{ color: '#f5222d' }}>{formatPrice(v)}</b> },
    { title: '出价数', dataIndex: 'bidCount', width: 80 },
    { title: '状态', dataIndex: 'status', width: 100, render: s => <StatusBadge status={s} /> },
    { title: '操作', width: 120, render: (_, r) => (
      <Button type="link" onClick={() => viewBidHistory(r)}>出价历史</Button>
    ) }
  ]

  if (!user) return <div className="empty-state">请先登录</div>

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px' }}>
      <Card style={{ marginBottom: 24 }}>
        <Row align="middle" gutter={24}>
          <Col flex="none">
            <Avatar src={user.avatar} size={72} />
          </Col>
          <Col flex="auto">
            <h2 style={{ margin: 0 }}>{user.nickname}</h2>
            <div style={{ color: '#999', marginTop: 4 }}>用户名：{user.username}</div>
          </Col>
          <Col flex="none">
            <div style={{ textAlign: 'center', padding: '8px 24px', background: '#fff1f0', borderRadius: 8 }}>
              <div style={{ color: '#999', fontSize: 12 }}>账户余额</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#f5222d' }}>{formatPrice(user.balance)}</div>
              <Button type="primary" size="small" icon={<PlusOutlined />} style={{ marginTop: 8 }} onClick={() => setRechargeModal(true)}>充值</Button>
            </div>
          </Col>
        </Row>
      </Card>

      <Card>
        <Tabs
          items={[
            {
              key: 'published',
              label: <span><RiseOutlined /> 我发布的 ({myAuctions.length})</span>,
              children: myAuctions.length === 0 ? <Empty description="还没有发布任何拍品" /> : (
                <Table columns={myAuctionColumns} dataSource={myAuctions} rowKey="id" pagination={{ pageSize: 5 }} />
              )
            },
            {
              key: 'bidding',
              label: <span><ShoppingCartOutlined /> 我参与竞价的 ({myBids.length})</span>,
              children: myBids.length === 0 ? <Empty description="还没有参与任何竞价" /> : (
                <Table
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  columns={[
                    { title: '拍品', dataIndex: 'title', render: (v, r) => <a onClick={() => navigate(`/auction/${r.id}`)}>{v}</a> },
                    { title: '分类', dataIndex: 'category', width: 100, render: v => <Tag color="blue">{v}</Tag> },
                    { title: '我的最高出价', dataIndex: 'myMaxBid', width: 140, render: v => <b>{formatPrice(v)}</b> },
                    { title: '当前价', dataIndex: 'currentPrice', width: 140, render: (v, r) => <b style={{ color: v > r.myMaxBid ? '#f5222d' : '#52c41a' }}>{formatPrice(v)}</b> },
                    { title: '状态', dataIndex: 'status', width: 100, render: s => <StatusBadge status={s} /> }
                  ]}
                  dataSource={myBids}
                />
              )
            },
            {
              key: 'won',
              label: <span><TrophyOutlined /> 我拍得的 ({myWon.length})</span>,
              children: myWon.length === 0 ? <Empty description="还没有拍得任何商品" /> : (
                <List
                  dataSource={myWon}
                  renderItem={item => (
                    <List.Item key={item.id} onClick={() => navigate(`/auction/${item.id}`)} style={{ cursor: 'pointer' }}>
                      <List.Item.Meta
                        avatar={item.images?.[0] ? <img src={item.images[0]} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} /> : <Avatar size={60} icon={<TrophyOutlined />} />}
                        title={<a>{item.title}</a>}
                        description={
                          <div>
                            <Tag color="green">已成交</Tag>
                            <span style={{ marginLeft: 8 }}>成交价：<b style={{ color: '#f5222d' }}>{formatPrice(item.finalPrice)}</b></span>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )
            },
            {
              key: 'transactions',
              label: <span><HistoryOutlined /> 交易记录 ({transactions.length})</span>,
              children: transactions.length === 0 ? <Empty description="暂无交易记录" /> : (
                <Table columns={txColumns} dataSource={transactions} rowKey="id" pagination={{ pageSize: 10 }} />
              )
            }
          ]}
        />
      </Card>

      <Modal title="账户充值" open={rechargeModal} onOk={handleRecharge} onCancel={() => setRechargeModal(false)} okText="确认充值">
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ color: '#999', marginBottom: 16 }}>请输入充值金额（模拟充值）</div>
          <InputNumber size="large" min={1} max={1000000} value={rechargeAmount} onChange={setRechargeAmount} style={{ width: 240 }} formatter={v => `¥ ${v}`} parser={v => v.replace(/\D/g, '')} />
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
            {[100, 500, 1000, 5000, 10000].map(amount => (
              <Button key={amount} onClick={() => setRechargeAmount(amount)}>¥{amount}</Button>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        title={`《${historyAuction?.title}》出价历史`}
        open={!!bidHistory}
        onCancel={() => { setBidHistory(null); setHistoryAuction(null) }}
        footer={null}
        width={600}
      >
        {bidHistory && bidHistory.length === 0 ? (
          <Empty description="暂无出价" />
        ) : (
          bidHistory?.map(b => (
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
