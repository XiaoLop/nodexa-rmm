import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useTranslation } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/AppRouter';
import { MeshCentralControlProvider } from './features/gateway/MeshCentralControlProvider';
import { BatchTaskProvider } from './features/tasks/BatchTaskProvider';
import { resolveLanguage } from './i18n';
import { appTheme } from './theme/appTheme';
import 'antd/dist/reset.css';
import './assets/styles/index.css';
import './i18n';

function ApplicationProviders() {
  const { i18n } = useTranslation();
  const locale = resolveLanguage(i18n.resolvedLanguage) === 'en-US' ? enUS : zhCN;

  return (
    <ConfigProvider locale={locale} theme={appTheme}>
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
