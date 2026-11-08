import type { RmmResource, RmmScript } from '@meshcentral/control-client';
import { useRmmQuery } from '@meshcentral/shared-state';
import { Alert, Button, Empty, Input, Popconfirm, Select, Space, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConsoleTable, FilterBar, PageHeader, Panel } from '../components/ui';
import { useMeshCentralControlData } from '../features/gateway';
import { useApplicationUiCapabilities } from '../features/permissions/useUiCapabilities';
import { ExecuteScriptModal } from '../features/rmm/ExecuteScriptModal';
import { ScriptEditor } from '../features/rmm/ScriptEditor';
import { ScriptDetails } from '../features/rmm/ScriptDetails';
import '../assets/styles/devices.css';

const listScripts = (api: RmmResource) => api.listScripts();

export function ScriptLibraryPage() {
  const { t } = useTranslation();
  const { client, status } = useMeshCentralControlData();
  const capabilities = useApplicationUiCapabilities();
  const [editing, setEditing] = useState<RmmScript | true>();
  const [executing, setExecuting] = useState<RmmScript>();
  const [detailId, setDetailId] = useState<string>();
  const [error, setError] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('all');
  const [archive, setArchive] = useState('active');
  const [source, setSource] = useState('all');
  const [tag, setTag] = useState<string>();
  const refresh = () => setRevision((value) => value + 1);
  const connected = status === 'connected';
  const scripts = useRmmQuery(client, connected, listScripts, undefined, revision);
  const selectedScript = scripts.result?.find((script) => script.id === detailId);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return (scripts.result ?? []).filter(
      (script) =>
        (!search || `${script.name} ${script.description}`.toLowerCase().includes(search)) &&
        (platform === 'all' || (script.platform ?? 'windows') === platform) &&
        (archive === 'all' || script.archived === (archive === 'archived')) &&
        (source === 'all' || script.builtin === (source === 'builtin')) &&
        (!tag || script.tags?.includes(tag)),
    );
  }, [scripts.result, query, platform, archive, source, tag]);
  return (
    <div className="page-stack">
      <PageHeader
        title={t('rmm.library')}
        description={t('rmm.libraryDescription')}
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
      {!connected && <Alert type="warning" message={t('rmm.disconnected')} />}
      <Panel className="devices-table-card">
        <FilterBar>
          <Input
            aria-label={t('rmm.searchScripts')}
            placeholder={t('rmm.searchScripts')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            allowClear
          />
          <Select
            aria-label={t('rmm.platform')}
            value={platform}
            onChange={setPlatform}
            options={[
              { value: 'all', label: t('rmm.allPlatforms') },
              { value: 'windows', label: 'Windows · PowerShell' },
              { value: 'linux', label: 'Linux · /bin/sh' },
            ]}
          />
          <Select
            aria-label={t('rmm.scriptState')}
            value={archive}
            onChange={setArchive}
            options={[
              { value: 'active', label: t('rmm.activeScripts') },
              { value: 'archived', label: t('rmm.archived') },
              { value: 'all', label: t('rmm.allScripts') },
            ]}
          />
          <Select
            aria-label={t('rmm.source')}
            value={source}
            onChange={setSource}
            options={[
              { value: 'all', label: t('rmm.allSources') },
              { value: 'builtin', label: t('rmm.builtin') },
              { value: 'custom', label: t('rmm.custom') },
            ]}
          />
          <Select
            aria-label={t('rmm.tags')}
            placeholder={t('rmm.allTags')}
            value={tag}
            allowClear
            style={{ minWidth: 150 }}
            onChange={setTag}
            options={[...new Set((scripts.result ?? []).flatMap((script) => script.tags ?? []))]
              .sort()
              .map((value) => ({ value, label: value }))}
          />
          <div className="toolbar-spacer" />
          {scripts.result && (
            <Tag>
              {filtered.length} / {scripts.result.length}
            </Tag>
          )}
        </FilterBar>
        <ConsoleTable<RmmScript>
          rowKey="id"
          dataSource={filtered}
          loading={connected && !scripts.result && !scripts.error}
          scroll={{ x: 800 }}
          locale={{
            emptyText: scripts.result && (
              <Empty
                description={t(scripts.result?.length ? 'rmm.noMatchingScripts' : 'rmm.noScripts')}
              />
            ),
          }}
          columns={[
            {
              title: t('rmm.name'),
              render: (_value, script) => (
                <Button type="link" onClick={() => setDetailId(script.id)}>
                  {script.name}
                </Button>
              ),
            },
            { title: t('rmm.description'), dataIndex: 'description' },
            { title: t('rmm.version'), dataIndex: 'version' },
            {
              title: t('rmm.tags'),
              render: (_value, script) =>
                (script.tags ?? []).map((value) => <Tag key={value}>{value}</Tag>),
            },
            {
              title: t('rmm.source'),
              render: (_value, script) => (
                <Tag>{t(script.builtin ? 'rmm.builtin' : 'rmm.custom')}</Tag>
              ),
            },
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
      {selectedScript && (
        <ScriptDetails
          script={selectedScript}
          client={client}
          connected={connected}
          canEdit={capabilities.siteAdmin}
          onClose={() => setDetailId(undefined)}
          onExecute={(script) => {
            setDetailId(undefined);
            setExecuting(script);
          }}
          onEdit={(script) => {
            setDetailId(undefined);
            setEditing(script);
          }}
        />
      )}
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
