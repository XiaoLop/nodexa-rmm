import type { RmmResource, RmmScript } from '@meshcentral/control-client';
import { useRmmQuery } from '@meshcentral/shared-state';
import { Alert, Button, Popconfirm, Space, Table, Tag } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader, Panel } from '../components/ui';
import { useMeshCentralControlData } from '../features/gateway';
import { useApplicationUiCapabilities } from '../features/permissions/useUiCapabilities';
import { ExecuteScriptModal } from '../features/rmm/ExecuteScriptModal';
import { ScriptEditor } from '../features/rmm/ScriptEditor';

const listScripts = (api: RmmResource) => api.listScripts();

export function ScriptLibraryPage() {
  const { t } = useTranslation();
  const { client, status } = useMeshCentralControlData();
  const capabilities = useApplicationUiCapabilities();
  const [editing, setEditing] = useState<RmmScript | true>();
  const [executing, setExecuting] = useState<RmmScript>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((value) => value + 1);
  const connected = status === 'connected';
  const scripts = useRmmQuery(client, connected, listScripts, undefined, revision);
  return (
    <div className="page-stack">
      <PageHeader
        title={t('rmm.library')}
        actions={
          capabilities.siteAdmin && (
            <Button type="primary" disabled={!connected} onClick={() => setEditing(true)}>
              {t('rmm.newScript')}
            </Button>
          )
        }
      />
      {(error || scripts.error) && (
        <Alert type="error" message={t('rmm.error', { code: error ?? scripts.error })} />
      )}
      <Panel>
        <Table
          rowKey="id"
          dataSource={scripts.result ?? []}
          loading={connected && !scripts.result && !scripts.error}
          columns={[
            { title: t('rmm.name'), dataIndex: 'name' },
            { title: t('rmm.description'), dataIndex: 'description' },
            { title: t('rmm.version'), dataIndex: 'version' },
            {
              title: t('rmm.platform'),
              render: (_value, script) =>
                script.platform === 'linux' ? 'Linux · /bin/sh' : 'Windows · PowerShell',
            },
            {
              title: t('rmm.actions'),
              render: (_value, script) => (
                <Space wrap>
                  {script.archived ? (
                    <Tag>{t('rmm.archived')}</Tag>
                  ) : (
                    <Button disabled={!connected} onClick={() => setExecuting(script)}>
                      {t('rmm.execute')}
                    </Button>
                  )}
                  {capabilities.siteAdmin && !script.builtin && !script.archived && (
                    <>
                      <Button disabled={!connected} onClick={() => setEditing(script)}>
                        {t('rmm.editor')}
                      </Button>
                      <Popconfirm
                        title={t('rmm.archiveConfirm')}
                        onConfirm={async () => {
                          if (!client) return;
                          setError(undefined);
                          try {
                            await client.rmm.archiveScript(script.id);
                            refresh();
                          } catch (error) {
                            setError(error instanceof Error ? error.message : 'REQUEST_FAILED');
                          }
                        }}
                      >
                        <Button disabled={!connected}>{t('rmm.archive')}</Button>
                      </Popconfirm>
                    </>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Panel>
      {editing && client && capabilities.siteAdmin && (
        <ScriptEditor
          client={client}
          current={editing === true ? undefined : editing}
          canBrowse={capabilities.serverFiles}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            refresh();
          }}
        />
      )}
      {executing && (
        <ExecuteScriptModal initial={executing} onClose={() => setExecuting(undefined)} />
      )}
    </div>
  );
}
