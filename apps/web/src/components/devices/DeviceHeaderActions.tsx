import {
  CloudUploadOutlined,
  DeleteOutlined,
  PlusOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { MeshCentralClient } from '@meshcentral/control-client';
import { Button, Dropdown, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import type { PowerAction } from '../../features/devices/devicePresentation';

interface DeviceHeaderActionsProps {
  client?: MeshCentralClient;
  connected: boolean;
  addDevicesEnabled: boolean;
  groupsAvailable: boolean;
  selectedDeviceCount: number;
  selectedDeviceIdCount: number;
  fileTargetCount: number;
  canCommand: boolean;
  canWake: boolean;
  canPower: boolean;
  canUninstall: boolean;
  onMove: () => void;
  onCommand: () => void;
  onPowerAction: (action: PowerAction) => void;
  onUninstallAgents: () => void;
  onBatchUpload: () => void;
  onAddDevice: () => void;
}

export function DeviceHeaderActions({
  client,
  connected,
  addDevicesEnabled,
  groupsAvailable,
  selectedDeviceCount,
  selectedDeviceIdCount,
  fileTargetCount,
  canCommand,
  canWake,
  canPower,
  canUninstall,
  onMove,
  onCommand,
  onPowerAction,
  onUninstallAgents,
  onBatchUpload,
  onAddDevice,
}: DeviceHeaderActionsProps) {
  const { t } = useTranslation();

  return (
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
              disabled: !canCommand,
            },
            { type: 'divider' },
            {
              key: 'wake',
              label: t('devices.powerActions.wake'),
              disabled: !canWake,
            },
            {
              key: 'reset',
              label: t('devices.powerActions.reset'),
              disabled: !canPower,
            },
            {
              key: 'sleep',
              label: t('devices.powerActions.sleep'),
              disabled: !canPower,
            },
            {
              key: 'uninstallAgent',
              icon: <DeleteOutlined />,
              label: t('devices.actions.uninstallAgent'),
              danger: true,
              disabled: !canUninstall,
            },
            {
              key: 'poweroff',
              label: t('devices.powerActions.poweroff'),
              danger: true,
              disabled: !canPower,
            },
          ],
          onClick: ({ key }) => {
            if (key === 'move') onMove();
            else if (key === 'command') onCommand();
            else if (key === 'uninstallAgent') onUninstallAgents();
            else onPowerAction(key as PowerAction);
          },
        }}
      >
        <Button disabled={!client || !connected || !selectedDeviceCount}>
          {selectedDeviceCount
            ? t('devices.actions.batchOperationsCount', { count: selectedDeviceCount })
            : t('devices.actions.batchOperations')}
        </Button>
      </Dropdown>
      <Button
        icon={<CloudUploadOutlined />}
        disabled={fileTargetCount === 0}
        onClick={onBatchUpload}
      >
        {selectedDeviceIdCount
          ? t('devices.actions.batchUploadCount', { count: selectedDeviceIdCount })
          : t('devices.actions.batchUpload')}
      </Button>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        disabled={!addDevicesEnabled || !client || !connected || !groupsAvailable}
        onClick={onAddDevice}
      >
        {t('devices.actions.addDevice')}
      </Button>
    </Space>
  );
}
