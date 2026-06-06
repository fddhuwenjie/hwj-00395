import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Empty, Tag } from 'antd'
import { FireOutlined, TrophyOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { specialApi } from '../api.js'
import { formatTime, Countdown } from '../utils.jsx'

const SpecialList = () => {
  const navigate = useNavigate()
  const [specials, setSpecials] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const list = await specialApi.list()
        setSpecials(Array.isArray(list) ? list : [])
      } catch (e) {}
    }
    load()
  }, [])

  const getSpecialStatus = (sp) => {
    const now = Date.now()
    if (now < sp.startTime) return { text: '即将开始', color: 'blue' }
    if (now > sp.endTime) return { text: '已结束', color: 'default' }
    return { text: '进行中', color: 'green' }
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 32px' }}>
      <Card className="luxury-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 32 }}>🎭</span>
          <div>
            <h1 style={{ margin: 0, fontFamily: '"Playfair Display", serif', fontSize: 28, color: '#f5f5f5' }}>拍卖专场</h1>
            <div style={{ color: '#b8b8b8', marginTop: 4 }}>精选主题专场，汇集珍品</div>
          </div>
        </div>
      </Card>

      {specials.length === 0 ? (
        <Empty description="暂无专场" style={{ color: '#6c6c7a' }} />
      ) : (
        <Row gutter={[24, 24]}>
          {specials.map(sp => {
            const status = getSpecialStatus(sp)
            return (
              <Col xs={24} md={12} lg={8} key={sp.id}>
                <Card
                  className="special-card"
                  hoverable
                  onClick={() => navigate(`/special/${sp.id}`)}
                  cover={
                    <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
                      <img
                        src={sp.coverImage}
                        alt={sp.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%)'
                      }} />
                      <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <Tag color={status.color} style={{ fontSize: 12 }}>{status.text}</Tag>
                      </div>
                      <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16 }}>
                        <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, fontFamily: '"Playfair Display", serif' }}>
                          {sp.name}
                        </div>
                      </div>
                    </div>
                  }
                >
                  <div style={{ color: '#b8b8b8', fontSize: 13, lineHeight: 1.6, height: 40, overflow: 'hidden' }}>
                    {sp.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TrophyOutlined style={{ color: '#d4af37' }} />
                      <span style={{ color: '#f5f5f5', fontSize: 13 }}>{sp.auctionCount || 0} 件拍品</span>
                    </div>
                    {status.color === 'green' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FireOutlined style={{ color: '#ff4757' }} />
                        <span style={{ color: '#ff4757', fontSize: 13 }}>{sp.activeCount || 0} 件进行中</span>
                      </div>
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 16, paddingTop: 16 }}>
                    {status.color === 'blue' ? (
                      <div>
                        <div style={{ color: '#b8b8b8', fontSize: 12, marginBottom: 6 }}>
                          <ClockCircleOutlined /> 距开始
                        </div>
                        <Countdown startTime={sp.startTime} mode="start" />
                      </div>
                    ) : status.color === 'green' ? (
                      <div>
                        <div style={{ color: '#b8b8b8', fontSize: 12, marginBottom: 6 }}>
                          <ClockCircleOutlined /> 距结束
                        </div>
                        <Countdown endTime={sp.endTime} />
                      </div>
                    ) : (
                      <div style={{ color: '#6c6c7a', fontSize: 12 }}>
                        结束时间：{formatTime(sp.endTime)}
                      </div>
                    )}
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

export default SpecialList
