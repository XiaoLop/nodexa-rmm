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
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import type { DeviceGroup } from '@meshcentral/shared-state';
import type { DeviceInviteServerInfo } from '../features/devices/devicePresentation';

export interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  meshId: string;
  meshName: string;
  groups?: DeviceGroup[];
  serverInfo: DeviceInviteServerInfo;
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
  [25, 'Linux ARM-HF, Raspberry Pi'],
  [26, 'Linux ARM64-HF'],
  [28, 'Linux MIPS24KC (OpenWRT)'],
  [30, 'FreeBSD x86-64'],
  [32, 'Linux ARM 64 bit'],
  [36, 'OpenWRT x86-64'],
  [37, 'OpenBSD x86-64'],
  [40, 'Linux MIPSEL24KC (OpenWRT)'],
  [41, 'ARMADA/CORTEX-A53/MUSL (OpenWRT)'],
  [45, 'RISC-V 64-bit'],
  [16, 'Apple macOS x86-64'],
  [29, 'Apple macOS ARM-64'],
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

function agentEndpoint(agentUrl: string, endpoint: string): string {
  const url = new URL(agentUrl);
  url.pathname = url.pathname.replace(/[^/]+$/, endpoint);
  return url.toString();
}

function shellQuote(value: string): string {
  return "'" + value.replaceAll("'", "'\"'\"'") + "'";
}

function unixDownloadCommand(url: string, filename: string, run: (path: string) => string): string {
  const path = './' + filename;
  const source = shellQuote(url);
  return [
    '(',
    '  dir=$(mktemp -d) || exit 1',
    '  trap \'rm -rf -- "$dir"\' EXIT',
    '  cd "$dir" || exit 1',
    '  (curl -fLSs ' + source + ' -o ' + path + ' || wget -O ' + path + ' ' + source + ') &&',
    '  chmod 700 ' + path + ' &&',
    '  if [ "$(id -u)" -eq 0 ]; then ' + run(path) + '; else sudo ' + run(path) + '; fi',
    ')',
  ].join('\n');
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation();
  const [messageApi, contextHolder] = message.useMessage();
  const buttonLabel = label ?? t('common.actions.copy');
  return (
    <>
      {contextHolder}
      <Button
        icon={<CopyOutlined />}
        disabled={!value}
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => messageApi.success(t('common.actions.copied')));
        }}
      >
        {buttonLabel}
      </Button>
    </>
  );
}

function DownloadRow({ label, url }: { label: string; url: string }) {
  const { t } = useTranslation();
  return (
    <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
      <Flex justify="space-between" align="center" gap={12} wrap>
        <Typography.Text strong>{label}</Typography.Text>
        <Space>
          <Button type="primary" icon={<DownloadOutlined />} href={url} target="_blank" rel="noreferrer">
            {t('common.actions.download')}
          </Button>
        </Space>
      </Flex>
    </Card>
  );
}

function CommandView({ command, note }: { command: string; note?: string }) {
  const { t } = useTranslation();
  return (
    <Card size="small" styles={{ body: { padding: '12px 16px' } }}>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <Typography.Text code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {command}
        </Typography.Text>
      </div>
      <Flex
        justify={note ? 'space-between' : 'flex-end'}
        align="center"
        style={{ marginTop: 12 }}
        wrap="wrap"
        gap={8}
      >
        {note ? (
          <div style={{ flex: 1, minWidth: 200 }}>
            <Typography.Text type="secondary">{note}</Typography.Text>
          </div>
        ) : null}
        <CopyButton value={command} label={t('devices.inviteModal.copyCommand')} />
      </Flex>
    </Card>
  );
}

interface ViewProps {
  agentUrl: string;
  scriptBaseUrl: string;
  meshId: string;
  installFlags: number;
  serverInfo: DeviceInviteServerInfo;
  urlKey?: string;
}

function WindowsView({
  agentUrl,
  meshId,
  installFlags,
  urlKey,
  debugMode,
}: ViewProps & { debugMode: boolean }) {
  const { t } = useTranslation();
  const items: ReadonlyArray<readonly [string, number]> = [
    ['Windows x86-32 (.exe)', 3],
    ['Windows x86-64 (.exe)', 4],
    ['Windows ARM-64 (.exe)', 43],
  ];
  const win64Url = buildAgentDownloadUrl(agentUrl, {
    id: 4,
    meshid: meshId,
    installflags: installFlags,
    key: urlKey,
  });
  const psCommand = [
    "$agent = Join-Path ([IO.Path]::GetTempPath()) ('meshagent-' + [guid]::NewGuid() + '.exe')",
    'try {',
    `  Invoke-WebRequest -UseBasicParsing -Uri '${win64Url.replaceAll("'", "''")}' -OutFile $agent -ErrorAction Stop`,
    "  $process = Start-Process -FilePath $agent -ArgumentList '-install' -Wait -PassThru -ErrorAction Stop",
    '  if ($process.ExitCode -ne 0) { throw "Mesh Agent installer exited with code $($process.ExitCode)" }',
    '} finally {',
    '  Remove-Item -LiteralPath $agent -ErrorAction SilentlyContinue',
    '}',
  ].join('\n');

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
      <CommandView
        command={psCommand}
        note={t('devices.inviteModal.powershellDeployNote')}
      />
      {debugMode && (
        <DownloadRow
          label={t('devices.inviteModal.mshFile')}
          url={buildAgentDownloadUrl(agentEndpoint(agentUrl, 'meshsettings'), {
            id: meshId,
            installflags: installFlags,
            key: urlKey,
          })}
        />
      )}
    </Space>
  );
}

function ScriptView({
  agentUrl,
  scriptBaseUrl,
  meshId,
  urlKey,
  uninstall = false,
}: ViewProps & { uninstall?: boolean }) {
  const url = buildAgentDownloadUrl(agentUrl, { script: 1, key: urlKey });
  const args = [uninstall ? 'uninstall' : '', shellQuote(scriptBaseUrl), shellQuote(meshId)]
    .filter(Boolean)
    .join(' ');
  const command = unixDownloadCommand(url, 'meshinstall.sh', (path) => path + ' ' + args);
  return (
    <CommandView
      command={command}
      note={uninstall ? undefined : '* For BSD, run "pkg install wget sudo bash" beforehand.'}
    />
  );
}

function BinaryView({
  agentUrl,
  meshId,
  installFlags,
  urlKey,
  systemType,
}: ViewProps & { systemType: number }) {
  const { t } = useTranslation();
  const url = buildAgentDownloadUrl(agentUrl, {
    id: meshId,
    meshinstall: systemType,
    installflags: installFlags,
    key: urlKey,
  });
  const command = unixDownloadCommand(url, 'meshagent', (path) => path + ' -install');
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <DownloadRow label={t('devices.inviteModal.downloadBinary')} url={url} />
      <CommandView
        command={command}
        note={t('devices.inviteModal.binaryInstallNote')}
      />
    </Space>
  );
}

function MacView({ agentUrl, meshId, installFlags, urlKey }: ViewProps) {
  const { t } = useTranslation();
  const items: ReadonlyArray<readonly [string, number]> = [
    ['macOS x86-64bit', 16],
    ['macOS ARM (64bit)', 29],
    ['macOS (Universal)', 10005],
  ];
  const universalUrl = buildAgentDownloadUrl(agentUrl, {
    id: meshId,
    meshinstall: 10005,
    installflags: installFlags,
    key: urlKey,
  });
  const macCommand = unixDownloadCommand(universalUrl, 'meshagent', (path) => path + ' -install');

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {items.map(([label, id]) => (
        <DownloadRow
          key={id}
          label={label}
          url={buildAgentDownloadUrl(agentEndpoint(agentUrl, 'meshosxagent'), {
            id,
            meshid: meshId,
            installflags: installFlags,
            key: urlKey,
          })}
        />
      ))}
      <CommandView
        command={macCommand}
        note={t('devices.inviteModal.macosTerminalInstallNote')}
      />
      <Typography.Text type="secondary">
        {t('devices.inviteModal.macosPrivacyNote')}
      </Typography.Text>
    </Space>
  );
}

function MacosUninstallView({ agentUrl, meshId, urlKey }: ViewProps) {
  const { t } = useTranslation();
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Paragraph>{t('devices.inviteModal.macosUninstallTip')}</Typography.Paragraph>
      <DownloadRow
        label="macOS (Universal)"
        url={buildAgentDownloadUrl(agentEndpoint(agentUrl, 'meshosxagent'), {
          id: 10005,
          meshid: meshId,
          key: urlKey,
        })}
      />
    </Space>
  );
}

function MobileView({ agentUrl, meshId, serverInfo, urlKey }: ViewProps) {
  const { t } = useTranslation();
  const { magenturl, agentCertHash } = serverInfo;
  const pairing =
    magenturl?.startsWith('mc://') && agentCertHash && meshId
      ? [magenturl, agentCertHash, meshId].join(',')
      : undefined;
  const apk = buildAgentDownloadUrl(agentUrl, { id: 14, key: urlKey });
  return (
    <Flex vertical align="center" gap={16}>
      <Typography.Paragraph>
        {t(
          pairing
            ? 'devices.inviteModal.mobileScanTip'
            : 'devices.inviteModal.mobilePairingUnavailable',
        )}
      </Typography.Paragraph>
      {pairing && <QRCodeSVG value={pairing} size={176} includeMargin />}
      <Space wrap>
        <Button href="https://play.google.com/store/apps/details?id=com.meshcentral.agent2" target="_blank">
          Google Play
        </Button>
        <Button href="https://www.amazon.com/gp/product/B07V9Z4J3C" target="_blank">
          Amazon Appstore
        </Button>
        <Button type="primary" href={apk} target="_blank">
          {t('devices.inviteModal.downloadAndroidApk')}
        </Button>
      </Space>
    </Flex>
  );
}

function AssistantView({
  agentUrl,
  meshId,
  urlKey,
  assistantType,
}: ViewProps & { assistantType: number }) {
  const { t } = useTranslation();
  const url = buildAgentDownloadUrl(agentUrl, {
    id: 10006,
    meshid: meshId,
    ac: assistantType,
    key: urlKey,
  });
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Paragraph>{t('devices.inviteModal.assistantTip')}</Typography.Paragraph>
      <DownloadRow label="Assistant for Windows (.exe)" url={url} />
    </Space>
  );
}

function WindowsUninstallView({ agentUrl, meshId, urlKey }: ViewProps) {
  const { t } = useTranslation();
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Typography.Paragraph>{t('devices.inviteModal.uninstallTip')}</Typography.Paragraph>
      <DownloadRow
        label="Windows x86-64 (.exe)"
        url={buildAgentDownloadUrl(agentUrl, { id: 4, meshid: meshId, key: urlKey })}
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
  const { t } = useTranslation();
  const [os, setOs] = useState(OperatingSystem.Windows);
  const [systemType, setSystemType] = useState(6);
  const [installFlags, setInstallFlags] = useState(0);
  const [assistantType, setAssistantType] = useState(2);
  const [selectedMeshId, setSelectedMeshId] = useState(meshId);
  const agentUrl = new URL(serverInfo.agentUrl);
  const scriptBaseUrl = agentUrl.origin + agentUrl.pathname.replace(/\/meshagents$/, '');
  const agentMeshId = selectedMeshId.startsWith('mesh/')
    ? (selectedMeshId.split('/')[2] ?? '')
    : selectedMeshId;
  const common: ViewProps = {
    agentUrl: agentUrl.toString(),
    scriptBaseUrl,
    meshId: agentMeshId,
    installFlags,
    serverInfo,
    urlKey,
  };

  const installationTypes = useMemo(
    () =>
      [
        [0, t('devices.inviteModal.installModes.both')],
        [2, t('devices.inviteModal.installModes.serviceOnly')],
        [1, t('devices.inviteModal.installModes.interactiveOnly')],
      ] as const,
    [t],
  );

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
      label: t('devices.inviteModal.groupInstall'),
      children: [
        { key: OperatingSystem.Windows.toString(), icon: <WindowsOutlined />, label: 'Windows' },
        { key: OperatingSystem.LinuxBsd.toString(), icon: <CodeOutlined />, label: 'Linux / BSD' },
        {
          key: OperatingSystem.BinaryInstaller.toString(),
          icon: <DesktopOutlined />,
          label: t('devices.inviteModal.binaryInstaller'),
        },
        { key: OperatingSystem.Macos.toString(), icon: <AppleOutlined />, label: 'macOS' },
        ...(isLanMode
          ? []
          : [
              {
                key: OperatingSystem.Mobile.toString(),
                icon: <MobileOutlined />,
                label: t('devices.inviteModal.mobileDevices'),
              },
            ]),
        {
          key: OperatingSystem.Assistant.toString(),
          icon: <AppstoreOutlined />,
          label: 'Mesh Assistant',
        },
      ],
    },
    {
      type: 'group' as const,
      label: t('devices.inviteModal.groupUninstall'),
      children: [
        {
          key: OperatingSystem.WindowsUninstall.toString(),
          icon: <DeleteOutlined />,
          label: 'Windows',
        },
        {
          key: OperatingSystem.LinuxBsdUninstall.toString(),
          icon: <DeleteOutlined />,
          label: 'Linux / BSD',
        },
        {
          key: OperatingSystem.MacosUninstall.toString(),
          icon: <DeleteOutlined />,
          label: 'macOS',
        },
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
  else if (os === OperatingSystem.MacosUninstall) content = <MacosUninstallView {...common} />;
  else content = <ScriptView {...common} uninstall />;

  return (
    <Modal
      title={t('devices.inviteModal.title')}
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
              <Form.Item label={t('devices.inviteModal.deviceGroup')}>
                <Select
                  value={selectedMeshId}
                  onChange={setSelectedMeshId}
                  options={groups.map((group) => ({ value: group.id, label: group.name }))}
                  placeholder={t('devices.inviteModal.groupPlaceholder')}
                />
              </Form.Item>
            )}
            {os === OperatingSystem.BinaryInstaller && (
              <Form.Item label={t('devices.inviteModal.systemArch')}>
                <Select
                  value={systemType}
                  onChange={setSystemType}
                  options={systemTypes.map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>
            )}
            {(os === OperatingSystem.Windows || os === OperatingSystem.BinaryInstaller) && (
              <Form.Item label={t('devices.inviteModal.installMode')}>
                <Select
                  value={installFlags}
                  onChange={setInstallFlags}
                  options={installationTypes.map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>
            )}
            {os === OperatingSystem.Assistant && (
              <Form.Item label={t('devices.inviteModal.connectMode')}>
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
