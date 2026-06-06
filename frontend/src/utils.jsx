import React, { useEffect, useState } from 'react'

export const Countdown = ({ endTime, onEnd }) => {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const calc = () => {
      const left = Math.max(0, endTime - Date.now())
      setTimeLeft(left)
      if (left === 0 && onEnd) onEnd()
    }
    calc()
    const timer = setInterval(calc, 1000)
    return () => clearInterval(timer)
  }, [endTime])

  const totalSec = Math.floor(timeLeft / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  if (timeLeft === 0) return <span>已结束</span>

  return (
    <div className="countdown">
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
      <span className="block">{String(s).padStart(2, '0')}</span>
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
    pending: { text: '即将开始', cls: 'status-pending' }
  }
  const item = map[status] || map.ended
  return <span className={`status-tag ${item.cls}`}>{item.text}</span>
}
