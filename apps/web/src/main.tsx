import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/AppRouter';
import { GatewayProvider } from './features/gateway/GatewayProvider';
import 'antd/dist/reset.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#5eead4', borderRadius: 12, fontFamily: 'Inter, sans-serif' },
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
