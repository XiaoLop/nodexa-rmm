import { useTranslation } from 'react-i18next';
import { PageHeader, Panel } from '../components/ui';
import { ServerConsole } from '../components/server-admin/ServerConsole';

export function ServerConsolePage() {
  const { t } = useTranslation();
  return <><PageHeader title={t('serverAdmin.console')} /><Panel><ServerConsole /></Panel></>;
}
