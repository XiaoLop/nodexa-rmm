import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { DeviceGroup } from '@meshcentral/shared-state';
import { Button, Input, Select, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { UNGROUPED_GROUP_ID } from '../../features/devices/devicePresentation';
import { FilterBar } from '../ui';

interface DeviceToolbarProps {
  query: string;
  groupId: string;
  online: string;
  platform: string;
  groups: DeviceGroup[];
  platforms: string[];
  filteredCount: number;
  totalCount: number;
  connected: boolean;
  onQueryChange: (value: string) => void;
  onGroupChange: (value: string) => void;
  onOnlineChange: (value: string) => void;
  onPlatformChange: (value: string) => void;
  onRefresh: () => void;
}

export function DeviceToolbar({
  query,
  groupId,
  online,
  platform,
  groups,
  platforms,
  filteredCount,
  totalCount,
  connected,
  onQueryChange,
  onGroupChange,
  onOnlineChange,
  onPlatformChange,
  onRefresh,
}: DeviceToolbarProps) {
  const { t } = useTranslation();

  return (
    <FilterBar className="devices-toolbar">
      <Input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        prefix={<SearchOutlined />}
        placeholder={t('devices.filters.searchPlaceholder')}
        allowClear
      />
      <Select
        value={groupId}
        onChange={onGroupChange}
        options={[
          { value: '', label: t('devices.filters.allGroups') },
          { value: UNGROUPED_GROUP_ID, label: t('devices.filters.ungrouped') },
          ...groups.map((group) => ({ value: group.id, label: group.name })),
        ]}
      />
      <Select
        value={online}
        onChange={onOnlineChange}
        options={[
          { value: 'all', label: t('devices.filters.allStatus') },
          { value: 'online', label: t('common.status.online') },
          { value: 'offline', label: t('common.status.offline') },
        ]}
      />
      <Select
        value={platform}
        onChange={onPlatformChange}
        options={[
          { value: 'all', label: t('devices.filters.allPlatforms') },
          ...platforms.map((value) => ({ value, label: value })),
        ]}
      />
      <div className="toolbar-spacer" />
      <Tag>
        {t('devices.countTag', {
          filtered: filteredCount,
          total: totalCount,
        })}
      </Tag>
      <Button icon={<ReloadOutlined />} disabled={!connected} onClick={onRefresh}>
        {t('common.actions.refresh')}
      </Button>
    </FilterBar>
  );
}
