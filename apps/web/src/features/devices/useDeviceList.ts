import type { DeviceUiCapabilities } from '@meshcentral/control-client';
import {
  meshCentralControlSelectors,
  useMeshCentralControlStore,
  type Device,
} from '@meshcentral/shared-state';
import type { TablePaginationConfig } from 'antd';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type Key,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { createCollator, useFormatters } from '../../i18n';
import { useMeshCentralControl } from '../gateway';
import { getDeviceCapabilities } from '../permissions/useUiCapabilities';
import {
  matchesDeviceFilters,
  nameCategory,
} from './devicePresentation';

export interface SelectedDeviceCapability {
  device: Device;
  capabilities: DeviceUiCapabilities;
}

export function useDeviceList() {
  const formatters = useFormatters();
  const { t } = useTranslation();
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

  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get('query') ?? '');
  const [groupId, setGroupId] = useState(() => searchParams.get('groupId') ?? '');
  const [online, setOnline] = useState(() => searchParams.get('status') ?? 'all');
  const [platform, setPlatform] = useState(() => searchParams.get('platform') ?? 'all');
  const [currentPage, setCurrentPage] = useState(() => Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(() => Number(searchParams.get('pageSize')) || 20);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Key[]>([]);

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
    const next = new URLSearchParams();
    if (query.trim()) next.set('query', query.trim());
    if (groupId) next.set('groupId', groupId);
    if (online !== 'all') next.set('status', online);
    if (platform !== 'all') next.set('platform', platform);
    if (currentPage > 1) next.set('page', String(currentPage));
    if (pageSize !== 20) next.set('pageSize', String(pageSize));
    setSearchParams(next, { replace: true });
  }, [currentPage, groupId, online, pageSize, platform, query, setSearchParams]);

  const updateFilters = useCallback(<T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  const updateQuery = useCallback(
    (value: string) => updateFilters(setQuery, value),
    [updateFilters],
  );
  const updateGroupId = useCallback(
    (value: string) => updateFilters(setGroupId, value),
    [updateFilters],
  );
  const updateOnline = useCallback(
    (value: string) => updateFilters(setOnline, value),
    [updateFilters],
  );
  const updatePlatform = useCallback(
    (value: string) => updateFilters(setPlatform, value),
    [updateFilters],
  );

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

    return sortedDevices.filter((device) =>
      matchesDeviceFilters(device, { query, groupId, online, platform }, groupById),
    );
  }, [compareDeviceName, deferredDevices, groupById, groupId, online, platform, query]);

  const selectedDevices = useMemo(() => {
    const selected = new Set(selectedDeviceIds.map(String));
    return devices.filter((device) => selected.has(device.id));
  }, [devices, selectedDeviceIds]);
  const selectedCapabilities = useMemo<SelectedDeviceCapability[]>(
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

  const selectDeviceIds = useCallback((ids: Key[]) => setSelectedDeviceIds(ids), []);
  const clearSelection = useCallback(() => setSelectedDeviceIds([]), []);
  const removeSelectedDeviceIds = useCallback((deviceIds: Iterable<string>) => {
    const removed = new Set(deviceIds);
    setSelectedDeviceIds((ids) => ids.filter((id) => !removed.has(String(id))));
  }, []);

  const pagination = useMemo<TablePaginationConfig>(
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

  return {
    data: {
      devices,
      userInfo,
      serverInfo,
      status,
      client,
      sortedGroups,
      groupNameById,
      platforms,
      filteredDevices,
      selectedDevices,
      selectedCapabilities,
      commandTargets,
      fileTargets,
      refreshSnapshot,
    },
    filters: {
      query,
      groupId,
      online,
      platform,
      currentPage,
      pageSize,
      setQuery: updateQuery,
      setGroupId: updateGroupId,
      setOnline: updateOnline,
      setPlatform: updatePlatform,
      setCurrentPage,
      setPageSize,
    },
    selection: {
      selectedDeviceIds,
      setSelectedDeviceIds: selectDeviceIds,
      clearSelection,
      removeSelectedDeviceIds,
    },
    capabilities: deviceCapabilities,
    compareDeviceName,
    pagination,
  };
}
