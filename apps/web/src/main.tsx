import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useTranslation } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/AppRouter';
import { MeshCentralControlProvider } from './features/gateway/MeshCentralControlProvider';
import { BatchTaskProvider } from './features/tasks/BatchTaskProvider';
import { resolveLanguage } from './i18n';
import 'antd/dist/reset.css';
import './assets/styles/index.css';
import './i18n';

function ApplicationProviders() {
  const { i18n } = useTranslation();
  const locale = resolveLanguage(i18n.resolvedLanguage) === 'en-US' ? enUS : zhCN;

  return (
    <ConfigProvider
      locale={locale}
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
        <MeshCentralControlProvider>
          <BatchTaskProvider>
            <BrowserRouter>
              <AppRouter />
            </BrowserRouter>
          </BatchTaskProvider>
        </MeshCentralControlProvider>
      </AntApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApplicationProviders />
  </React.StrictMode>,
);
