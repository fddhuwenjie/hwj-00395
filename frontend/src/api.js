import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8395/api',
  timeout: 10000
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auction_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auction_token')
      localStorage.removeItem('auction_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err.response?.data || err)
  }
)

export const specialApi = {
  list: () => api.get('/specials'),
  get: (id) => api.get(`/specials/${id}`),
  create: (data) => api.post('/specials', data),
  update: (id, data) => api.put(`/specials/${id}`, data)
}

export const proxyBidApi = {
  get: (auctionId) => api.get(`/auctions/${auctionId}/proxy`),
  set: (auctionId, maxPrice) => api.post(`/auctions/${auctionId}/proxy`, { maxPrice }),
  cancel: (auctionId) => api.delete(`/auctions/${auctionId}/proxy`),
  myList: () => api.get('/my/proxy-bids')
}

export const reminderApi = {
  toggle: (auctionId) => api.post(`/auctions/${auctionId}/reminder`),
  myList: () => api.get('/my/reminders'),
  myIds: () => api.get('/my/reminder-ids')
}

export const notificationApi = {
  list: () => api.get('/notifications'),
  readAll: () => api.post('/notifications/read-all'),
  unreadCount: () => api.get('/notifications/unread-count')
}

export const previewApi = {
  list: () => api.get('/auctions-preview')
}

export default api
