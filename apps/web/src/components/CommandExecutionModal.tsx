import {
  CheckCircleOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type {
  CommandBatchSnapshot,
  CommandDeviceResult,
  CommandExecutionHandle,
  CommandExecutionStatus,
  CommandShell,
  MeshCentralClient,
} from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
import {
  Alert,
  Button,
  Descriptions,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  type TableColumnsType,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addCommandHistory,
  getCommandHistory,
  type CommandHistoryEntry,
} from '../features/commands/commandHistory';
import { classifyCommandRisk, mayContainSecret } from '../features/commands/commandRisk';
import { cleanCommandOutput } from '../features/commands/commandOutput';
import {
  resolveCommandShell,
  supportsRemoteCommand,
} from '../features/commands/commandShell';

interface CommandExecutionModalProps {
  open: boolean;
  devices: Device[];
  client?: MeshCentralClient;
  connected: boolean;
  onClose: () => void;
}

const statusColors: Record<CommandExecutionStatus, string> = {
  submitting: 'processing',
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
  cancelled: 'default',
  timedOut: 'warning',
  unknown: 'warning',
};

const templates = [
  { id: 'hostname', shell: 'auto' as const, command: 'hostname' },
  { id: 'currentUser', shell: 'auto' as const, command: 'whoami' },
  { id: 'windowsNetwork', shell: 'powershell' as const, command: 'Get-NetIPConfiguration' },
  {
    id: 'windowsDisk',
    shell: 'powershell' as const,
    command: 'Get-PSDrive -PSProvider FileSystem',
  },
  { id: 'unixDisk', shell: 'shell' as const, command: 'df -h' },
];

function isActive(status?: CommandExecutionStatus) {
  return status === 'submitting' || status === 'running';
}

function outputText(result?: CommandDeviceResult) {
  return cleanCommandOutput(result?.output.map((chunk) => chunk.content).join('') ?? '');
}

export function CommandExecutionModal({

  open,
  devices,
  client,
  connected,
  onClose,
}: CommandExecutionModalProps) {
  const { t } = useTranslation();
  const [messageApi, contextHolder] = message.useMessage();
  const [command, setCommand] = useState('');
  const [shell, setShell] = useState<CommandShell>('auto');
  const [runAsUser, setRunAsUser] = useState<0 | 1 | 2>(0);
  const [timeoutMs, setTimeoutMs] = useState(60_000);
  const [snapshot, setSnapshot] = useState<CommandBatchSnapshot>();
  const [results, setResults] = useState<CommandDeviceResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string>();
  const [dangerConfirmation, setDangerConfirmation] = useState('');
  const [history, setHistory] = useState<CommandHistoryEntry[]>(() => getCommandHistory());
  const handlesRef = useRef<CommandExecutionHandle[]>([]);
  const unsubscribersRef = useRef<(() => void)[]>([]);

  const eligibleDevices = useMemo(
    () => devices.filter((device) => device.online && supportsRemoteCommand(device)),
    [devices],
  );
  const skippedCount = devices.length - eligibleDevices.length;
  const risk = classifyCommandRisk(command, shell);
  const active =
    handlesRef.current.length > 0 &&
    handlesRef.current.some((handle) => isActive(handle.getSnapshot().status));
  const selectedResult =
    results.find((result) => result.deviceId === selectedResultId) ?? results[0];

  useEffect(() => {
    if (!open) return;
    setCommand('');
    setShell('auto');
    setRunAsUser(0);
    setTimeoutMs(60_000);
    setSnapshot(undefined);
    setResults([]);
    setSelectedResultId(undefined);
    setDangerConfirmation('');
    setHistory(getCommandHistory());
  }, [open]);

  useEffect(
    () => () => {
      unsubscribersRef.current.forEach((unsubscribe) => unsubscribe());
      handlesRef.current.forEach((handle) => handle.stopTracking());
    },
    [],
  );

  const mergeSnapshots = () => {
    const snapshots = handlesRef.current.map((handle) => handle.getSnapshot());
    const mergedResults = snapshots.flatMap((value) => value.results);
    const statuses = snapshots.map((value) => value.status);
    const mergedStatus = statuses.some(isActive)
      ? 'running'
      : statuses.every((value) => value === 'succeeded')
        ? 'succeeded'
        : statuses.some((value) => value === 'failed')
          ? 'failed'
          : statuses.some((value) => value === 'timedOut')
            ? 'timedOut'
            : 'unknown';
    setResults(mergedResults);
    setSnapshot({
      requestId: snapshots.map((value) => value.requestId).join(', '),
      status: mergedStatus,
      results: mergedResults,
      trackingStopped: snapshots.some((value) => value.trackingStopped),
    });
  };

  const execute = () => {
    if (!client || !connected || !command.trim() || !eligibleDevices.length) return;
    unsubscribersRef.current.forEach((unsubscribe) => unsubscribe());
    handlesRef.current.forEach((handle) => handle.stopTracking());
    unsubscribersRef.current = [];
    handlesRef.current = [];

    const groups = new Map<
      string,
      { shell: 'shell' | 'powershell'; command: string; devices: Device[] }
    >();
    for (const device of eligibleDevices) {
      const resolved = resolveCommandShell(device, shell);
      const key = `${resolved}\0${command}`;
      const group = groups.get(key) ?? {
        shell: resolved,
        command,
        devices: [],
      };
      group.devices.push(device);
      groups.set(key, group);
    }
    try {
      for (const group of groups.values()) {
        const handle = client.commands.execute(
          group.devices.map((device) => device.id),
          group.command,
          { shell: group.shell, runAsUser, timeoutMs },
        );
        handlesRef.current.push(handle);
        unsubscribersRef.current.push(handle.subscribe(mergeSnapshots));
      }
      if (!mayContainSecret(command)) {
        setHistory(addCommandHistory({ command, shell, targetCount: eligibleDevices.length }));
      }
      setSelectedResultId(eligibleDevices[0]?.id);
      mergeSnapshots();
    } catch (error) {
      void messageApi.error(error instanceof Error ? error.message : t('commands.errors.submitFailed'));
    }
  };

  const submit = () => {
    if (risk === 'dangerous' && dangerConfirmation !== t('commands.confirmKeyword')) return;
    if (risk === 'sensitive') {
      Modal.confirm({
        title: t('commands.modals.sensitiveTitle'),
        icon: <ExclamationCircleOutlined />,
        content: t('commands.modals.sensitiveContent', { count: eligibleDevices.length }),
        okText: t('commands.modals.continueRun'),
        cancelText: t('common.actions.cancel'),
        onOk: execute,
      });
      return;
    }
    execute();
  };

  const requestClose = () => {
    if (!active) {
      onClose();
      return;
    }
    Modal.confirm({
      title: t('commands.modals.stopWaitTitle'),
      icon: <StopOutlined />,
      content: t('commands.modals.stopWaitContent'),
      okText: t('commands.modals.stopWaitOk'),
      okButtonProps: { danger: true },
      cancelText: t('commands.modals.continueWait'),
      onOk: () => {
        handlesRef.current.forEach((handle) => handle.stopTracking());
        onClose();
      },
    });
  };

  const columns: TableColumnsType<CommandDeviceResult> = [
    {
      title: t('commands.columns.device'),
      dataIndex: 'deviceId',
      render: (deviceId: string) =>
        devices.find((device) => device.id === deviceId)?.name ?? deviceId,
    },
    {
      title: t('commands.columns.status'),
      dataIndex: 'status',
      width: 110,
      render: (status: CommandExecutionStatus) => (
        <Tag color={statusColors[status]}>{t(`commands.status.${status}`)}</Tag>
      ),
    },
    { title: t('commands.columns.exitCode'), dataIndex: 'exitCode', width: 90, render: (value?: number) => value ?? '—' },
    {
      title: t('commands.columns.duration'),
      dataIndex: 'durationMs',
      width: 100,
      render: (value?: number) => (value === undefined ? '—' : t('commands.columns.durationSeconds', { seconds: (value / 1000).toFixed(1) })),
    },
    {
      title: t('commands.columns.outputSummary'),
      render: (_, result) => result.error || outputText(result).trim().split(/\r?\n/)[0] || '—',
      ellipsis: true,
    },
    {
      title: t('commands.columns.actions'),
      width: 80,
      render: (_, result) => (
        <Button type="link" onClick={() => setSelectedResultId(result.deviceId)}>
          {t('commands.actions.view')}
        </Button>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={
        <Space>
          <ToolOutlined />
          {devices.length === 1 ? t('commands.titleSingle', { name: devices.at(0)?.name ?? t('commands.deviceDefault') }) : t('commands.titleBatch', { count: devices.length })}
        </Space>
      }
      width={1040}
      onCancel={requestClose}
      destroyOnHidden
      footer={[
        <Button key="close" onClick={requestClose}>
          {active ? t('commands.actions.stopClose') : t('commands.actions.close')}
        </Button>,
        <Button
          key="run"
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={active}
          disabled={
            !client ||
            !connected ||
            !command.trim() ||
            !eligibleDevices.length ||
            active ||
            (risk === 'dangerous' && dangerConfirmation !== t('commands.confirmKeyword'))
          }
          onClick={submit}
        >
          {t('commands.actions.runCount', { count: eligibleDevices.length })}
        </Button>,
      ]}
    >
      {contextHolder}
      <div className="command-execution-layout">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Descriptions size="small" column={3}>
            <Descriptions.Item label={t('commands.descriptions.target')}>
              {devices.length === 1 ? devices[0]?.name : t('commands.descriptions.targetCount', { count: devices.length })}
            </Descriptions.Item>
            <Descriptions.Item label={t('commands.descriptions.eligible')}>{eligibleDevices.length}</Descriptions.Item>
            <Descriptions.Item label={t('commands.descriptions.skipped')}>{skippedCount}</Descriptions.Item>
          </Descriptions>
          {!connected && <Alert showIcon type="error" title={t('commands.alerts.gatewayDisconnected')} />}
          {skippedCount > 0 && (
            <Alert
              showIcon
              type="warning"
              title={t('commands.alerts.skippedNotice', { count: skippedCount })}
            />
          )}
          <Space wrap>
            <Segmented
              value={shell}
              onChange={(value) => setShell(value as CommandShell)}
              options={[
                { label: t('commands.shells.auto'), value: 'auto' },
                { label: t('commands.shells.shell'), value: 'shell' },
                { label: t('commands.shells.powershell'), value: 'powershell' },
              ]}
            />
            <Select
              value={runAsUser}
              onChange={setRunAsUser}
              options={[
                { label: t('commands.runAs.default'), value: 0 },
                { label: t('commands.runAs.user'), value: 1 },
                { label: t('commands.runAs.system'), value: 2 },
              ]}
              style={{ width: 140 }}
            />
            <Select
              value={timeoutMs}
              onChange={setTimeoutMs}
              options={[30_000, 60_000, 120_000, 300_000].map((value) => ({
                value,
                label: t('commands.timeoutSeconds', { seconds: value / 1000 }),
              }))}
              style={{ width: 140 }}
            />
          </Space>
          <Select
            placeholder={t('commands.templatePlaceholder')}
            options={templates.map((template) => ({ value: template.id, label: t(`commands.templates.${template.id}`) }))}
            onChange={(id) => {
              const template = templates.find((item) => item.id === id);
              if (template) {
                setCommand(template.command);
                setShell(template.shell);
              }
            }}
          />
          <Input.TextArea
            value={command}
            onChange={(event) => {
              setCommand(event.target.value);
              setDangerConfirmation('');
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
            autoSize={{ minRows: 5, maxRows: 12 }}
            placeholder={t('commands.commandPlaceholder')}
            className="command-editor"
          />
          {mayContainSecret(command) && (
            <Alert showIcon type="warning" title={t('commands.sensitiveNotice')} />
          )}
          {risk === 'dangerous' && (
            <Alert
              showIcon
              type="error"
              title={t('commands.dangerousTitle')}
              description={
                <Space direction="vertical">
                  <Typography.Text>{t('commands.dangerousDescription')}</Typography.Text>
                  <Input
                    value={dangerConfirmation}
                    onChange={(event) => setDangerConfirmation(event.target.value)}
                    placeholder={t('commands.dangerInputPlaceholder')}
                  />
                </Space>
              }
            />
          )}
          {history.length > 0 && (
            <Space wrap>
              <Typography.Text type="secondary">{t('commands.recentCommands')}</Typography.Text>
              {history.slice(0, 5).map((entry) => (
                <Button
                  key={entry.id}
                  size="small"
                  onClick={() => {
                    setCommand(entry.command);
                    setShell(entry.shell);
                  }}
                >
                  {entry.command.split(/\r?\n/).at(0)?.slice(0, 28) ?? entry.command.slice(0, 28)}
                </Button>
              ))}
            </Space>
          )}
          {snapshot && (
            <Alert
              showIcon
              type={
                snapshot.status === 'succeeded'
                  ? 'success'
                  : isActive(snapshot.status)
                    ? 'info'
                    : 'warning'
              }
              icon={snapshot.status === 'succeeded' ? <CheckCircleOutlined /> : undefined}
              title={t('commands.statusMessage', { status: t(`commands.status.${snapshot.status}`) })}
              description={
                snapshot.trackingStopped
                  ? t('commands.trackingStopped')
                  : t('commands.requestId', { id: snapshot.requestId })
              }
            />
          )}
          {results.length > 0 && (
            <Table
              rowKey="deviceId"
              size="small"
              columns={columns}
              dataSource={results}
              pagination={false}
              scroll={{ x: 760, y: 240 }}
            />
          )}
          {selectedResult && (
            <div className="command-output-panel">
              <div className="command-output-toolbar">
                <Typography.Text strong>
                  {devices.find((device) => device.id === selectedResult.deviceId)?.name ??
                    selectedResult.deviceId}{' '}
                  {t('commands.actions.output')}
                </Typography.Text>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => void navigator.clipboard.writeText(outputText(selectedResult))}
                >
                  {t('commands.actions.copy')}
                </Button>
              </div>
              <pre>
                {outputText(selectedResult) || selectedResult.error || t('commands.gatewayOutputUnavailable')}
              </pre>
            </div>
          )}
        </Space>
      </div>
    </Modal>
  );
}
