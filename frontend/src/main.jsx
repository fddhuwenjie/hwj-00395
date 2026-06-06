import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, App as AntdApp, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#d4af37',
          colorInfo: '#d4af37',
          colorSuccess: '#2ed573',
          colorWarning: '#ffa502',
          colorError: '#ff4757',
          colorBgBase: '#1a1a2e',
          colorBgContainer: '#16213e',
          colorBgElevated: '#0f3460',
          colorTextBase: '#f5f5f5',
          colorTextSecondary: '#b8b8b8',
          colorBorder: 'rgba(255, 255, 255, 0.08)',
          colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
        components: {
          Button: {
            colorPrimary: '#d4af37',
            colorPrimaryHover: '#f4d03f',
            colorPrimaryActive: '#b8960c',
            algorithm: true,
          },
          Card: {
            colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
          },
          Input: {
            colorBgContainer: '#1a1a2e',
            colorBorder: 'rgba(255, 255, 255, 0.08)',
          },
          Select: {
            colorBgContainer: '#1a1a2e',
            colorBorder: 'rgba(255, 255, 255, 0.08)',
          },
          Tabs: {
            colorPrimary: '#d4af37',
            itemSelectedColor: '#d4af37',
            inkBarColor: '#d4af37',
          },
          Tag: {
            colorBorder: 'rgba(212, 175, 55, 0.3)',
          },
          Table: {
            colorBgContainer: '#16213e',
            colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
            headerBg: '#0f3460',
            headerColor: '#d4af37',
          },
          Modal: {
            contentBg: '#16213e',
            headerBg: '#16213e',
          },
          Dropdown: {
            colorBgElevated: '#16213e',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: '#16213e',
            darkItemColor: '#b8b8b8',
            darkItemSelectedColor: '#d4af37',
            darkItemSelectedBg: 'rgba(212, 175, 55, 0.1)',
          },
          Pagination: {
            colorBgContainer: '#16213e',
            colorBorder: 'rgba(255, 255, 255, 0.08)',
            itemActiveBg: 'rgba(212, 175, 55, 0.1)',
            colorPrimary: '#d4af37',
          },
          Rate: {
            starColor: '#d4af37',
          },
        },
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
)
