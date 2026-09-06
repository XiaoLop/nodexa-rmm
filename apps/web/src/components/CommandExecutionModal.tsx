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
  GatewayClient,
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
import {
  addCommandHistory,
  getCommandHistory,
  type CommandHistoryEntry,
} from '../features/commands/commandHistory';
import { classifyCommandRisk, mayContainSecret } from '../features/commands/commandRisk';
import { cleanCommandOutput } from '../features/commands/commandOutput';
import {
  prepareCommandForDevice,
  resolveCommandShell,
  supportsRemoteCommand,
} from '../features/commands/commandShell';

interface CommandExecutionModalProps {
  open: boolean;
  devices: Device[];
  client?: GatewayClient;
  connected: boolean;
  onClose: () => void;
}

const statusLabels: Record<CommandExecutionStatus, string> = {
  submitting: '提交中',
  running: '执行中',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
  timedOut: '超时',
  unknown: '状态未知',
};

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
  { name: '主机名', shell: 'auto' as const, command: 'hostname' },
  { name: '当前用户', shell: 'auto' as const, command: 'whoami' },
  { name: 'Windows 网络信息', shell: 'powershell' as const, command: 'Get-NetIPConfiguration' },
  {
    name: 'Windows 磁盘空间',
    shell: 'powershell' as const,
    command: 'Get-PSDrive -PSProvider FileSystem',
  },
  { name: 'Unix 磁盘空间', shell: 'shell' as const, command: 'df -h' },
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
      const preparedCommand = prepareCommandForDevice(device, resolved, command);
      const key = `${resolved}\0${preparedCommand}`;
      const group = groups.get(key) ?? {
        shell: resolved,
        command: preparedCommand,
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
      void messageApi.error(error instanceof Error ? error.message : '命令提交失败');
    }
  };

  const submit = () => {
    if (risk === 'dangerous' && dangerConfirmation !== '确认执行') return;
    if (risk === 'sensitive') {
      Modal.confirm({
        title: '确认执行敏感命令',
        icon: <ExclamationCircleOutlined />,
        content: `即将对 ${eligibleDevices.length} 台设备执行命令。服务端仍会进行最终权限校验。`,
        okText: '继续执行',
        cancelText: '取消',
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
      title: '停止等待命令结果？',
      icon: <StopOutlined />,
      content: '关闭后将停止本地跟踪，远端命令可能仍在运行。',
      okText: '停止等待并关闭',
      okButtonProps: { danger: true },
      cancelText: '继续等待',
      onOk: () => {
        handlesRef.current.forEach((handle) => handle.stopTracking());
        onClose();
      },
    });
  };

  const columns: TableColumnsType<CommandDeviceResult> = [
    {
      title: '设备',
      dataIndex: 'deviceId',
      render: (deviceId: string) =>
        devices.find((device) => device.id === deviceId)?.name ?? deviceId,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: CommandExecutionStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    { title: '退出码', dataIndex: 'exitCode', width: 90, render: (value?: number) => value ?? '—' },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      width: 100,
      render: (value?: number) => (value === undefined ? '—' : `${(value / 1000).toFixed(1)} 秒`),
    },
    {
      title: '输出摘要',
      render: (_, result) => result.error || outputText(result).trim().split(/\r?\n/)[0] || '—',
      ellipsis: true,
    },
    {
      title: '操作',
      width: 80,
      render: (_, result) => (
        <Button type="link" onClick={() => setSelectedResultId(result.deviceId)}>
          查看
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
          {devices.length === 1
            ? `执行指令 · ${devices.at(0)?.name ?? '设备'}`
            : `批量执行指令 · ${devices.length} 台`}
        </Space>
      }
      width={1040}
      onCancel={requestClose}
      destroyOnHidden
      footer={[
        <Button key="close" onClick={requestClose}>
          {active ? '停止/关闭' : '关闭'}
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
            (risk === 'dangerous' && dangerConfirmation !== '确认执行')
          }
          onClick={submit}
        >
          执行 {eligibleDevices.length} 台设备
        </Button>,
      ]}
    >
      {contextHolder}
      <div className="command-execution-layout">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Descriptions size="small" column={3}>
            <Descriptions.Item label="目标">
              {devices.length === 1 ? devices[0]?.name : `${devices.length} 台设备`}
            </Descriptions.Item>
            <Descriptions.Item label="可执行">{eligibleDevices.length}</Descriptions.Item>
            <Descriptions.Item label="跳过">{skippedCount}</Descriptions.Item>
          </Descriptions>
          {!connected && <Alert showIcon type="error" message="网关未连接，无法提交命令" />}
          {skippedCount > 0 && (
            <Alert
              showIcon
              type="warning"
              message={`${skippedCount} 台离线或平台不支持的设备将跳过`}
            />
          )}
          <Space wrap>
            <Segmented
              value={shell}
              onChange={(value) => setShell(value as CommandShell)}
              options={[
                { label: '自动', value: 'auto' },
                { label: 'Shell', value: 'shell' },
                { label: 'PowerShell', value: 'powershell' },
              ]}
            />
            <Select
              value={runAsUser}
              onChange={setRunAsUser}
              options={[
                { label: '默认身份', value: 0 },
                { label: '用户身份', value: 1 },
                { label: '系统身份', value: 2 },
              ]}
              style={{ width: 140 }}
            />
            <Select
              value={timeoutMs}
              onChange={setTimeoutMs}
              options={[30_000, 60_000, 120_000, 300_000].map((value) => ({
                value,
                label: `${value / 1000} 秒超时`,
              }))}
              style={{ width: 140 }}
            />
          </Space>
          <Select
            placeholder="填入低风险命令模板"
            options={templates.map((template) => ({ value: template.name, label: template.name }))}
            onChange={(name) => {
              const template = templates.find((item) => item.name === name);
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
            placeholder="输入要执行的命令，Ctrl/Cmd + Enter 提交"
            className="command-editor"
          />
          {mayContainSecret(command) && (
            <Alert showIcon type="warning" message="命令可能包含敏感信息，本次不会加入会话历史" />
          )}
          {risk === 'dangerous' && (
            <Alert
              showIcon
              type="error"
              message="检测到高风险命令"
              description={
                <Space direction="vertical">
                  <Typography.Text>此操作不可自动撤销。请输入“确认执行”后再提交。</Typography.Text>
                  <Input
                    value={dangerConfirmation}
                    onChange={(event) => setDangerConfirmation(event.target.value)}
                    placeholder="确认执行"
                  />
                </Space>
              }
            />
          )}
          {history.length > 0 && (
            <Space wrap>
              <Typography.Text type="secondary">最近命令</Typography.Text>
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
              message={`执行状态：${statusLabels[snapshot.status]}`}
              description={
                snapshot.trackingStopped
                  ? '已停止本地等待；远端命令可能仍在运行。'
                  : `请求 ID：${snapshot.requestId}`
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
                  输出
                </Typography.Text>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => void navigator.clipboard.writeText(outputText(selectedResult))}
                >
                  复制
                </Button>
              </div>
              <pre>
                {outputText(selectedResult) || selectedResult.error || '网关尚未提供输出。'}
              </pre>
            </div>
          )}
        </Space>
      </div>
    </Modal>
  );
}
