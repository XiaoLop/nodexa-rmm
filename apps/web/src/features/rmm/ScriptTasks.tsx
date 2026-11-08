import type { RmmResource, RmmResult, RmmStatus, RmmTask } from '@meshcentral/control-client';
import { useRmmQuery } from '@meshcentral/shared-state';
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
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
  const [statusFilter, setStatusFilter] = useState<RmmStatus | 'all'>('all');
  const [resultFilter, setResultFilter] = useState<RmmStatus | 'all' | 'attention'>('all');
  const [deviceQuery, setDeviceQuery] = useState('');
  const [selectedOutput, setSelectedOutput] = useState<{ taskId: string; deviceId: string }>();
  const before = pages.at(-1);
  const list = useCallback((api: RmmResource) => api.listTasks(before), [before]);
  const get = useCallback((api: RmmResource) => api.getTask(taskId ?? ''), [taskId]);
  const connected = status === 'connected';
  const tasks = useRmmQuery(client, connected && !taskId, list, hasActiveTask, revision);
  const detail = useRmmQuery(client, connected && !!taskId, get, isActiveTask, revision);
  const error = taskId ? detail.error : tasks.error;
  const filteredTasks = (tasks.result?.tasks ?? []).filter((task) => {
    const search = query.trim().toLowerCase();
    return (
      (!search || `${task.name} ${task.actor} ${task.id}`.toLowerCase().includes(search)) &&
      (statusFilter === 'all' || (task.counts[statusFilter] ?? 0) > 0)
    );
  });
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
    <Space direction="vertical" style={{ display: 'flex' }}>
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
          <Space wrap>
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
          </Space>
          {connected && !detail.result && !detail.error && <Spin />}
          {detail.result && (
            <>
              <Typography.Title level={4}>
                {detail.result.name} v{detail.result.version}
              </Typography.Title>
              <Tag>
                {detail.result.platform === 'linux' ? 'Linux · /bin/sh' : 'Windows · PowerShell'}
              </Tag>
              <Typography.Text>
                {detail.result.actor} · {dateTime(new Date(detail.result.created).toISOString())}
              </Typography.Text>
              <Space wrap>{summary(detail.result)}</Space>
              <Space wrap>
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
              </Space>
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
                      <>
                        <Tag color={statusColors[row.status]}>{t('rmm.status.' + row.status)}</Tag>
                        {row.reason && ' · ' + t('rmm.reason.' + row.reason)}
                        {row.waitingReason && <div>{t('rmm.reason.' + row.waitingReason)}</div>}
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
                      </>
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
              {selectedResult && (
                <ResultOutput key={`${taskId}:${selectedResult.id}`} result={selectedResult} />
              )}
              <Collapse
                items={[
                  {
                    key: 'audit',
                    label: t('rmm.audit'),
                    children: (
                      <Typography.Text>
                        {detail.result.actor} · {detail.result.scriptId} v{detail.result.version} ·{' '}
                        {detail.result.id}
                      </Typography.Text>
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
            <Input
              aria-label={t('rmm.searchTasks')}
              placeholder={t('rmm.searchTasks')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              allowClear
            />
            <Select<RmmStatus | 'all'>
              aria-label={t('rmm.resultFilter')}
              value={statusFilter}
              onChange={setStatusFilter}
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
          <Typography.Text type="secondary">{t('rmm.currentPageFilter')}</Typography.Text>
          <ConsoleTable<RmmTask>
            rowKey="id"
            dataSource={filteredTasks}
            pagination={false}
            loading={connected && !tasks.result && !tasks.error}
            scroll={{ x: 800 }}
            locale={{
              emptyText: tasks.result && (
                <Empty
                  description={t(
                    tasks.result?.tasks.length ? 'rmm.noMatchingTasks' : 'rmm.noTasks',
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
