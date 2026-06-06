import { io } from 'socket.io-client'

let socket = null

export const initSocket = () => {
  if (socket) return socket
  const token = localStorage.getItem('auction_token')
  socket = io('http://localhost:8395', {
    auth: { token }
  })
  return socket
}

export const getSocket = () => socket

export const closeSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
