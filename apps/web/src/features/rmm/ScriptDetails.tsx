import type { MeshCentralClient, RmmScript } from '@meshcentral/control-client';
import { Alert, Button, Descriptions, Space, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ConsoleDrawer } from '../../components/ui';
import '../../assets/styles/tasks.css';
import { ScriptHistory } from './ScriptHistory';

export function ScriptDetails({
  script,
  client,
  connected,
  canEdit,
  onClose,
  onExecute,
  onEdit,
}: {
  script: RmmScript;
  client?: MeshCentralClient;
  connected: boolean;
  canEdit: boolean;
  onClose: () => void;
  onExecute: (script: RmmScript) => void;
  onEdit: (script: RmmScript) => void;
}) {
  const { t } = useTranslation();
  return (
    <ConsoleDrawer
      open
      variant="details"
      title={script.name}
      onClose={onClose}
      extra={
        <Space>
          {canEdit && !script.builtin && !script.archived && (
            <Button disabled={!connected} onClick={() => onEdit(script)}>
              {t('rmm.editor')}
            </Button>
          )}
          {!script.archived && (
            <Button type="primary" disabled={!connected} onClick={() => onExecute(script)}>
              {t('rmm.execute')}
            </Button>
          )}
        </Space>
      }
    >
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label={t('rmm.description')}>
            {script.description || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('rmm.version')}>v{script.version}</Descriptions.Item>
          <Descriptions.Item label={t('rmm.platform')}>
            {script.platform === 'linux' ? 'Linux · /bin/sh' : 'Windows · PowerShell'}
          </Descriptions.Item>
          <Descriptions.Item label={t('rmm.source')}>
            <Tag>{t(script.builtin ? 'rmm.builtin' : 'rmm.custom')}</Tag>
            {script.archived && <Tag>{t('rmm.archived')}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label={t('rmm.tags')}>
            {(script.tags ?? []).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Descriptions.Item>
        </Descriptions>
        <div>
          <Typography.Title level={5}>{t('rmm.parametersTitle')}</Typography.Title>
          {script.parameters.length ? (
            <Space orientation="vertical">
              {script.parameters.map((parameter) => (
                <div key={parameter.name}>
                  <Typography.Text strong>{parameter.name}</Typography.Text>{' '}
                  <Tag>{t('rmm.' + parameter.type)}</Tag>
                  {parameter.type === 'enum' && parameter.options && (
                    <Typography.Text>{parameter.options.join(', ')}</Typography.Text>
                  )}
                </div>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">{t('rmm.noParameters')}</Typography.Text>
          )}
        </div>
        <div>
          <Typography.Title level={5}>{t('rmm.scriptBody')}</Typography.Title>
          {script.body === undefined ? (
            <Alert type="info" message={t('rmm.bodyUnavailable')} />
          ) : (
            <div className="task-command-output-box">
              <pre className="task-command-pre">{script.body}</pre>
            </div>
          )}
        </div>
        <ScriptHistory key={script.id} client={client} script={script} connected={connected} />
      </Space>
    </ConsoleDrawer>
  );
}
