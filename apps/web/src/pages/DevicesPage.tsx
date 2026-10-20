import {
  EllipsisOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  WindowsOutlined,
  AppleOutlined,
  LinuxOutlined,
  AndroidOutlined,
  QuestionOutlined,
  DesktopOutlined,
  LaptopOutlined,
  MobileOutlined,
  HddOutlined,
  ApiOutlined,
  AppstoreOutlined,
  CodeOutlined,
  RedoOutlined,
  ThunderboltOutlined,
  MoonOutlined,
  PoweroffOutlined,
  ToolOutlined,
  FolderOpenOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import type { BatchDeviceResult } from '@meshcentral/control-client';
import {
  meshCentralControlSelectors,
  useMeshCentralControlStore,
  type Device,
} from '@meshcentral/shared-state';
import {
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  message,
  type TableColumnsType,
  theme,
  Space,
  Tooltip,
} from 'antd';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Key,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMeshCentralControl } from '../features/gateway';
import {
  deviceLocationSearchValues,
  formatDeviceLocation,
} from '../features/device-location/formatDeviceLocation';
import {
  getDeviceCapabilities,
  useApplicationUiCapabilities,
} from '../features/permissions/useUiCapabilities';
import { createCollator, useFormatters } from '../i18n';
import { DeviceEditModal } from '../components/DeviceEditModal';
import { DeviceInviteModal } from '../components/DeviceInviteModal'; // Agent 安装引导弹窗
import { BatchFileUploadModal } from '../components/BatchFileUploadModal';
import { BatchDeviceOperationsModal } from '../components/BatchDeviceOperationsModal';
import { CommandExecutionModal } from '../components/CommandExecutionModal';
import { FilterBar, PageHeader, Panel } from '../components/ui';
import { BatchUploadManager } from '../features/batch-upload/BatchUploadManager';
import { snapshotDevice, type BatchUploadDeviceSnapshot } from '../features/batch-upload/types';
import { useBatchTasks } from '../features/tasks/BatchTaskContext';
import { MESH_CENTRAL_RELAY_URL, MESH_AGENTS_URL } from '../config/gateway';
import { deviceDescription, deviceTags } from '../utils/device';
import '../assets/styles/commands.css';
import '../assets/styles/device-details.css';
import '../assets/styles/devices.css';

type PowerAction = 'wake' | 'reset' | 'poweroff' | 'sleep';

const UNGROUPED_GROUP_ID = '__ungrouped__';

function rawString(device: Device, key: string) {
  const raw = device.raw as Record<string, unknown> | undefined;
  const value = raw?.[key];
  return typeof value === 'string' ? value : undefined;
}

function rawNumber(device: Device, key: string) {
  const raw = device.raw as Record<string, unknown> | undefined;
  const value = raw?.[key];
  return typeof value === 'number' ? value : undefined;
}

function deviceCreationTime(device: Device) {
  return rawNumber(device, 'creation') ?? rawNumber(device, 'firstconnect') ?? 0;
}

function nameCategory(name: string) {
  const firstChar = name.trim().charAt(0);
  if (/^\d$/.test(firstChar)) return 0;
  if (/^[a-z]$/.test(firstChar)) return 1;
  if (/^[A-Z]$/.test(firstChar)) return 3;
  return 2;
}

function osIcon(platform?: string) {
  const value = platform?.toLowerCase() ?? '';
  if (value.includes('windows')) return <WindowsOutlined />;
  if (value.includes('mac') || value.includes('apple') || value.includes('ios'))
    return <AppleOutlined />;
  if (
    value.includes('linux') ||
    value.includes('ubuntu') ||
    value.includes('debian') ||
    value.includes('fedora') ||
    value.includes('centos') ||
    value.includes('red hat') ||
    value.includes('rhel') ||
    value.includes('rocky') ||
    value.includes('alma') ||
    value.includes('opensuse') ||
    value.includes('suse') ||
    value.includes('arch') ||
    value.includes('raspbian')
  ) {
    return <LinuxOutlined />;
  }
  if (value.includes('android')) return <AndroidOutlined />;
  return <QuestionOutlined />;
}

function deviceTypeIcon(icon?: number) {
  switch (icon) {
    case 2:
      return <LaptopOutlined />;
    case 3:
      return <MobileOutlined />;
    case 4:
      return <DesktopOutlined />;
    case 5:
      return <HddOutlined />;
    case 6:
      return <ApiOutlined />;
    case 7:
      return <AppstoreOutlined />;
    case 8:
      return <CodeOutlined />;
    case 1:
    default:
      return <DesktopOutlined />;
  }
}

const meshAgentsUrl = new URL(MESH_AGENTS_URL);
const deviceInviteServerInfo = {
  name: meshAgentsUrl.hostname,
  port: Number(meshAgentsUrl.port) || (meshAgentsUrl.protocol === 'https:' ? 443 : 80),
  https: meshAgentsUrl.protocol === 'https:',
  magenturl: MESH_AGENTS_URL,
};

export function DevicesPage() {
  const { t, i18n } = useTranslation();
  const formatters = useFormatters();
  const { token } = theme.useToken();
  const gateway = useMeshCentralControl();
  const devices = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.devices);
  const groups = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.groups);
  const userInfo = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.userInfo);
  const serverInfo = useMeshCentralControlStore(
    gateway.store,
    meshCentralControlSelectors.serverInfo,
  );
  const status = useMeshCentralControlStore(gateway.store, meshCentralControlSelectors.status);
  const deferredDevices = useDeferredValue(devices, []);
  const { client, refreshSnapshot } = gateway;
  const applicationCapabilities = useApplicationUiCapabilities();
  const batchTasks = useBatchTasks();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('query') ?? '');
  const [groupId, setGroupId] = useState(() => searchParams.get('groupId') ?? '');
  const [online, setOnline] = useState(() => searchParams.get('status') ?? 'all');
  const [platform, setPlatform] = useState(() => searchParams.get('platform') ?? 'all');
  const [currentPage, setCurrentPage] = useState(() => Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(() => Number(searchParams.get('pageSize')) || 20);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Key[]>([]);
  const [batchUploadOpen, setBatchUploadOpen] = useState(false);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const [commandDevices, setCommandDevices] = useState<Device[]>([]);
  const [batchDevices, setBatchDevices] = useState<BatchUploadDeviceSnapshot[]>([]);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const batchUploadManagerRef = useRef<BatchUploadManager | null>(null);
  if (!batchUploadManagerRef.current) batchUploadManagerRef.current = new BatchUploadManager();
  const batchUploadManager = batchUploadManagerRef.current;

  const collator = useMemo(
    () => createCollator(formatters.language, { numeric: true, sensitivity: 'base' }),
    [formatters.language],
  );

  const compareDeviceName = useCallback(
    (a: Device, b: Device) => {
      const categoryDifference = nameCategory(a.name) - nameCategory(b.name);
      return categoryDifference || collator.compare(a.name, b.name);
    },
    [collator],
  );

  const compareNames = useCallback(
    (a: string, b: string) => {
      const categoryDifference = nameCategory(a) - nameCategory(b);
      return categoryDifference || collator.compare(a, b);
    },
    [collator],
  );

  useEffect(() => {
    // React StrictMode 在开发环境会执行一次 setup → cleanup → setup。
    // 重新激活管理器，避免第一次 cleanup 后调度器永久处于 disposed 状态。
    batchUploadManager.activate();
    return () => batchUploadManager.dispose();
  }, [batchUploadManager]);

  useEffect(() => {
    if (status !== 'connected') batchUploadManager.handleGatewayDisconnected();
  }, [batchUploadManager, status]);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => compareNames(a.name, b.name)),
    [compareNames, groups],
  );
  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const deviceCapabilities = useCallback(
    (device: Device) =>
      getDeviceCapabilities(device, status === 'connected', {
        group: groupById.get(device.groupId ?? ''),
        userInfo,
        serverInfo,
      }),
    [groupById, serverInfo, status, userInfo],
  );

  useEffect(() => {
    const next = new URLSearchParams();
    if (query.trim()) next.set('query', query.trim());
    if (groupId) next.set('groupId', groupId);
    if (online !== 'all') next.set('status', online);
    if (platform !== 'all') next.set('platform', platform);
    if (currentPage > 1) next.set('page', String(currentPage));
    if (pageSize !== 20) next.set('pageSize', String(pageSize));
    setSearchParams(next, { replace: true });
  }, [currentPage, groupId, online, pageSize, platform, query, setSearchParams]);

  const updateFilters = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setCurrentPage(1);
  };

  const runPowerAction = useCallback(
    (device: Device, action: PowerAction) => {
      const capabilities = deviceCapabilities(device);
      const permission = action === 'wake' ? capabilities.wake : capabilities.power;
      if (!client || !permission.enabled) {
        void messageApi.error(
          (permission.reason ? t(`deviceWorkspace.tabs.reasons.${permission.reason}`) : undefined) ??
            (action === 'wake'
              ? t('devices.messages.permissionWakeDenied')
              : t('devices.messages.permissionPowerDenied')),
        );
        return;
      }

      const label = t(`devices.powerActions.${action}`);
      modal.confirm({
        title: t('devices.confirm.powerTitle', { action: label }),
        content: t('devices.confirm.powerContent', { name: device.name, action: label }),
        okText: t('devices.confirm.powerOk', { action: label }),
        cancelText: t('common.actions.cancel'),
        okButtonProps: action === 'poweroff' ? { danger: true } : undefined,
        onOk: () => {
          try {
            client.sendPowerAction(device.id, action);
            void messageApi.success(
              t('devices.messages.powerSuccess', { name: device.name, action: label }),
            );
          } catch (error) {
            const detail = error instanceof Error ? error.message : t('common.status.unknown');
            void messageApi.error(t('devices.messages.powerFailed', { action: label, detail }));
          }
        },
      });
    },
    [client, deviceCapabilities, messageApi, modal, t],
  );

  const platforms = useMemo(
    () =>
      [
        ...new Set(
          deferredDevices
            .map((device) => device.platform)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [deferredDevices],
  );

  const filteredDevices = useMemo(() => {
    const sortedDevices = [...deferredDevices].sort(compareDeviceName);
    const normalized = query.trim().toLowerCase();
    if (!normalized && !groupId && online === 'all' && platform === 'all') {
      return sortedDevices;
    }

    return sortedDevices.filter((device) => {
      const matchesQuery =
        !normalized ||
        [
          device.name,
          device.id,
          device.platform,
          device.groupName,
          rawString(device, 'ip'),
          rawString(device, 'host'),
          deviceDescription(device),
          ...deviceTags(device),
          ...deviceLocationSearchValues(device.location),
        ].some((value) => value?.toLowerCase().includes(normalized));
      const matchesGroup =
        !groupId ||
        (groupId === UNGROUPED_GROUP_ID
          ? !device.groupId || !groupById.has(device.groupId)
          : device.groupId === groupId);
      const matchesOnline = online === 'all' || device.online === (online === 'online');
      const matchesPlatform = platform === 'all' || device.platform === platform;
      return matchesQuery && matchesGroup && matchesOnline && matchesPlatform;
    });
  }, [compareDeviceName, deferredDevices, groupById, groupId, online, platform, query]);

  const openDeviceEditor = useCallback(
    (device: Device) => {
      const permission = deviceCapabilities(device).edit;
      if (!permission.enabled) {
        void messageApi.warning((permission.reason ? t(`deviceWorkspace.tabs.reasons.${permission.reason}`) : undefined) ?? t('devices.messages.permissionEditDenied'));
        return;
      }
      setEditingDevice(device);
    },
    [deviceCapabilities, messageApi, t],
  );

  const confirmDeviceDeletion = useCallback(
    (device: Device) => {
      const permission = deviceCapabilities(device).uninstall;
      if (!client || !permission.enabled) {
        void messageApi.warning((permission.reason ? t(`deviceWorkspace.tabs.reasons.${permission.reason}`) : undefined) ?? t('devices.messages.permissionDeleteDenied'));
        return;
      }
      modal.confirm({
        title: t('devices.confirm.deleteTitle'),
        content: (
          <div>
            <p>{t('devices.confirm.deleteContent', { name: device.name })}</p>
            <p>{t('devices.confirm.deleteAgentFirst')}</p>
          </div>
        ),
        okText: t('devices.confirm.deleteOk'),
        cancelText: t('common.actions.cancel'),
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await client.devices.remove(device.id);
            setSelectedDeviceIds((ids) => ids.filter((id) => String(id) !== device.id));
            await refreshSnapshot();
            void messageApi.success(t('devices.messages.deleteSuccess', { name: device.name }));
          } catch (error) {
            const detail = error instanceof Error ? error.message : t('common.status.unknown');
            void messageApi.error(t('devices.messages.deleteFailed', { detail }));
            throw error;
          }
        },
      });
    },
    [client, deviceCapabilities, messageApi, modal, refreshSnapshot, t],
  );

  const confirmAgentUninstall = useCallback(
    (device: Device) => {
      const permission = deviceCapabilities(device).uninstall;
      if (!client || !permission.enabled) {
        void messageApi.warning(
          (permission.reason ? t(`deviceWorkspace.tabs.reasons.${permission.reason}`) : undefined) ??
            t('devices.messages.permissionUninstallDenied'),
        );
        return;
      }
      modal.confirm({
        title: t('devices.confirm.uninstallAgentTitle'),
        content: t('devices.confirm.uninstallAgentContent', { name: device.name }),
        okText: t('devices.confirm.uninstallAgentOk'),
        cancelText: t('common.actions.cancel'),
        okButtonProps: { danger: true },
        onOk: () => {
          try {
            client.devices.uninstallAgent(device.id);
            void messageApi.success(
              t('devices.messages.uninstallAgentSuccess', { name: device.name }),
            );
          } catch (error) {
            const detail = error instanceof Error ? error.message : t('common.status.unknown');
            void messageApi.error(t('devices.messages.uninstallAgentFailed', { detail }));
          }
        },
      });
    },
    [client, deviceCapabilities, messageApi, modal, t],
  );

  const openInviteModal = () => {
    setInviteOpen(true);
  };

  const openBatchUpload = () => {
    const selected = new Set(selectedDeviceIds.map(String));
    const snapshots = devices
      .filter((device) => selected.has(device.id) && deviceCapabilities(device).files.enabled)
      .map(snapshotDevice);
    if (!snapshots.length) return;
    batchUploadManager.reset();
    batchUploadManager.configure(snapshots);
    setBatchDevices(snapshots);
    setBatchUploadOpen(true);
  };

  const selectedDevices = useMemo(() => {
    const selected = new Set(selectedDeviceIds.map(String));
    return devices.filter((device) => selected.has(device.id));
  }, [devices, selectedDeviceIds]);
  const selectedCapabilities = useMemo(
    () =>
      selectedDevices.map((device) => ({
        device,
        capabilities: deviceCapabilities(device),
      })),
    [deviceCapabilities, selectedDevices],
  );
  const commandTargets = useMemo(
    () =>
      selectedCapabilities
        .filter(({ capabilities }) => capabilities.command.enabled)
        .map(({ device }) => device),
    [selectedCapabilities],
  );
  const fileTargets = useMemo(
    () =>
      selectedCapabilities
        .filter(({ capabilities }) => capabilities.files.enabled)
        .map(({ device }) => device),
    [selectedCapabilities],
  );

  const handleBatchOperationCompleted = (successfulDeviceIds: string[]) => {
    const successful = new Set(successfulDeviceIds);
    setSelectedDeviceIds((ids) => ids.filter((id) => !successful.has(String(id))));
    void refreshSnapshot().catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : t('common.status.unknown');
      void messageApi.warning(t('devices.messages.batchSnapshotWarning', { detail }));
    });
  };

  const confirmBatchPowerAction = (action: PowerAction) => {
    if (!client || status !== 'connected' || !selectedDevices.length) return;
    const targets = selectedCapabilities
      .filter(({ capabilities }) =>
        action === 'wake' ? capabilities.wake.enabled : capabilities.power.enabled,
      )
      .map(({ device }) => device);
    const skippedCount = selectedDevices.length - targets.length;
    const label = t(`devices.powerActions.${action}`);
    modal.confirm({
      title: t('devices.confirm.batchPowerTitle', { action: label }),
      content: (
        <div>
          <p>{t('devices.confirm.batchPowerContent', { count: targets.length, action: label })}</p>
          {skippedCount > 0 && (
            <p>{t('devices.confirm.batchPowerSkipped', { count: skippedCount })}</p>
          )}
          <p>{t('devices.confirm.batchPowerNotice')}</p>
        </div>
      ),
      okText: t('devices.confirm.powerOk', { action: label }),
      cancelText: t('common.actions.cancel'),
      okButtonProps: action === 'poweroff' ? { danger: true } : undefined,
      onOk: async () => {
        if (!targets.length) {
          void messageApi.warning(t('devices.messages.batchPowerNoTargets'));
          return;
        }
        const skippedResults: BatchDeviceResult[] = selectedCapabilities
          .filter(({ capabilities }) =>
            action === 'wake' ? !capabilities.wake.enabled : !capabilities.power.enabled,
          )
          .map(({ device, capabilities }) => ({
            deviceId: device.id,
            deviceName: device.name,
            status: 'skipped',
            message: action === 'wake' ? capabilities.wake.message : capabilities.power.message,
          }));
        batchTasks.createPowerTask({
          title: t('devices.confirm.batchPowerTitle', { action: label }),
          devices: targets.map((device) => ({ id: device.id, name: device.name })),
          skippedResults,
          action,
          onSubmitted: handleBatchOperationCompleted,
        });
        void messageApi.success(t('taskCenter.taskCreated'));
      },
    });
  };

  const confirmBatchAgentUninstall = () => {
    if (!client || status !== 'connected' || !selectedDevices.length) return;
    const targets = selectedCapabilities
      .filter(({ capabilities }) => capabilities.uninstall.enabled)
      .map(({ device }) => device);
    const skippedCount = selectedDevices.length - targets.length;
    modal.confirm({
      title: t('devices.confirm.batchUninstallAgentTitle'),
      content: (
        <div>
          <p>{t('devices.confirm.batchUninstallAgentContent', { count: targets.length })}</p>
          {skippedCount > 0 && (
            <p>{t('devices.confirm.batchUninstallAgentSkipped', { count: skippedCount })}</p>
          )}
          <p>{t('devices.confirm.batchUninstallAgentNotice')}</p>
        </div>
      ),
      okText: t('devices.confirm.uninstallAgentOk'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: () => {
        if (!targets.length) {
          void messageApi.warning(t('devices.messages.batchUninstallAgentNoTargets'));
          return;
        }
        try {
          client.devices.uninstallAgents(
            targets.map((device) => ({ id: device.id, name: device.name })),
          );
          const submittedIds = new Set(targets.map((device) => device.id));
          setSelectedDeviceIds((ids) => ids.filter((id) => !submittedIds.has(String(id))));
          void messageApi.success(
            t('devices.messages.batchUninstallAgentSuccess', { count: targets.length }),
          );
        } catch (error) {
          const detail = error instanceof Error ? error.message : t('common.status.unknown');
          void messageApi.error(t('devices.messages.batchUninstallAgentFailed', { detail }));
        }
      },
    });
  };

  const columns = useMemo<TableColumnsType<Device>>(
    () => [
      {
        title: t('devices.columns.type'),
        key: 'type',
        width: 100,
        render: (_, device) => (
          <div
            style={{
              display: 'flex',
              gap: 8,
              fontSize: 18,
              color: device.online ? token.colorPrimary : token.colorTextSecondary,
            }}
          >
            {osIcon(device.platform)}
            {deviceTypeIcon(device.icon)}
          </div>
        ),
      },
      {
        title: t('devices.columns.name'),
        dataIndex: 'name',
        fixed: 'left',
        width: 170,
        sorter: compareDeviceName,
        render: (value, device) => (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button
              type="button"
              className="device-workspace-link"
              onClick={() => navigate(`/devices/${encodeURIComponent(device.id)}/workspace`)}
            >
              {value}
            </button>
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
              {rawString(device, 'rname') || '—'}
            </span>
          </div>
        ),
      },
      {
        title: t('devices.columns.groupName'),
        key: 'groupName',
        width: 130,
        render: (_, device) =>
          groupNameById.get(device.groupId ?? '') ||
          device.groupName ||
          t('common.status.ungrouped'),
      },
      {
        title: t('devices.columns.ip'),
        key: 'ip',
        width: 190,
        render: (_, device) => {
          const location = formatDeviceLocation(
            device.location,
            i18n.resolvedLanguage ?? i18n.language,
          );
          return (
            <div className="device-ip-cell">
              <span>{rawString(device, 'ip') || '-'}</span>
              <Tooltip title={location}>
                <span
                  className="device-location-text"
                  style={{ color: token.colorTextSecondary }}
                >
                  {location ?? '—'}
                </span>
              </Tooltip>
            </div>
          );
        },
      },
      {
        title: t('devices.columns.desc'),
        key: 'desc',
        width: 180,
        render: (_, device) => {
          const desc = deviceDescription(device);
          const tags = deviceTags(device);

          if (!desc && tags.length === 0) {
            return '-';
          }

          return (
            <div className="device-desc-cell">
              {desc ? <span className="device-desc-text">{desc}</span> : null}
              {tags.length > 0 ? (
                <div className="device-tags-list">
                  {tags.map((tag) => (
                    <Tag
                      key={tag}
                      color="blue"
                      bordered={false}
                      className="device-tag-item"
                      title={tag}
                    >
                      {tag}
                    </Tag>
                  ))}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        title: t('devices.columns.status'),
        dataIndex: 'online',
        width: 100,
        filters: [
          { text: t('common.status.online'), value: true },
          { text: t('common.status.offline'), value: false },
        ],
        onFilter: (value, record) => record.online === value,
        render: (value) => (
          <span className={`status-text ${value ? 'online' : 'offline'}`}>
            <i />
            {value ? t('common.status.online') : t('common.status.offline')}
          </span>
        ),
      },
      {
        title: t('devices.columns.lastSeenAt'),
        dataIndex: 'lastSeenAt',
        width: 170,
        render: (value) => (value ? formatters.dateTime(value) : '—'),
        sorter: (a, b) => (a.lastSeenAt || '').localeCompare(b.lastSeenAt || ''),
      },
      {
        title: t('devices.columns.creation'),
        key: 'creation',
        width: 170,
        render: (_, device) => {
          const creation = deviceCreationTime(device);
          if (!creation) return '—';
          return formatters.dateTime(
            new Date(creation < 10000000000 ? creation * 1000 : creation).toISOString(),
          );
        },
        sorter: (a, b) => deviceCreationTime(a) - deviceCreationTime(b),
      },
      {
        title: t('devices.columns.lastbootuptime'),
        key: 'lastbootuptime',
        width: 170,
        render: (_, device) => {
          const bootTime = rawNumber(device, 'lastbootuptime');
          if (!bootTime) return '—';
          return formatters.dateTime(new Date(bootTime).toISOString());
        },
        sorter: (a, b) => {
          const aBoot = rawNumber(a, 'lastbootuptime') || 0;
          const bBoot = rawNumber(b, 'lastbootuptime') || 0;
          return aBoot - bBoot;
        },
      },
      {
        title: t('devices.columns.actions'),
        key: 'actions',
        fixed: 'right',
        width: 160,
        render: (_, device) => {
          const capabilities = deviceCapabilities(device);
          const actionItems = [
            {
              key: 'command',
              icon: <ToolOutlined />,
              label: t('devices.actions.executeCommand'),
              disabled: !capabilities.command.enabled,
              title: capabilities.command.enabled
                ? undefined
                : (capabilities.command.message ?? t('devices.messages.permissionCommandDenied')),
            },
            {
              key: 'edit',
              icon: <EditOutlined />,
              label: t('common.actions.edit'),
              disabled: !capabilities.edit.enabled,
              title: capabilities.edit.enabled
                ? undefined
                : (capabilities.edit.message ?? t('devices.messages.permissionEditDenied')),
            },
            {
              key: 'uninstallAgent',
              icon: <DeleteOutlined />,
              label: t('devices.actions.uninstallAgent'),
              danger: true,
              disabled: !capabilities.uninstall.enabled,
              title: capabilities.uninstall.enabled
                ? undefined
                : (capabilities.uninstall.message ??
                  t('devices.messages.permissionUninstallDenied')),
            },
            {
              key: 'delete',
              icon: <DeleteOutlined />,
              label: t('common.actions.delete'),
              danger: true,
              disabled: !capabilities.uninstall.enabled,
              title: capabilities.uninstall.enabled
                ? undefined
                : (capabilities.uninstall.message ?? t('devices.messages.permissionDeleteDenied')),
            },
            { type: 'divider' as const },
            {
              key: 'wake',
              icon: <ThunderboltOutlined />,
              label: t('devices.powerActions.wake'),
              disabled: !capabilities.wake.enabled,
              title: capabilities.wake.enabled
                ? undefined
                : (capabilities.wake.message ?? t('devices.messages.permissionWakeDenied')),
            },
            ...(['reset', 'sleep', 'poweroff'] as const).map((key) => ({
              key,
              icon:
                key === 'reset' ? (
                  <RedoOutlined />
                ) : key === 'sleep' ? (
                  <MoonOutlined />
                ) : (
                  <PoweroffOutlined />
                ),
              label: t(`devices.powerActions.${key}`),
              danger: key === 'poweroff',
              disabled: !capabilities.power.enabled,
              title: capabilities.power.enabled
                ? undefined
                : (capabilities.power.message ?? t('devices.messages.permissionPowerDenied')),
            })),
          ];
          return (
            <Space size="small">
              <Tooltip
                title={
                  capabilities.files.enabled
                    ? t('devices.actions.fileManagement')
                    : (capabilities.files.message ?? t('devices.messages.permissionFilesDenied'))
                }
              >
                <span>
                  <Button
                    type="text"
                    icon={<FolderOpenOutlined />}
                    disabled={!capabilities.files.enabled}
                    aria-label={t('devices.actions.manageFilesAria', { name: device.name })}
                    onClick={() =>
                      navigate(`/devices/${encodeURIComponent(device.id)}/workspace?tab=files`)
                    }
                  />
                </span>
              </Tooltip>
              <Tooltip title={t('devices.actions.workspace')}>
                <Button
                  type="text"
                  icon={<DesktopOutlined />}
                  aria-label={t('devices.actions.openWorkspaceAria', { name: device.name })}
                  onClick={() => navigate(`/devices/${encodeURIComponent(device.id)}/workspace`)}
                />
              </Tooltip>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: actionItems,
                  onClick: ({ key }) => {
                    if (['wake', 'reset', 'sleep', 'poweroff'].includes(key)) {
                      runPowerAction(device, key as PowerAction);
                    } else if (key === 'edit') {
                      openDeviceEditor(device);
                    } else if (key === 'delete') {
                      confirmDeviceDeletion(device);
                    } else if (key === 'uninstallAgent') {
                      confirmAgentUninstall(device);
                    } else if (key === 'command') {
                      if (!capabilities.command.enabled) {
                        void messageApi.warning(
                          capabilities.command.message ??
                            t('devices.messages.permissionCommandDenied'),
                        );
                        return;
                      }
                      setCommandDevices([device]);
                    }
                  },
                }}
              >
                <Button
                  type="text"
                  icon={<EllipsisOutlined />}
                  aria-label={t('devices.actions.deviceActionAria', { name: device.name })}
                />
              </Dropdown>
            </Space>
          );
        },
      },
    ],
    [
      client,
      compareDeviceName,
      confirmAgentUninstall,
      confirmDeviceDeletion,
      deviceCapabilities,
      formatters,
      groupNameById,
      i18n.language,
      i18n.resolvedLanguage,
      messageApi,
      navigate,
      openDeviceEditor,
      runPowerAction,
      t,
      token.colorPrimary,
      token.colorTextSecondary,
    ],
  );

  const rowSelection = useMemo(
    () => ({
      type: 'checkbox' as const,
      selectedRowKeys: selectedDeviceIds,
      preserveSelectedRowKeys: true,
      onChange: setSelectedDeviceIds,
    }),
    [selectedDeviceIds],
  );

  const pagination = useMemo(
    () => ({
      current: currentPage,
      pageSize,
      total: filteredDevices.length,
      showSizeChanger: true,
      pageSizeOptions: [20, 50, 100],
      showTotal: (total: number) => t('devices.totalCount', { count: total }),
      onChange: (page: number, nextPageSize: number) => {
        setCurrentPage(page);
        if (nextPageSize !== pageSize) setPageSize(nextPageSize);
      },
    }),
    [currentPage, filteredDevices.length, pageSize, t],
  );

  return (
    <>
      {messageContextHolder}
      {modalContextHolder}
      <div className="page-stack devices-page">
        <PageHeader
          title={t('devices.title')}
          description={t('devices.subtitle')}
          actions={
            <Space wrap>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'move', label: t('devices.actions.moveGroup') },
                  {
                    key: 'command',
                    icon: <ToolOutlined />,
                    label: t('devices.actions.executeCommand'),
                    disabled: commandTargets.length === 0,
                  },
                  { type: 'divider' },
                  {
                    key: 'wake',
                    label: t('devices.powerActions.wake'),
                    disabled: !selectedCapabilities.some(
                      ({ capabilities }) => capabilities.wake.enabled,
                    ),
                  },
                  {
                    key: 'reset',
                    label: t('devices.powerActions.reset'),
                    disabled: !selectedCapabilities.some(
                      ({ capabilities }) => capabilities.power.enabled,
                    ),
                  },
                  {
                    key: 'sleep',
                    label: t('devices.powerActions.sleep'),
                    disabled: !selectedCapabilities.some(
                      ({ capabilities }) => capabilities.power.enabled,
                    ),
                  },
                  {
                    key: 'uninstallAgent',
                    icon: <DeleteOutlined />,
                    label: t('devices.actions.uninstallAgent'),
                    danger: true,
                    disabled: !selectedCapabilities.some(
                      ({ capabilities }) => capabilities.uninstall.enabled,
                    ),
                  },
                  {
                    key: 'poweroff',
                    label: t('devices.powerActions.poweroff'),
                    danger: true,
                    disabled: !selectedCapabilities.some(
                      ({ capabilities }) => capabilities.power.enabled,
                    ),
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'move') setBatchMoveOpen(true);
                  else if (key === 'command') setCommandDevices(commandTargets);
                  else if (key === 'uninstallAgent') confirmBatchAgentUninstall();
                  else confirmBatchPowerAction(key as PowerAction);
                },
              }}
            >
              <Button disabled={!client || status !== 'connected' || !selectedDevices.length}>
                {selectedDevices.length
                  ? t('devices.actions.batchOperationsCount', { count: selectedDevices.length })
                  : t('devices.actions.batchOperations')}
              </Button>
            </Dropdown>
            <Button
              icon={<CloudUploadOutlined />}
              disabled={fileTargets.length === 0}
              onClick={openBatchUpload}
            >
              {selectedDeviceIds.length
                ? t('devices.actions.batchUploadCount', { count: selectedDeviceIds.length })
                : t('devices.actions.batchUpload')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={
                !applicationCapabilities.addDevices ||
                !client ||
                status !== 'connected' ||
                !sortedGroups.length
              }
              onClick={openInviteModal}
            >
              {t('devices.actions.addDevice')}
            </Button>
            </Space>
          }
        />
        <Panel className="devices-table-card">
          <FilterBar className="devices-toolbar">
            <Input
              value={query}
              onChange={(event) => updateFilters(setQuery, event.target.value)}
              prefix={<SearchOutlined />}
              placeholder={t('devices.filters.searchPlaceholder')}
              allowClear
            />
            <Select
              value={groupId}
              onChange={(value) => updateFilters(setGroupId, value)}
              options={[
                { value: '', label: t('devices.filters.allGroups') },
                { value: UNGROUPED_GROUP_ID, label: t('devices.filters.ungrouped') },
                ...sortedGroups.map((group) => ({ value: group.id, label: group.name })),
              ]}
            />
            <Select
              value={online}
              onChange={(value) => updateFilters(setOnline, value)}
              options={[
                { value: 'all', label: t('devices.filters.allStatus') },
                { value: 'online', label: t('common.status.online') },
                { value: 'offline', label: t('common.status.offline') },
              ]}
            />
            <Select
              value={platform}
              onChange={(value) => updateFilters(setPlatform, value)}
              options={[
                { value: 'all', label: t('devices.filters.allPlatforms') },
                ...platforms.map((value) => ({ value, label: value })),
              ]}
            />
            <div className="toolbar-spacer" />
            <Tag>
              {t('devices.countTag', {
                filtered: filteredDevices.length,
                total: devices.length,
              })}
            </Tag>
            <Button
              icon={<ReloadOutlined />}
              disabled={status !== 'connected'}
              onClick={() => void refreshSnapshot()}
            >
              {t('common.actions.refresh')}
            </Button>
          </FilterBar>
          <Table
            rowKey="id"
            rowSelection={rowSelection}
            columns={columns}
            dataSource={filteredDevices}
            pagination={pagination}
            scroll={{ x: 1260 }}
            locale={{
              emptyText: (
                <Empty
                  description={
                    devices.length ? t('devices.empty.filtered') : t('devices.empty.waiting')
                  }
                />
              ),
            }}
          />
        </Panel>
      </div>
      {editingDevice && (
        <DeviceEditModal
          device={editingDevice}
          groups={sortedGroups}
          client={client}
          userInfo={userInfo}
          serverInfo={serverInfo}
          onClose={() => setEditingDevice(null)}
          onSaved={refreshSnapshot}
        />
      )}
      {inviteOpen && (
        <DeviceInviteModal
          isOpen
          meshId={sortedGroups[0]?.id ?? ''}
          meshName={sortedGroups[0]?.name ?? t('common.status.defaultGroup')}
          groups={sortedGroups}
          serverInfo={deviceInviteServerInfo}
          onClose={() => setInviteOpen(false)}
        />
      )}
      {batchUploadOpen && (
        <BatchFileUploadModal
          open
          devices={batchDevices}
          meshCentralClient={client}
          baseUrl={MESH_CENTRAL_RELAY_URL}
          connected={status === 'connected'}
          manager={batchUploadManager}
          onClose={() => setBatchUploadOpen(false)}
          onStartTask={(config) => {
            batchTasks.createUploadTask(
              t('devices.actions.batchUploadCount', { count: batchDevices.length }),
              batchDevices,
              config,
            );
            setSelectedDeviceIds([]);
            void messageApi.success(t('taskCenter.taskCreated'));
          }}
        />
      )}
      {batchMoveOpen && (
        <BatchDeviceOperationsModal
          open
          devices={selectedDevices}
          groups={sortedGroups}
          client={client}
          connected={status === 'connected'}
          userInfo={userInfo}
          serverInfo={serverInfo}
          onClose={() => setBatchMoveOpen(false)}
          onCompleted={handleBatchOperationCompleted}
          onSubmitTask={(options) => {
            batchTasks.createMoveTask({
              title: t('batchOperations.moveTitle'),
              devices: options.devices.map((device) => ({ id: device.id, name: device.name })),
              skippedResults: options.skippedResults,
              targetGroupId: options.targetGroupId,
              targetGroupName: options.targetGroupName,
              onSubmitted: handleBatchOperationCompleted,
            });
            void messageApi.success(t('taskCenter.taskCreated'));
          }}
        />
      )}
      {commandDevices.length > 0 && (
        <CommandExecutionModal
          open
          devices={commandDevices}
          client={client}
          connected={status === 'connected'}
          onClose={() => setCommandDevices([])}
          onSubmitTask={(options) => {
            batchTasks.createCommandTask({
              title:
                options.devices.length === 1
                  ? t('commands.titleSingle', { name: options.devices[0]?.name })
                  : t('commands.titleBatch', { count: options.devices.length }),
              ...options,
            });
            setSelectedDeviceIds([]);
            void messageApi.success(t('taskCenter.taskCreated'));
          }}
        />
      )}
    </>
  );
}
