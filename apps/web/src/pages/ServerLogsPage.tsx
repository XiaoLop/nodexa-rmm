import { useTranslation } from 'react-i18next';
import { PageHeader, Panel } from '../components/ui';
import { ErrorLogPanel } from '../components/server-admin/ErrorLogPanel';

export function ServerLogsPage() {
  const { t } = useTranslation();
  return <><PageHeader title={t('serverAdmin.logs')} /><Panel><ErrorLogPanel /></Panel></>;
}
