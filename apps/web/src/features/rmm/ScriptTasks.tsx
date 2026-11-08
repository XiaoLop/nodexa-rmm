import type { RmmResource, RmmResult, RmmTask } from '@meshcentral/control-client';
import { useRmmQuery } from '@meshcentral/shared-state';
import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMeshCentralControlData } from '../gateway';
import { useFormatters } from '../../i18n';

const hasActiveTask = ({ tasks }: { tasks: RmmTask[] }) => tasks.some(({ active }) => active);
const isActiveTask = ({ active, results }: RmmTask & { results: RmmResult[] }) =>
  active || results.some((row) => !!row.occupiedBy);

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
  const before = pages.at(-1);
  const list = useCallback((api: RmmResource) => api.listTasks(before), [before]);
  const get = useCallback((api: RmmResource) => api.getTask(taskId ?? ''), [taskId]);
  const connected = status === 'connected';
  const tasks = useRmmQuery(client, connected && !taskId, list, hasActiveTask, revision);
  const detail = useRmmQuery(client, connected && !!taskId, get, isActiveTask, revision);
  const error = taskId ? detail.error : tasks.error;
  const summary = (task: RmmTask) =>
    Object.entries(task.counts).map(([state, count]) => (
      <Tag key={state}>
        {t('rmm.status.' + state)} {count}
      </Tag>
    ));
  return (
    <Space direction="vertical" style={{ display: 'flex' }}>
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
      <Button disabled={!connected} onClick={() => setRevision((value) => value + 1)}>
        {t('rmm.refresh')}
      </Button>
      {error && <Alert type="error" message={t('rmm.error', { code: error })} />}
      {taskId ? (
        <>
          <Button onClick={() => onSelect()}>{t('rmm.back')}</Button>
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
              <Table<RmmResult>
                rowKey="id"
                dataSource={detail.result.results}
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
                        {t('rmm.status.' + row.status)}
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
                ]}
                expandable={{
                  rowExpandable: (row) => row.output !== null,
                  expandedRowRender: (row) => (
                    <>
                      {row.truncated && <Tag>{t('rmm.truncated')}</Tag>}
                      <pre
                        style={{
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          maxHeight: 400,
                          overflow: 'auto',
                        }}
                      >
                        {row.output}
                      </pre>
                    </>
                  ),
                }}
              />
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
        <>
          <Table<RmmTask>
            rowKey="id"
            dataSource={tasks.result?.tasks ?? []}
            pagination={false}
            loading={connected && !tasks.result && !tasks.error}
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
        </>
      )}
    </Space>
  );
}
