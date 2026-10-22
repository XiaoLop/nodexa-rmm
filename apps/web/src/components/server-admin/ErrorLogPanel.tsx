import { SearchOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Input,
  Modal,
  Typography,
} from 'antd';
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

  return (
    <div className="server-console-container">
      {!log.connected && <Alert type="warning" title={t('serverAdmin.disconnected')} />}
      {log.error && <Alert type="error" title={t('serverAdmin.failed')} />}
      {log.clearSent && <Alert type="info" title={t('serverAdmin.clearSent')} />}

      <div className="server-ops-toolbar">
        <div className="server-ops-toolbar-left">
          <Input
            aria-label={t('serverAdmin.search')}
            placeholder={t('serverAdmin.search')}
            value={search}
            prefix={<SearchOutlined style={{ color: 'var(--color-text-tertiary)' }} />}
            onChange={event => setSearch(event.target.value)}
            style={{ width: 280 }}
            allowClear
          />
        </div>
        <div className="server-ops-toolbar-right">
          <Button
            disabled={!log.connected || log.busy}
            loading={log.busy}
            onClick={() => void log.refresh()}
          >
            {t('common.actions.refresh')}
          </Button>
          <Button
            disabled={log.content === undefined}
            onClick={() => downloadText(log.content ?? '', 'server-errors.txt')}
          >
            {t('common.actions.download')}
          </Button>
          <Button
            danger
            disabled={!log.connected || log.busy}
            onClick={() => setConfirm(true)}
          >
            {t('serverAdmin.clear')}
          </Button>
        </div>
      </div>

      <div className="server-ops-viewport">
        <div className="server-ops-viewport-scrollable">
          {log.content === undefined ? (
            <div className="server-ops-empty-box">
              <Typography.Text type="secondary">{t('serverAdmin.absent')}</Typography.Text>
            </div>
          ) : log.content === '' ? (
            <div className="server-ops-empty-box">
              <Typography.Text type="secondary">{t('serverAdmin.empty')}</Typography.Text>
            </div>
          ) : (
            <pre className="error-log-code">
              <Highlight text={text ?? ''} keyword={search} />
            </pre>
          )}
        </div>
      </div>

      <Modal
        title={t('serverAdmin.clear')}
        open={confirm}
        onCancel={() => setConfirm(false)}
        okButtonProps={{ danger: true, disabled: !log.connected || log.busy }}
        onOk={() => {
          setConfirm(false);
          void log.clear();
        }}
      >
        {t('serverAdmin.clearConfirm')}
      </Modal>
    </div>
  );
}

