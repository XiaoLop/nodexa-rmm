import {
  CopyOutlined,
  DownloadOutlined,
  WindowsOutlined,
  AppleOutlined,
  MobileOutlined,
  CodeOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import { Button, Card, Flex, Modal, Select, Space, Typography, message, Menu, Form } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { DeviceGroup } from '@meshcentral/shared-state';

export interface ServerInfo {
  name: string;
  port: number;
  https: boolean;
  magenturl?: string;
  agentCertHash?: string;
  tlshash?: string;
}

export interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  meshId: string;
  meshName: string;
  groups?: DeviceGroup[];
  serverInfo: ServerInfo;
  isLanMode?: boolean;
  urlKey?: string;
  debugMode?: boolean;
}

enum OperatingSystem {
  Windows,
  LinuxBsd,
  Macos,
  WindowsUninstall,
  LinuxBsdUninstall,
  BinaryInstaller,
  Mobile,
  Assistant,
  MacosUninstall,
}

const systemTypes = [
  [6, 'Linux x86-64'],
  [5, 'Linux x86-32'],
  [10005, 'Apple OSX Universal'],
  [25, 'Linux ARM-HF, Rasberry Pi'],
  [26, 'Linux ARM64-HF'],
  [28, 'Linux MIPS24KC (OpenWRT)'],
  [30, 'FreeBSD x86-64'],
  [32, 'Linux ARM 64 bit'],
  [36, 'OpenWRT x86-64'],
  [37, 'OpenBSD x86-64'],
  [40, 'Linux MIPSEL24KC (OpenWRT)'],
  [41, 'ARMADA/CORTEX-A53/MUSL (OpenWRT)'],
  [45, 'RISC-V x86-64'],
  [16, 'Apple macOS x86-64'],
  [29, 'Apple macOS ARM-64'],
] as const;

const installationTypes = [
  [0, '后台服务与交互模式'],
  [2, '仅后台服务'],
  [1, '仅交互模式'],
] as const;

const assistantTypes = [
  [2, 'Application, Connect on user request'],
  [3, 'Application, Always connected'],
  [0, 'System Tray, Connect on user request'],
  [1, 'System Tray, Always connected'],
  [4, 'System Tray, Monitor only'],
] as const;

export function buildAgentDownloadUrl(
  baseUrl: string,
  params: Record<string, string | number | undefined>,
): string {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function getOrigin(info: ServerInfo): string {
  const protocol = info.https ? 'https' : 'http';
  const defaultPort = info.https ? 443 : 80;
  return `${protocol}://${info.name}${info.port === defaultPort ? '' : `:${info.port}`}`;
}

function cleanMeshId(meshId: string): string {
  return meshId.replace(/^mesh\/\//, '');
}

function CopyButton({ value, label = '复制' }: { value: string; label?: string }) {
  const [messageApi, contextHolder] = message.useMessage();
  return (
    <>
      {contextHolder}
      <Button
        icon={<CopyOutlined />}
        disabled={!value}
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => messageApi.success('已复制'));
        }}
      >
        {label}
      </Button>
    </>
  );
}

function DownloadRow({ label, url }: { label: string; url: string }) {
  return (
    <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
      <Flex justify="space-between" align="center" gap={12} wrap>
        <Typography.Text strong>{label}</Typography.Text>
        <Space>
          <Button type="primary" icon={<DownloadOutlined />} href={url} target="_blank" rel="noreferrer">
            下载
          </Button>
        </Space>
      </Flex>
    </Card>
  );
}

function CommandView({ command, note }: { command: string; note?: string }) {
  return (
    <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
      <Flex justify="space-between" align="flex-start" gap={16}>
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <Typography.Text code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {command}
          </Typography.Text>
        </div>
        <CopyButton value={command} label="复制命令" />
      </Flex>
      {note && (
        <div style={{ marginTop: 12 }}>
          <Typography.Text type="secondary">{note}</Typography.Text>
        </div>
      )}
    </Card>
  );
}

interface ViewProps {
  agentUrl: string;
  origin: string;
  meshId: string;
  installFlags: number;
  serverInfo: ServerInfo;
  urlKey?: string;
}

function WindowsView({ agentUrl, meshId, installFlags, urlKey, debugMode }: ViewProps & { debugMode: boolean }) {
  const items: ReadonlyArray<readonly [string, number]> = [
    ['Windows x86-32 (.exe)', 3],
    ['Windows x86-64 (.exe)', 4],
    ['Windows ARM-64 (.exe)', 43],
  ];
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {items.map(([label, id]) => (
        <DownloadRow
          key={id}
          label={label}
          url={buildAgentDownloadUrl(agentUrl, {
            id,
            meshid: meshId,
            installflags: installFlags,
            key: urlKey,
          })}
        />
      ))}
      {debugMode && (
        <DownloadRow
          label="Mesh Agent 设置文件 (.msh)"
          url={buildAgentDownloadUrl(agentUrl, { meshid: meshId, key: urlKey })}
        />
      )}
    </Space>
  );
}

function ScriptView({ agentUrl, origin, meshId, urlKey, uninstall = false }: ViewProps & { uninstall?: boolean }) {
  const url = buildAgentDownloadUrl(agentUrl, { script: 1, key: urlKey });
  const command = uninstall
    ? `wget "${url}" -O ./meshinstall.sh && chmod 755 ./meshinstall.sh && sudo -E ./meshinstall.sh uninstall`
    : `wget "${url}" -O ./meshinstall.sh && chmod 755 ./meshinstall.sh && sudo -E ./meshinstall.sh ${origin} '${meshId}'`;
  return <CommandView command={command} note={uninstall ? undefined : '* For BSD, run "pkg install wget sudo bash" beforehand.'} />;
}

function BinaryView({ agentUrl, meshId, installFlags, urlKey, systemType }: ViewProps & { systemType: number }) {
  const url = buildAgentDownloadUrl(agentUrl, {
    id: systemType,
    meshid: meshId,
    installflags: installFlags,
    key: urlKey,
  });
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DownloadRow label="下载预配置二进制安装包" url={url} />
      <CommandView
        command={`wget "${url}" -O ./meshagent && chmod 755 ./meshagent`}
        note="下载后请按目标系统要求将 Agent 注册为服务或前台运行。"
      />
    </Space>
  );
}

function MacView({ agentUrl, meshId, installFlags, urlKey }: ViewProps) {
  const items: ReadonlyArray<readonly [string, number]> = [
    ['macOS x86-64bit', 16],
    ['macOS ARM (64bit)', 29],
    ['macOS (Universal)', 10005],
  ];
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {items.map(([label, id]) => (
        <DownloadRow
          key={id}
          label={label}
          url={buildAgentDownloadUrl(agentUrl, {
            id,
            meshid: meshId,
            installflags: installFlags,
            key: urlKey,
          })}
        />
      ))}
      <Typography.Text type="secondary">
        安装后请按需授予辅助功能、屏幕录制等 macOS 隐私权限。
      </Typography.Text>
    </Space>
  );
}

function MobileView({ agentUrl, meshId, serverInfo, urlKey }: ViewProps) {
  const pairing = `${serverInfo.magenturl ?? getOrigin(serverInfo)},${serverInfo.agentCertHash ?? serverInfo.tlshash ?? ''},${meshId}`;
  const apk = buildAgentDownloadUrl(agentUrl, { id: 14, meshid: meshId, key: urlKey });
  return (
    <Flex vertical align="center" gap={16}>
      <Typography.Paragraph>使用 MeshCentral Android 客户端扫描二维码配对。</Typography.Paragraph>
      <QRCodeSVG value={pairing} size={176} includeMargin />
      <Space wrap>
        <Button href="https://play.google.com/store/apps/details?id=com.meshcentral.agent2" target="_blank">
          Google Play
        </Button>
        <Button href="https://www.amazon.com/gp/product/B07V9Z4J3C" target="_blank">
          Amazon Appstore
        </Button>
        <Button type="primary" href={apk} target="_blank">
          下载 Android APK
        </Button>
      </Space>
    </Flex>
  );
}

function AssistantView({ agentUrl, meshId, urlKey, assistantType }: ViewProps & { assistantType: number }) {
  const url = buildAgentDownloadUrl(agentUrl, {
    id: 10003,
    meshid: meshId,
    installflags: assistantType,
    key: urlKey,
  });
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Paragraph>MeshCentral Assistant 是按需连接的用户会话应用。</Typography.Paragraph>
      <DownloadRow label="Assistant for Windows (.exe)" url={url} />
    </Space>
  );
}

function WindowsUninstallView({ agentUrl, meshId, urlKey }: ViewProps) {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Paragraph>下载并以管理员身份运行卸载程序。</Typography.Paragraph>
      <DownloadRow
        label="Windows Agent Uninstaller (.exe)"
        url={buildAgentDownloadUrl(agentUrl, { id: 4, meshid: meshId, uninstall: 1, key: urlKey })}
      />
    </Space>
  );
}

export function DeviceInviteModal({
  isOpen,
  onClose,
  meshId,
  groups = [],
  serverInfo,
  isLanMode = false,
  urlKey,
  debugMode = false,
}: AddAgentModalProps) {
  const [os, setOs] = useState(OperatingSystem.Windows);
  const [systemType, setSystemType] = useState(6);
  const [installFlags, setInstallFlags] = useState(0);
  const [assistantType, setAssistantType] = useState(2);
  const [selectedMeshId, setSelectedMeshId] = useState(meshId);
  const origin = useMemo(() => getOrigin(serverInfo), [serverInfo]);
  const agentMeshId = cleanMeshId(selectedMeshId);
  const common: ViewProps = {
    agentUrl: `${origin}/meshagents`,
    origin,
    meshId: agentMeshId,
    installFlags,
    serverInfo,
    urlKey,
  };

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMeshId(meshId);
    setOs(OperatingSystem.Windows);
    setSystemType(6);
    setInstallFlags(0);
    setAssistantType(2);
  }, [isOpen, meshId]);

  const menuItems = [
    {
      type: 'group' as const,
      label: '安装 Agent',
      children: [
        { key: OperatingSystem.Windows.toString(), icon: <WindowsOutlined />, label: 'Windows' },
        { key: OperatingSystem.LinuxBsd.toString(), icon: <CodeOutlined />, label: 'Linux / BSD' },
        { key: OperatingSystem.BinaryInstaller.toString(), icon: <DesktopOutlined />, label: '二进制安装包' },
        { key: OperatingSystem.Macos.toString(), icon: <AppleOutlined />, label: 'macOS' },
        ...(isLanMode ? [] : [{ key: OperatingSystem.Mobile.toString(), icon: <MobileOutlined />, label: '移动设备' }]),
        { key: OperatingSystem.Assistant.toString(), icon: <AppstoreOutlined />, label: 'Mesh Assistant' },
      ],
    },
    {
      type: 'group' as const,
      label: '卸载 Agent',
      children: [
        { key: OperatingSystem.WindowsUninstall.toString(), icon: <DeleteOutlined />, label: 'Windows' },
        { key: OperatingSystem.LinuxBsdUninstall.toString(), icon: <DeleteOutlined />, label: 'Linux / BSD' },
        { key: OperatingSystem.MacosUninstall.toString(), icon: <DeleteOutlined />, label: 'macOS' },
      ],
    },
  ];

  let content: React.ReactNode;
  if (os === OperatingSystem.Windows) content = <WindowsView {...common} debugMode={debugMode} />;
  else if (os === OperatingSystem.LinuxBsd) content = <ScriptView {...common} />;
  else if (os === OperatingSystem.BinaryInstaller)
    content = <BinaryView {...common} systemType={systemType} />;
  else if (os === OperatingSystem.Macos) content = <MacView {...common} />;
  else if (os === OperatingSystem.Mobile) content = <MobileView {...common} />;
  else if (os === OperatingSystem.Assistant)
    content = <AssistantView {...common} assistantType={assistantType} />;
  else if (os === OperatingSystem.WindowsUninstall) content = <WindowsUninstallView {...common} />;
  else content = <ScriptView {...common} uninstall />;

  return (
    <Modal
      title="添加设备 (Mesh Agent)"
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={860}
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ display: 'flex', minHeight: 500 }}>
        <div style={{ width: 240, borderRight: '1px solid #f0f0f0', padding: '16px 0' }}>
          <Menu
            mode="inline"
            selectedKeys={[os.toString()]}
            onClick={(e) => setOs(Number(e.key))}
            items={menuItems}
            style={{ borderRight: 'none' }}
          />
        </div>
        <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', maxHeight: '70vh' }}>
          <Form layout="vertical">
            {groups.length > 0 && (
              <Form.Item label="设备分组">
                <Select
                  value={selectedMeshId}
                  onChange={setSelectedMeshId}
                  options={groups.map((group) => ({ value: group.id, label: group.name }))}
                  placeholder="选择设备分组"
                />
              </Form.Item>
            )}
            {os === OperatingSystem.BinaryInstaller && (
              <Form.Item label="系统架构">
                <Select
                  value={systemType}
                  onChange={setSystemType}
                  options={systemTypes.map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>
            )}
            {(os === OperatingSystem.Windows || os === OperatingSystem.BinaryInstaller) && (
              <Form.Item label="安装模式">
                <Select
                  value={installFlags}
                  onChange={setInstallFlags}
                  options={installationTypes.map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>
            )}
            {os === OperatingSystem.Assistant && (
              <Form.Item label="连接模式">
                <Select
                  value={assistantType}
                  onChange={setAssistantType}
                  options={assistantTypes.map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>
            )}
          </Form>
          
          <div style={{ marginTop: 24 }}>
            {content}
          </div>
        </div>
      </div>
    </Modal>
  );
}
