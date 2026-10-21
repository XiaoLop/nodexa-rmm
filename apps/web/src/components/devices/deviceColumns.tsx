import {
  AndroidOutlined,
  ApiOutlined,
  AppleOutlined,
  AppstoreOutlined,
  CodeOutlined,
  DeleteOutlined,
  DesktopOutlined,
  EditOutlined,
  EllipsisOutlined,
  FolderOpenOutlined,
  HddOutlined,
  LaptopOutlined,
  LinuxOutlined,
  MobileOutlined,
  MoonOutlined,
  PoweroffOutlined,
  QuestionOutlined,
  RedoOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  WindowsOutlined,
} from '@ant-design/icons';
import type { DeviceUiCapabilities } from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
import { Button, Dropdown, Space, Tag, Tooltip, type TableColumnsType } from 'antd';
import type { TFunction } from 'i18next';
import { formatDeviceLocation } from '../../features/device-location/formatDeviceLocation';
import {
  deviceCreationTime,
  rawNumber,
  rawString,
  type PowerAction,
} from '../../features/devices/devicePresentation';
import { deviceDescription, deviceTags } from '../../utils/device';

function osIcon(platform?: string) {
  const value = platform?.toLowerCase() ?? '';
  if (value.includes('windows')) return <WindowsOutlined />;
  if (value.includes('mac') || value.includes('apple') || value.includes('ios')) {
    return <AppleOutlined />;
  }
  if (/linux|ubuntu|debian|fedora|centos|red hat|rhel|rocky|alma|opensuse|suse|arch|raspbian/.test(value)) {
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

export interface DeviceColumnContext {
  t: TFunction;
  dateTime: (value: Date | number | string) => string;
  language: string;
  colors: {
    primary: string;
    secondary: string;
  };
  groupNameById: ReadonlyMap<string, string>;
  compareDeviceName: (a: Device, b: Device) => number;
  deviceCapabilities: (device: Device) => DeviceUiCapabilities;
  onOpenWorkspace: (device: Device) => void;
  onManageFiles: (device: Device) => void;
  onCommand: (device: Device) => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onUninstall: (device: Device) => void;
  onPowerAction: (device: Device, action: PowerAction) => void;
}

export function createDeviceColumns({
  t,
  dateTime,
  language,
  colors,
  groupNameById,
  compareDeviceName,
  deviceCapabilities,
  onOpenWorkspace,
  onManageFiles,
  onCommand,
  onEdit,
  onDelete,
  onUninstall,
  onPowerAction,
}: DeviceColumnContext): TableColumnsType<Device> {
  return [
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
            color: device.online ? colors.primary : colors.secondary,
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
            onClick={() => onOpenWorkspace(device)}
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
        const location = formatDeviceLocation(device.location, language);
        return (
          <div className="device-ip-cell">
            <span>{rawString(device, 'ip') || '-'}</span>
            <Tooltip title={location}>
              <span className="device-location-text" style={{ color: colors.secondary }}>
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
      render: (value) => (value ? dateTime(value) : '—'),
      sorter: (a, b) => (a.lastSeenAt || '').localeCompare(b.lastSeenAt || ''),
    },
    {
      title: t('devices.columns.creation'),
      key: 'creation',
      width: 170,
      render: (_, device) => {
        const creation = deviceCreationTime(device);
        if (!creation) return '—';
        return dateTime(new Date(creation < 10000000000 ? creation * 1000 : creation).toISOString());
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
        return dateTime(new Date(bootTime).toISOString());
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
                  onClick={() => onManageFiles(device)}
                />
              </span>
            </Tooltip>
            <Tooltip title={t('devices.actions.workspace')}>
              <Button
                type="text"
                icon={<DesktopOutlined />}
                aria-label={t('devices.actions.openWorkspaceAria', { name: device.name })}
                onClick={() => onOpenWorkspace(device)}
              />
            </Tooltip>
            <Dropdown
              trigger={['click']}
              menu={{
                items: actionItems,
                onClick: ({ key }) => {
                  if (['wake', 'reset', 'sleep', 'poweroff'].includes(key)) {
                    onPowerAction(device, key as PowerAction);
                  } else if (key === 'edit') {
                    onEdit(device);
                  } else if (key === 'delete') {
                    onDelete(device);
                  } else if (key === 'uninstallAgent') {
                    onUninstall(device);
                  } else if (key === 'command') {
                    onCommand(device);
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
  ];
}
