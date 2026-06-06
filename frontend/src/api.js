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

export default api
