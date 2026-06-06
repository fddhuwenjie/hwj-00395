import React, { useEffect, useState } from 'react'

export const Countdown = ({ endTime, startTime, onEnd, urgent = true, mode = 'end' }) => {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const calc = () => {
      const target = mode === 'start' ? startTime : endTime
      const left = Math.max(0, target - Date.now())
      setTimeLeft(left)
      if (left === 0 && onEnd) onEnd()
    }
    calc()
    const timer = setInterval(calc, 1000)
    return () => clearInterval(timer)
  }, [endTime, startTime, mode])

  const totalSec = Math.floor(timeLeft / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const isUrgent = urgent && timeLeft > 0 && timeLeft <= 60 * 1000

  if (timeLeft === 0) return <span>{mode === 'start' ? '已开始' : '已结束'}</span>

  return (
    <div className={`countdown ${isUrgent ? 'urgent' : ''}`}>
      {d > 0 && (
        <>
          <span className="block">{String(d).padStart(2, '0')}</span>
          <span className="label">天</span>
        </>
      )}
      <span className="block">{String(h).padStart(2, '0')}</span>
      <span className="label">:</span>
      <span className="block">{String(m).padStart(2, '0')}</span>
      <span className="label">:</span>
      <span className="block" style={isUrgent ? { fontSize: 18, padding: '4px 10px' } : {}}>{String(s).padStart(2, '0')}</span>
    </div>
  )
}

export const formatPrice = (price) => {
  if (price == null) return '-'
  return '¥' + Number(price).toLocaleString('zh-CN')
}

export const formatTime = (ts) => {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const StatusBadge = ({ status }) => {
  const map = {
    active: { text: '进行中', cls: 'status-active' },
    ended: { text: '已结束', cls: 'status-ended' },
    pending: { text: '即将开始', cls: 'status-pending' },
    preview: { text: '预展中', cls: 'status-preview' },
    upcoming: { text: '敬请期待', cls: 'status-upcoming' }
  }
  const item = map[status] || map.ended
  return <span className={`status-tag ${item.cls}`}>{item.text}</span>
}

export const CreditScore = ({ score, size = 'default' }) => {
  if (score == null) score = 5
  const fullStars = Math.floor(score)
  const hasHalf = score - fullStars >= 0.5
  const isLow = score < 3
  const stars = []
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) stars.push('★')
    else if (i === fullStars && hasHalf) stars.push('☆')
    else stars.push('☆')
  }
  const fontSize = size === 'large' ? 18 : 14
  return (
    <span className={`credit-score ${isLow ? 'low' : ''}`}>
      <span className="stars" style={{ fontSize }}>{stars.join('')}</span>
      <span className="score" style={{ fontSize }}>{score.toFixed(1)}</span>
    </span>
  )
}

export const CertifiedBadge = () => (
  <span className="cert-badge">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </svg>
    已鉴定
  </span>
)

export const renderStars = (rating) => {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  let s = ''
  for (let i = 0; i < full; i++) s += '★'
  if (half) s += '☆'
  while (s.length < 5) s += '☆'
  return <span className="rate-stars">{s}</span>
}
