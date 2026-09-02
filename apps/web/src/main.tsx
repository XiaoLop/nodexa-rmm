import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/AppRouter';
import { GatewayProvider } from './features/gateway/GatewayProvider';
import 'antd/dist/reset.css';
import './assets/styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#2f80ff',
          colorInfo: '#2f80ff',
          colorSuccess: '#2dcc70',
          colorWarning: '#f4b43c',
          colorError: '#ff5364',
          colorBgBase: '#09111d',
          colorBgContainer: '#111c2a',
          colorBorder: '#243348',
          colorText: '#f1f5fb',
          colorTextSecondary: '#8c9bb0',
          borderRadius: 6,
          fontFamily: 'Inter, "Segoe UI", sans-serif',
        },
        components: {
          Button: { controlHeightLG: 46, fontWeight: 600 },
          Card: { colorBgContainer: '#111c2a' },
          Drawer: { colorBgElevated: '#111c2a' },
          Input: { activeBorderColor: '#2f80ff', hoverBorderColor: '#3c8bff' },
          Layout: { headerBg: '#0b1421', siderBg: '#0d1725' },
          Menu: { darkItemBg: '#0d1725', darkItemSelectedBg: '#1d3555', itemBorderRadius: 5 },
          Modal: {
            contentBg: '#111c2a',
            footerBg: '#111c2a',
            headerBg: '#111c2a',
          },
          Table: { headerBg: '#101a27', headerColor: '#c9d4e3', borderColor: '#243348' },
        },
      }}
    >
      <AntApp>
        <GatewayProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </GatewayProvider>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
