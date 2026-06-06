import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Tabs, Segmented, Button, Empty, Tag, Avatar } from 'antd'
import { FireOutlined, EyeOutlined, RiseOutlined, DollarOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import api from '../api.js'
import { getSocket } from '../socket.js'
import { Countdown, formatPrice, StatusBadge } from '../utils.jsx'

const Home = ({ user }) => {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [auctions, setAuctions] = useState([])
  const [filter, setFilter] = useState('all')
  const [tabKey, setTabKey] = useState('active')

  const loadData = async () => {
    try {
      const [s, a] = await Promise.all([
        api.get('/stats'),
        api.get('/auctions')
      ])
      setStats(s)
      setAuctions(a)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
    const socket = getSocket()
    if (socket) {
      const handler = () => loadData()
      socket.on('bid:new', handler)
      socket.on('auction:timers', handler)
      return () => {
        socket.off('bid:new', handler)
        socket.off('auction:timers', handler)
      }
    }
  }, [])

  const filtered = auctions.filter(a => {
    if (tabKey === 'active') return a.status === 'active'
    if (tabKey === 'ended') return a.status === 'ended'
    return true
  })

  const trendOption = stats ? {
    tooltip: { trigger: 'axis' },
    legend: { data: ['出价次数', '成交额'], bottom: 0 },
    grid: { left: 40, right: 40, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: stats.dailyTrend.map(d => d.date) },
    yAxis: [
      { type: 'value', name: '次数' },
      { type: 'value', name: '金额(¥)' }
    ],
    series: [
      {
        name: '出价次数',
        type: 'line',
        smooth: true,
        data: stats.dailyTrend.map(d => d.bidCount),
        itemStyle: { color: '#f5222d' },
        areaStyle: { color: 'rgba(245, 34, 45, 0.1)' }
      },
      {
        name: '成交额',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: stats.dailyTrend.map(d => d.salesAmount),
        itemStyle: { color: '#1890ff' }
      }
    ]
  } : null

  const priceOption = stats ? {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: stats.priceDistribution.map(d => d.range), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: stats.priceDistribution.map(d => d.count),
      itemStyle: { color: '#f5222d', borderRadius: [4, 4, 0, 0] },
      barWidth: '50%'
    }]
  } : null

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px' }}>
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card">
              <div className="number">¥{Number(stats.todayAmount).toLocaleString()}</div>
              <div className="label"><DollarOutlined /> 今日成交额</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card">
              <div className="number" style={{ color: '#1890ff' }}>{stats.activeCount}</div>
              <div className="label"><RiseOutlined /> 活跃拍品数</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card">
              <div className="number" style={{ color: '#52c41a' }}>{stats.totalBidCount}</div>
              <div className="label"><FireOutlined /> 总出价次数</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="stat-card">
              <div className="number" style={{ color: '#722ed1' }}>{stats.top5.length}</div>
              <div className="label"><EyeOutlined /> 热门拍品 TOP5</div>
            </Card>
          </Col>
        </Row>
      )}

      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={14}>
            <Card title="近7天交易趋势">
              {trendOption && <ReactECharts option={trendOption} style={{ height: 280 }} />}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="成交价格分布">
              {priceOption && <ReactECharts option={priceOption} style={{ height: 280 }} />}
            </Card>
          </Col>
        </Row>
      )}

      {stats && stats.top5.length > 0 && (
        <Card title={<span><FireOutlined style={{ color: '#f5222d' }} /> 热门拍品 TOP5</span>} style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {stats.top5.map((a, idx) => (
              <Col xs={24} sm={12} lg={24 / 5} key={a.id} onClick={() => navigate(`/auction/${a.id}`)}>
                <Card hoverable cover={a.images?.[0] ? <img src={a.images[0]} style={{ height: 140, objectFit: 'cover' }} /> : null}>
                  <div style={{ position: 'relative' }}>
                    <Tag color={idx < 3 ? '#f5222d' : '#8c8c8c'} style={{ position: 'absolute', top: -12, left: -12, fontSize: 16, fontWeight: 'bold' }}>TOP{idx + 1}</Tag>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                  <div style={{ color: '#f5222d', fontWeight: 'bold', marginTop: 4 }}>{formatPrice(a.currentPrice)}</div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>{a.bidCount} 次出价</div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Card
        title="拍卖广场"
        extra={
          <Tabs activeKey={tabKey} onChange={setTabKey} size="small" items={[
            { key: 'active', label: '进行中' },
            { key: 'ended', label: '已结束' },
            { key: 'all', label: '全部' }
          ]} />
        }
      >
        {filtered.length === 0 ? (
          <Empty description="暂无拍品" />
        ) : (
          <Row gutter={[16, 16]}>
            {filtered.map(a => (
              <Col xs={24} sm={12} lg={6} key={a.id}>
                <Card
                  className="auction-card"
                  hoverable
                  cover={a.images?.[0] ? <img src={a.images[0]} className="cover" /> : null}
                  onClick={() => navigate(`/auction/${a.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Tag color="blue">{a.category}</Tag>
                    <StatusBadge status={a.status} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500, height: 44, overflow: 'hidden', lineHeight: 1.4 }}>{a.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <Avatar size={20} src={a.sellerAvatar} />
                    <span style={{ fontSize: 12, color: '#666' }}>{a.sellerNickname}</span>
                  </div>
                  <div className="price" style={{ marginTop: 12 }}>{formatPrice(a.currentPrice)}</div>
                  <div className="meta">
                    <span>{a.bidCount} 次出价</span>
                    {a.status === 'active' ? <Countdown endTime={a.endTime} /> : <span>已结束</span>}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  )
}

export default Home
