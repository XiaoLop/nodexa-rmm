import { ConsoleTable } from '../ui';
import type { DeviceUiCapabilities } from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
import { Empty, theme, type TablePaginationConfig } from 'antd';
import { useMemo, type Key } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '../../i18n';
import type { PowerAction } from '../../features/devices/devicePresentation';
import { createDeviceColumns } from './deviceColumns';

interface DeviceTableProps {
  devices: Device[];
  totalDeviceCount: number;
  groupNameById: ReadonlyMap<string, string>;
  compareDeviceName: (a: Device, b: Device) => number;
  deviceCapabilities: (device: Device) => DeviceUiCapabilities;
  selectedDeviceIds: Key[];
  onSelectionChange: (keys: Key[]) => void;
  pagination: TablePaginationConfig;
  onOpenWorkspace: (device: Device) => void;
  onManageFiles: (device: Device) => void;
  onCommand: (device: Device) => void;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onUninstall: (device: Device) => void;
  onPowerAction: (device: Device, action: PowerAction) => void;
}

export function DeviceTable({
  devices,
  totalDeviceCount,
  groupNameById,
  compareDeviceName,
  deviceCapabilities,
  selectedDeviceIds,
  onSelectionChange,
  pagination,
  onOpenWorkspace,
  onManageFiles,
  onCommand,
  onEdit,
  onDelete,
  onUninstall,
  onPowerAction,
}: DeviceTableProps) {
  const { t, i18n } = useTranslation();
  const formatters = useFormatters();
  const { token } = theme.useToken();

  const columns = useMemo(
    () =>
      createDeviceColumns({
        t,
        dateTime: formatters.dateTime,
        language: i18n.resolvedLanguage ?? i18n.language,
        colors: {
          primary: token.colorPrimary,
          secondary: token.colorTextSecondary,
        },
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
      }),
    [
      compareDeviceName,
      deviceCapabilities,
      formatters.dateTime,
      groupNameById,
      i18n.language,
      i18n.resolvedLanguage,
      onCommand,
      onDelete,
      onEdit,
      onManageFiles,
      onOpenWorkspace,
      onPowerAction,
      onUninstall,
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
      onChange: (keys: Key[]) => onSelectionChange(keys),
    }),
    [onSelectionChange, selectedDeviceIds],
  );

  return (
    <ConsoleTable
      rowKey="id"
      rowSelection={rowSelection}
      columns={columns}
      dataSource={devices}
      pagination={pagination}
      scroll={{ x: 1260 }}
      locale={{
        emptyText: (
          <Empty
            description={
              totalDeviceCount ? t('devices.empty.filtered') : t('devices.empty.waiting')
            }
          />
        ),
      }}
    />
  );
}
