import { Alert, Button, Input, Modal, Space, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerErrorLog } from '../../features/server-admin/hooks';
import { downloadText } from '../../features/server-admin/model';
import { Highlight } from './TracePanel';

export function ErrorLogPanel() {
  const { t } = useTranslation();
  const log = useServerErrorLog();
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(false);
  const text = log.content?.split('\n').filter(line => !search || line.toLocaleLowerCase().includes(search.toLocaleLowerCase())).join('\n');
  return <Space orientation="vertical" style={{ width: '100%' }}>
    {!log.connected && <Alert type="warning" title={t('serverAdmin.disconnected')} />}
    {log.error && <Alert type="error" title={t('serverAdmin.failed')} />}
    {log.clearSent && <Alert type="info" title={t('serverAdmin.clearSent')} />}
    <Space wrap>
      <Button disabled={!log.connected || log.busy} loading={log.busy} onClick={() => void log.refresh()}>{t('common.actions.refresh')}</Button>
      <Button disabled={log.content === undefined} onClick={() => downloadText(log.content ?? '', 'server-errors.txt')}>{t('common.actions.download')}</Button>
      <Button danger disabled={!log.connected || log.busy} onClick={() => setConfirm(true)}>{t('serverAdmin.clear')}</Button>
    </Space>
    <Input aria-label={t('serverAdmin.search')} placeholder={t('serverAdmin.search')} value={search} onChange={event => setSearch(event.target.value)} />
    {log.content === undefined ? <Typography.Text>{t('serverAdmin.absent')}</Typography.Text>
      : log.content === '' ? <Typography.Text>{t('serverAdmin.empty')}</Typography.Text>
        : <pre style={{ maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><Highlight text={text ?? ''} keyword={search} /></pre>}
    <Modal title={t('serverAdmin.clear')} open={confirm} onCancel={() => setConfirm(false)}
      okButtonProps={{ danger: true, disabled: !log.connected || log.busy }}
      onOk={() => { setConfirm(false); void log.clear(); }}>{t('serverAdmin.clearConfirm')}</Modal>
  </Space>;
}
