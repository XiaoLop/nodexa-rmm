import type { RmmResource, RmmResult, RmmStatus, RmmTask } from '@meshcentral/control-client';
import { useRmmQuery } from '@meshcentral/shared-state';
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Descriptions,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMeshCentralControlData } from '../gateway';
import { useFormatters } from '../../i18n';
import { ConsoleTable, FilterBar, PageHeader, Panel } from '../../components/ui';
import { ResultOutput } from './ResultOutput';
import './rmm-task-details.css';

const hasActiveTask = ({ tasks }: { tasks: RmmTask[] }) => tasks.some(({ active }) => active);
const isActiveTask = ({ active, results }: RmmTask & { results: RmmResult[] }) =>
  active || results.some((row) => !!row.occupiedBy);
const statusColors: Record<RmmStatus, string> = {
  queued: 'default',
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
  skipped: 'default',
  timeout: 'warning',
  unknown: 'warning',
};

export function ScriptTasks({
  taskId,
  onSelect,
}: {
  taskId?: string;
  onSelect: (id?: string) => void;
}) {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const { client, status } = useMeshCentralControlData();
  const [pages, setPages] = useState<number[]>([]);
  const [revision, setRevision] = useState(0);
  const [release, setRelease] = useState<RmmResult>();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string>();
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RmmStatus | 'all'>('all');
  const [resultFilter, setResultFilter] = useState<RmmStatus | 'all' | 'attention'>('all');
  const [deviceQuery, setDeviceQuery] = useState('');
  const [selectedOutput, setSelectedOutput] = useState<{ taskId: string; deviceId: string }>();
  const before = pages.at(-1);
  const list = useCallback(
    (api: RmmResource) =>
      api.searchTasks(before, {
        query: appliedQuery || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    [before, appliedQuery, statusFilter],
  );
  const get = useCallback((api: RmmResource) => api.getTask(taskId ?? ''), [taskId]);
  const connected = status === 'connected';
  const tasks = useRmmQuery(client, connected && !taskId, list, hasActiveTask, revision);
  const detail = useRmmQuery(client, connected && !!taskId, get, isActiveTask, revision);
  const error = taskId ? detail.error : tasks.error;
  const filteredResults = (detail.result?.results ?? []).filter((row) => {
    const search = deviceQuery.trim().toLowerCase();
    const matchesStatus =
      resultFilter === 'all' ||
      (resultFilter === 'attention'
        ? row.status === 'failed' ||
          row.status === 'skipped' ||
          row.status === 'timeout' ||
          row.status === 'unknown' ||
          !!row.waitingReason
        : row.status === resultFilter);
    return matchesStatus && (!search || `${row.name} ${row.id}`.toLowerCase().includes(search));
  });
  const selectedResult =
    selectedOutput && selectedOutput.taskId === taskId
      ? filteredResults.find((row) => row.id === selectedOutput.deviceId)
      : undefined;
  const summary = (task: RmmTask) =>
    (Object.entries(task.counts) as [RmmStatus, number][]).map(([state, count]) => (
      <Tag key={state} color={statusColors[state]}>
        {t('rmm.status.' + state)} {count}
      </Tag>
    ));
  return (
    <Space direction="vertical" size={taskId ? 20 : 16} style={{ display: 'flex' }}>
      <PageHeader title={t('taskCenter.title')} description={t('rmm.serverTasksDescription')} />
      <Modal
        open={!!release}
        title={t('rmm.releaseDevice')}
        onCancel={() => {
          if (!releasing) setRelease(undefined);
        }}
        confirmLoading={releasing}
        okButtonProps={{ disabled: !connected || !confirmed || !reason.trim() || releasing }}
        onOk={async () => {
          if (!client || !release?.occupiedBy || !confirmed || !reason.trim()) return;
          setReleasing(true);
          setReleaseError(undefined);
          try {
            await client.rmm.releaseDevice(release.id, release.occupiedBy, reason);
            setRelease(undefined);
            setRevision((value) => value + 1);
          } catch (error) {
            setReleaseError(error instanceof Error ? error.message : 'REQUEST_FAILED');
          } finally {
            setReleasing(false);
          }
        }}
      >
        <p>{t('rmm.releaseWarning')}</p>
        <p>
          {release?.name} · {release?.occupiedBy}
        </p>
        <Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}>
          {t('rmm.releaseConfirmed')}
        </Checkbox>
        <Input.TextArea
          aria-label={t('rmm.releaseReason')}
          placeholder={t('rmm.releaseReason')}
          value={reason}
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
        />
        {releaseError && <Alert type="error" message={t('rmm.error', { code: releaseError })} />}
      </Modal>
      {!connected && <Alert type="warning" message={t('rmm.disconnected')} />}
      {error && <Alert type="error" message={t('rmm.error', { code: error })} />}
      {taskId ? (
        <>
          <div className="rmm-task-navigation">
            <Button
              onClick={() => {
                setSelectedOutput(undefined);
                onSelect();
              }}
            >
              {t('rmm.back')}
            </Button>
            <Button disabled={!connected} onClick={() => setRevision((value) => value + 1)}>
              {t('rmm.refresh')}
            </Button>
          </div>
          {connected && !detail.result && !detail.error && <Spin />}
          {detail.result && (
            <>
              <section className="rmm-task-overview">
                <div className="rmm-task-heading">
                  <div>
                    <Typography.Title level={3}>
                      {detail.result.name} v{detail.result.version}
                    </Typography.Title>
                    <Tag>
                      {detail.result.platform === 'linux'
                        ? 'Linux · /bin/sh'
                        : 'Windows · PowerShell'}
                    </Tag>
                  </div>
                  <dl className="rmm-task-metadata">
                    <div>
                      <dt>{t('rmm.actor')}</dt>
                      <dd>{detail.result.actor}</dd>
                    </div>
                    <div>
                      <dt>{t('rmm.created')}</dt>
                      <dd>{dateTime(new Date(detail.result.created).toISOString())}</dd>
                    </div>
                  </dl>
                </div>
                <div className="rmm-task-status-grid">
                  {(Object.entries(detail.result.counts) as [RmmStatus, number][]).map(
                    ([state, count]) => (
                      <div className="rmm-task-status-card" key={state}>
                        <Tag color={statusColors[state]}>{t('rmm.status.' + state)}</Tag>
                        <strong>{count}</strong>
                      </div>
                    ),
                  )}
                </div>
              </section>
              <Panel className="rmm-task-results" title={t('rmm.deviceResults')}>
                <FilterBar className="rmm-task-result-filters">
                  <Input
                    aria-label={t('rmm.searchDevices')}
                    placeholder={t('rmm.searchDevices')}
                    value={deviceQuery}
                    allowClear
                    onChange={(event) => {
                      setDeviceQuery(event.target.value);
                      setSelectedOutput(undefined);
                    }}
                  />
                  <Select<RmmStatus | 'all' | 'attention'>
                    aria-label={t('rmm.resultFilter')}
                    value={resultFilter}
                    onChange={(value) => {
                      setResultFilter(value);
                      setSelectedOutput(undefined);
                    }}
                    style={{ minWidth: 180 }}
                    options={[
                      { value: 'all', label: t('rmm.allResults') },
                      { value: 'attention', label: t('rmm.attentionResults') },
                      ...(
                        [
                          'queued',
                          'running',
                          'succeeded',
                          'failed',
                          'skipped',
                          'timeout',
                          'unknown',
                        ] as const
                      ).map((value) => ({ value, label: t('rmm.status.' + value) })),
                    ]}
                  />
                  <Typography.Text type="secondary">
                    {filteredResults.length} / {detail.result.results.length}
                  </Typography.Text>
                </FilterBar>
                <Table<RmmResult>
                  rowKey="id"
                  dataSource={filteredResults}
                  scroll={{ x: 650 }}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                  locale={{ emptyText: <Empty description={t('rmm.noMatchingDevices')} /> }}
                  columns={[
                    {
                      title: t('rmm.devices'),
                      render: (_value, row) => (
                        <Link to={'/devices/' + encodeURIComponent(row.id) + '/workspace'}>
                          {row.name}
                        </Link>
                      ),
                    },
                    {
                      title: t('rmm.result'),
                      render: (_value, row) => (
                        <div className="rmm-task-result-state">
                          <Tag color={statusColors[row.status]}>
                            {t('rmm.status.' + row.status)}
                          </Tag>
                          {row.reason && (
                            <Typography.Text type="secondary">
                              {t('rmm.reason.' + row.reason)}
                            </Typography.Text>
                          )}
                          {row.waitingReason && (
                            <Typography.Text type="secondary">
                              {t('rmm.reason.' + row.waitingReason)}
                            </Typography.Text>
                          )}
                          {row.canRelease && row.occupiedBy && (
                            <Button
                              disabled={!connected}
                              onClick={() => {
                                setRelease(row);
                                setReason('');
                                setConfirmed(false);
                                setReleaseError(undefined);
                              }}
                            >
                              {t('rmm.releaseDevice')}
                            </Button>
                          )}
                        </div>
                      ),
                    },
                    { title: t('rmm.exitCode'), dataIndex: 'exitCode' },
                    {
                      title: t('rmm.outputTitle'),
                      render: (_value, row) => (
                        <Button
                          type="link"
                          onClick={() => setSelectedOutput({ taskId, deviceId: row.id })}
                        >
                          {t('rmm.viewOutput')}
                        </Button>
                      ),
                    },
                  ]}
                />
              </Panel>
              {selectedResult && (
                <ResultOutput key={`${taskId}:${selectedResult.id}`} result={selectedResult} />
              )}
              <Collapse
                className="rmm-task-audit"
                items={[
                  {
                    key: 'audit',
                    label: t('rmm.audit'),
                    children: (
                      <Descriptions column={1} size="small" bordered>
                        <Descriptions.Item label={t('rmm.actor')}>
                          {detail.result.actor}
                        </Descriptions.Item>
                        <Descriptions.Item label={t('rmm.scriptReference')}>
                          <code>
                            {detail.result.scriptId} v{detail.result.version}
                          </code>
                        </Descriptions.Item>
                        <Descriptions.Item label={t('rmm.taskReference')}>
                          <code>{detail.result.id}</code>
                        </Descriptions.Item>
                      </Descriptions>
                    ),
                  },
                ]}
              />
            </>
          )}
        </>
      ) : (
        <Panel className="devices-table-card">
          <FilterBar>
            <Input.Search
              aria-label={t('rmm.searchTasks')}
              placeholder={t('rmm.searchTasks')}
              value={query}
              maxLength={200}
              onChange={(event) => setQuery(event.target.value)}
              onSearch={(value) => {
                setPages([]);
                setAppliedQuery(value.trim());
              }}
              allowClear
            />
            <Select<RmmStatus | 'all'>
              aria-label={t('rmm.resultFilter')}
              value={statusFilter}
              onChange={(value) => {
                setPages([]);
                setStatusFilter(value);
              }}
              options={[
                { value: 'all', label: t('rmm.allResults') },
                ...(
                  [
                    'queued',
                    'running',
                    'succeeded',
                    'failed',
                    'skipped',
                    'timeout',
                    'unknown',
                  ] as const
                ).map((value) => ({ value, label: t('rmm.status.' + value) })),
              ]}
            />
            <div className="toolbar-spacer" />
            <Button disabled={!connected} onClick={() => setRevision((value) => value + 1)}>
              {t('rmm.refresh')}
            </Button>
          </FilterBar>
          <Typography.Text type="secondary">{t('rmm.historyFilter')}</Typography.Text>
          <ConsoleTable<RmmTask>
            rowKey="id"
            dataSource={tasks.result?.tasks ?? []}
            pagination={false}
            loading={connected && !tasks.result && !tasks.error}
            scroll={{ x: 800 }}
            locale={{
              emptyText: tasks.result && (
                <Empty
                  description={t(
                    appliedQuery || statusFilter !== 'all' || tasks.result?.before !== undefined
                      ? 'rmm.noMatchingTasks'
                      : 'rmm.noTasks',
                  )}
                />
              ),
            }}
            columns={[
              {
                title: t('rmm.name'),
                render: (_value, row) => (
                  <Button type="link" onClick={() => onSelect(row.id)}>
                    {row.name} v{row.version}
                  </Button>
                ),
              },
              { title: t('rmm.actor'), dataIndex: 'actor' },
              {
                title: t('rmm.created'),
                render: (_value, row) => dateTime(new Date(row.created).toISOString()),
              },
              {
                title: t('rmm.result'),
                render: (_value, row) => <Space wrap>{summary(row)}</Space>,
              },
            ]}
          />
          <Space>
            <Button
              disabled={!pages.length}
              onClick={() => setPages((value) => value.slice(0, -1))}
            >
              {t('rmm.previous')}
            </Button>
            <Button
              disabled={tasks.result?.before === undefined}
              onClick={() => {
                const next = tasks.result?.before;
                if (next !== undefined) setPages((value) => [...value, next]);
              }}
            >
              {t('rmm.next')}
            </Button>
          </Space>
        </Panel>
      )}
    </Space>
  );
}
