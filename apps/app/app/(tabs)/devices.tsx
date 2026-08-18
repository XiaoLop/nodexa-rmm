import { Ionicons } from '@expo/vector-icons';
import type { Device, DeviceGroup } from '@meshcentral/shared-state';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Card, IconTile, StatusBadge, platformIcon } from '../../src/components/AppUi';
import { Screen } from '../../src/components/Screen';
import { useUiData } from '../../src/features/gateway/useUiData';
import { colors } from '../../src/theme';

export default function DevicesScreen() {
  const { devices, groups, refreshDevices } = useUiData();
  const [filter, setFilter] = useState<'全部' | '在线' | '离线'>('全部');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refreshDevices();
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, [refreshDevices]);

  const filtered = devices.filter((device) => {
    const matchesFilter = filter === '全部' || (filter === '在线' ? device.online : !device.online);
    const matchesQuery = `${device.name} ${device.platform} ${device.groupName}`.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      <AppHeader
        title="设备"
        subtitle={`${devices.filter((device) => device.online).length} 台在线 · ${groups.length} 个设备组`}
        right={
          <Pressable style={styles.add} onPress={() => router.push('/add-device')}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        }
      />

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索设备名称、系统或分组"
            placeholderTextColor={colors.subtle}
            style={styles.searchInput}
          />
        </View>
        <Pressable style={styles.filterButton}><Ionicons name="options-outline" size={21} color={colors.text} /></Pressable>
      </View>

      <View style={styles.chips}>
        {(['全部', '在线', '离线'] as const).map((item) => (
          <Pressable key={item} style={[styles.chip, filter === item && styles.chipActive]} onPress={() => setFilter(item)}>
            <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>{item}</Text>
            <Text style={[styles.chipCount, filter === item && styles.chipCountActive]}>
              {item === '全部' ? devices.length : devices.filter((device) => device.online === (item === '在线')).length}
            </Text>
          </Pressable>
        ))}
      </View>

      {groups.map((group) => {
        const groupDevices = filtered.filter((device) => device.groupId === group.id);
        if (!groupDevices.length) return null;
        return <DeviceGroupBlock key={group.id} group={group} devices={groupDevices} />;
      })}
    </Screen>
  );
}

function DeviceGroupBlock({ group, devices }: { group: DeviceGroup; devices: Device[] }) {
  return (
    <View style={styles.groupBlock}>
      <View style={styles.groupHeader}>
        <View style={styles.groupTitleRow}>
          <Ionicons name="folder-open" size={18} color={colors.primary} />
          <Text style={styles.groupTitle}>{group.name}</Text>
          <View style={styles.groupCount}><Text style={styles.groupCountText}>{devices.length}</Text></View>
        </View>
        <Pressable><Ionicons name="ellipsis-horizontal" size={21} color={colors.muted} /></Pressable>
      </View>
      <Card style={styles.deviceCard}>
        {devices.map((device, index) => (
          <Pressable
            key={device.id}
            style={[styles.deviceRow, index === devices.length - 1 && styles.lastRow]}
            onPress={() => router.push({ pathname: '/device/[id]', params: { id: device.id } })}
          >
            <IconTile name={platformIcon(device.platform)} tone={device.online ? 'primary' : 'neutral'} size={46} />
            <View style={styles.deviceBody}>
              <View style={styles.deviceNameRow}>
                <Text numberOfLines={1} style={styles.deviceName}>{device.name}</Text>
                <StatusBadge online={device.online} />
              </View>
              <Text style={styles.deviceMeta}>{device.platform || '未知系统'} · Agent {device.agentVersion || '—'}</Text>
              <View style={styles.lastSeenRow}>
                <Ionicons name="radio-outline" size={12} color={colors.subtle} />
                <Text style={styles.lastSeen}>{device.online ? '刚刚活跃' : '最后在线 6 小时前'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
          </Pressable>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  add: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchBox: { flex: 1, minHeight: 49, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, color: colors.text, fontSize: 13 },
  filterButton: { width: 49, height: 49, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 9 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 7 },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  chipCount: { color: colors.subtle, fontSize: 10, fontWeight: '800' },
  chipCountActive: { color: '#8FB0BF' },
  groupBlock: { gap: 11 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  groupTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  groupCount: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 7, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  groupCountText: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  deviceCard: { paddingHorizontal: 14 },
  deviceRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lastRow: { borderBottomWidth: 0 },
  deviceBody: { flex: 1, gap: 4 },
  deviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  deviceName: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  deviceMeta: { color: colors.muted, fontSize: 10 },
  lastSeenRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastSeen: { color: colors.subtle, fontSize: 9 },
});
