import { useTranslation } from 'react-i18next';
import { PageHeader, Panel } from '../components/ui';
import { TracePanel } from '../components/server-admin/TracePanel';

export function ServerTracePage() {
  const { t } = useTranslation();
  return <><PageHeader title={t('serverAdmin.trace')} /><Panel><TracePanel /></Panel></>;
}
