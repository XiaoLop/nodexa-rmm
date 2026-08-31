import { Ionicons } from '@expo/vector-icons';
import { formatEventMessage, type Device } from '@meshcentral/shared-state';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  AppHeader,
  Card,
  IconTile,
  SectionHeader,
  StatusBadge,
  eventPresentation,
  platformIcon,
} from '../../src/components/AppUi';
import { Screen } from '../../src/components/Screen';
import { useUiData } from '../../src/features/gateway/useUiData';
import { colors } from '../../src/theme';

type UnknownRecord = Record<string, unknown>;

const actions = [
  { label: '远程桌面', icon: 'desktop-outline' as const, tone: 'primary' as const },
  { label: '终端', icon: 'terminal-outline' as const, tone: 'info' as const },
  { label: '文件', icon: 'folder-open-outline' as const, tone: 'warning' as const },
  { label: '电源', icon: 'power-outline' as const, tone: 'danger' as const },
];

export function generateStaticParams() {
  return [];
}

export default function DeviceDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const deviceId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { devices, events, groups, status, refreshDevices, sendPowerAction } = useUiData();
  const [refreshing, setRefreshing] = useState(false);
  const device = devices.find((item) => item.id === deviceId);
  const group = groups.find((item) => item.id === device?.groupId);
  const details = useMemo(() => (device ? getDeviceDetails(device) : undefined), [device]);
  const relatedEvents = useMemo(
    () => (device ? events.filter((event) => event.deviceId === device.id).slice(0, 8) : []),
    [device, events],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refreshDevices();
    setTimeout(() => setRefreshing(false), 800);
  }, [refreshDevices]);

  if (!device || !details) {
    return (
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <AppHeader title="设备详情" back />
        <Card style={styles.emptyCard}>
          <IconTile name="desktop-outline" tone="neutral" size={54} />
          <Text style={styles.emptyTitle}>未找到设备</Text>
          <Text style={styles.emptyText}>设备可能已被移除，或设备列表尚未同步完成。</Text>
          <Pressable style={styles.refreshButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={17} color="#FFFFFF" />
            <Text style={styles.refreshButtonText}>重新获取设备</Text>
          </Pressable>
        </Card>
      </Screen>
    );
  }

  const handleActionPress = (label: string) => {
    if (label === '电源') {
      Alert.alert('设备电源管理', `请选择要对「${device.name}」执行的操作：`, [
        { text: '唤醒设备 (WoL)', onPress: () => sendPowerAction(device.id, 'wake') },
        { text: '重启设备', onPress: () => sendPowerAction(device.id, 'reset') },
        { text: '休眠设备', onPress: () => sendPowerAction(device.id, 'sleep') },
        {
          text: '关机',
          style: 'destructive',
          onPress: () => sendPowerAction(device.id, 'poweroff'),
        },
        { text: '取消', style: 'cancel' },
      ]);
      return;
    }

    if (!device.online) {
      Alert.alert('设备当前离线', `${label}需要设备在线后才能使用。`);
      return;
    }
    Alert.alert(label, `${label}会话入口将在后续功能中接入。`);
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <AppHeader
        title="设备详情"
        subtitle={status === 'connected' ? '数据已连接到 MeshCentral' : '连接状态可能不是最新'}
        back
        right={
          <Pressable accessibilityLabel="刷新设备" style={styles.more} onPress={handleRefresh}>
            <Ionicons name="refresh" size={20} color={colors.text} />
          </Pressable>
        }
      />

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={[styles.deviceIcon, !device.online && styles.deviceIconOffline]}>
          <Ionicons name={platformIcon(device.platform)} size={31} color="#FFFFFF" />
        </View>
        <Text style={styles.deviceName}>{device.name}</Text>
        {details.realName && details.realName !== device.name ? (
          <Text style={styles.realName}>{details.realName}</Text>
        ) : null}
        <Text style={styles.deviceGroup}>
          {group?.name ?? device.groupName ?? '未分组'} · {device.platform || '未知系统'}
        </Text>
        <View style={styles.badgeWrap}>
          <StatusBadge online={device.online} />
        </View>
        <View style={styles.heroMetrics}>
          <HeroMetric label="电源状态" value={details.powerStatus} />
          <View style={styles.heroDivider} />
          <HeroMetric label="连接方式" value={details.connectionSummary} />
          <View style={styles.heroDivider} />
          <HeroMetric
            label="最近活动"
            value={formatRelativeTime(device.online ? details.agentConnectedAt : device.lastSeenAt)}
          />
        </View>
      </View>

      <View style={styles.actionGrid}>
        {actions.map((action) => {
          const disabled = !device.online && action.label !== '电源';
          return (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              style={[styles.action, disabled && styles.actionDisabled]}
              onPress={() => handleActionPress(action.label)}
            >
              <IconTile name={action.icon} tone={disabled ? 'neutral' : action.tone} size={46} />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <SectionHeader title="连接与状态" action={<LiveState online={device.online} />} />
        <Card style={styles.statusCard}>
          <View style={styles.statusGrid}>
            <StatusItem
              icon="wifi-outline"
              label="Agent"
              value={details.agentConnected ? '已连接' : '未连接'}
              active={details.agentConnected}
            />
            <StatusItem
              icon="hardware-chip-outline"
              label="Intel AMT"
              value={details.amtConnected ? '已连接' : '未连接'}
              active={details.amtConnected}
            />
            <StatusItem
              icon="cloud-outline"
              label="CIRA"
              value={details.ciraConnected ? '已连接' : '未连接'}
              active={details.ciraConnected}
            />
            <StatusItem
              icon="power-outline"
              label="电源"
              value={details.powerStatus}
              active={details.poweredOn}
            />
          </View>
          <View style={styles.statusFooter}>
            <Ionicons name="time-outline" size={15} color={colors.muted} />
            <Text style={styles.statusFooterText}>
              {device.online
                ? `Agent 连接于 ${formatDateTime(details.agentConnectedAt)}`
                : `最后在线 ${formatDateTime(device.lastSeenAt)}`}
            </Text>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="设备信息" />
        <Card style={styles.infoCard}>
          <InfoRow icon="desktop-outline" label="设备名称" value={device.name} />
          <InfoRow icon="text-outline" label="原始主机名" value={details.realName} />
          <InfoRow icon="server-outline" label="主机地址" value={details.host} />
          <InfoRow icon="globe-outline" label="IP 地址" value={details.ip} />
          <InfoRow icon="logo-windows" label="操作系统" value={device.platform} />
          <InfoRow icon="folder-outline" label="设备组" value={group?.name ?? device.groupName} />
          <InfoRow icon="git-network-outline" label="接入类型" value={details.meshType} last />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Agent 信息" />
        <Card style={styles.infoCard}>
          <InfoRow icon="cube-outline" label="Agent 版本" value={device.agentVersion} />
          <InfoRow icon="code-slash-outline" label="Agent ID" value={details.agentId} />
          <InfoRow icon="layers-outline" label="核心组件" value={details.agentCore} />
          <InfoRow icon="shield-checkmark-outline" label="运行权限" value={details.agentRoot} />
          <InfoRow icon="options-outline" label="能力掩码" value={details.agentCapabilities} />
          <InfoRow
            icon="calendar-outline"
            label="首次连接"
            value={formatDateTime(details.firstConnectedAt)}
          />
          <InfoRow
            icon="timer-outline"
            label="最近启动"
            value={formatDateTime(details.lastBootAt)}
            last
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="用户与安全" />
        <Card style={styles.infoCard}>
          <InfoRow icon="person-outline" label="当前登录用户" value={details.localUsers} />
          <InfoRow icon="shield-outline" label="防病毒" value={details.antiVirus} />
          <InfoRow icon="flame-outline" label="防火墙" value={details.firewall} />
          <InfoRow icon="refresh-circle-outline" label="自动更新" value={details.autoUpdate} last />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="标识信息" />
        <Card style={styles.identifierCard}>
          <IdentifierRow label="Node ID" value={device.id} />
          <IdentifierRow label="Mesh ID" value={device.groupId} last />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="最近事件"
          action={<Text style={styles.eventCount}>{relatedEvents.length} 条</Text>}
        />
        <Card style={styles.eventCard}>
          {relatedEvents.length ? (
            relatedEvents.map((event, index) => {
              const presentation = eventPresentation(event);
              const message = formatEventMessage(event, devices, groups);
              return (
                <View
                  key={event.id}
                  style={[styles.eventRow, index === relatedEvents.length - 1 && styles.lastRow]}
                >
                  <IconTile name={presentation.icon} tone={presentation.tone} size={36} />
                  <View style={styles.eventCopy}>
                    <Text style={styles.eventTitle}>{message}</Text>
                    <Text style={styles.eventMeta}>{formatDateTime(event.occurredAt)}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.noEvents}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
              <Text style={styles.noEventsText}>暂无该设备的最近事件</Text>
            </View>
          )}
        </Card>
      </View>
    </Screen>
  );
}

function getDeviceDetails(device: Device) {
  const raw = isRecord(device.raw) ? device.raw : {};
  const agent = isRecord(raw.agent) ? raw.agent : {};
  const wsc = isRecord(raw.wsc) ? raw.wsc : {};
  const conn = numberValue(raw.conn) ?? (device.online ? 1 : 0);
  const powerCode = numberValue(raw.pwr);
  const localUsers = arrayValue(raw.lusers).length ? arrayValue(raw.lusers) : arrayValue(raw.users);

  const agentConnected = (conn & 1) !== 0;
  const ciraConnected = (conn & 2) !== 0;
  const amtConnected = (conn & 4) !== 0 || (conn & 8) !== 0;
  const connectionNames = [
    agentConnected ? 'Agent' : undefined,
    ciraConnected ? 'CIRA' : undefined,
    amtConnected ? 'AMT' : undefined,
  ].filter(Boolean);

  return {
    realName: stringValue(raw.rname),
    host: stringValue(raw.host),
    ip: stringValue(raw.ip),
    meshType: formatMeshType(numberValue(raw.mtype)),
    powerStatus: formatPowerStatus(powerCode, device.online),
    poweredOn: powerCode === undefined ? device.online : powerCode === 1,
    connectionSummary: connectionNames.join(' + ') || '无连接',
    agentConnected,
    ciraConnected,
    amtConnected,
    agentId: displayValue(agent.id),
    agentCore: stringValue(agent.core),
    agentRoot:
      typeof agent.root === 'boolean' ? (agent.root ? '管理员 / Root' : '普通权限') : undefined,
    agentCapabilities:
      numberValue(agent.caps) === undefined
        ? undefined
        : `0x${numberValue(agent.caps)?.toString(16).toUpperCase()}`,
    firstConnectedAt: timestampValue(raw.firstconnect),
    agentConnectedAt: timestampValue(raw.agct),
    lastBootAt: timestampValue(raw.lastbootuptime),
    localUsers: localUsers.length
      ? localUsers.map(formatUserValue).filter(Boolean).join('、')
      : undefined,
    antiVirus: formatSecurityValue(wsc.antiVirus),
    firewall: formatSecurityValue(wsc.firewall),
    autoUpdate: formatSecurityValue(wsc.autoUpdate),
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value);
  return undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function displayValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return undefined;
}

function timestampValue(value: unknown) {
  if (typeof value === 'string' && value.trim() && Number.isNaN(Number(value))) {
    return Number.isNaN(Date.parse(value)) ? undefined : new Date(value).toISOString();
  }
  const numeric = numberValue(value);
  if (!numeric || numeric <= 0) return undefined;
  return new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric).toISOString();
}

function formatPowerStatus(code: number | undefined, online: boolean) {
  const labels: Record<number, string> = {
    0: '未知',
    1: '开机',
    2: '浅度睡眠',
    3: '睡眠',
    4: '深度睡眠',
    5: '休眠',
    6: '软关机',
    7: '设备存在',
    8: '关机',
  };
  return code === undefined ? (online ? '开机' : '未知') : (labels[code] ?? `状态 ${code}`);
}

function formatMeshType(value: number | undefined) {
  if (value === 1) return 'Intel AMT';
  if (value === 2) return 'Mesh Agent';
  if (value === 3) return 'Agentless / Local';
  return value === undefined ? undefined : `类型 ${value}`;
}

function formatSecurityValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '已启用' : '未启用';
  if (typeof value === 'number') return value > 0 ? '已启用' : '未启用';
  return stringValue(value);
}

function formatUserValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!isRecord(value)) return '';
  return stringValue(value.name) ?? stringValue(value.username) ?? stringValue(value.user) ?? '';
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(value?: string) {
  if (!value) return '未知';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '未知';
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroMetric}>
      <Text numberOfLines={1} style={styles.heroMetricValue}>
        {value}
      </Text>
      <Text style={styles.heroMetricLabel}>{label}</Text>
    </View>
  );
}

function LiveState({ online }: { online: boolean }) {
  return (
    <View style={styles.liveState}>
      <View style={[styles.liveDot, !online && styles.liveDotOffline]} />
      <Text style={styles.liveText}>{online ? '实时在线' : '当前离线'}</Text>
    </View>
  );
}

function StatusItem({
  icon,
  label,
  value,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <View style={styles.statusItem}>
      <View style={[styles.statusIcon, active && styles.statusIconActive]}>
        <Ionicons name={icon} size={19} color={active ? colors.success : colors.muted} />
      </View>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, active && styles.statusValueActive]}>{value}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last && styles.lastRow]}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text selectable numberOfLines={2} style={styles.infoValue}>
        {value || '—'}
      </Text>
    </View>
  );
}

function IdentifierRow({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <View style={[styles.identifierRow, last && styles.lastRow]}>
      <Text style={styles.identifierLabel}>{label}</Text>
      <Text selectable style={styles.identifierValue}>
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  more: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: { minHeight: 300, padding: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 16 },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 7,
  },
  refreshButton: {
    minHeight: 45,
    marginTop: 20,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  refreshButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  hero: {
    borderRadius: 27,
    backgroundColor: colors.navy,
    padding: 22,
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: '#17485A',
    right: -75,
    top: -100,
  },
  deviceIcon: {
    width: 64,
    height: 64,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIconOffline: { backgroundColor: colors.muted },
  deviceName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 13,
    textAlign: 'center',
  },
  realName: { color: '#C0CED7', fontSize: 10, marginTop: 4 },
  deviceGroup: { color: '#9DB2C0', fontSize: 10, marginTop: 6, textAlign: 'center' },
  badgeWrap: { marginTop: 11 },
  heroMetrics: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 17,
    borderTopWidth: 1,
    borderTopColor: '#29485B',
  },
  heroMetric: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  heroMetricValue: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  heroMetricLabel: { color: '#7894A5', fontSize: 9 },
  heroDivider: { width: 1, height: 27, backgroundColor: '#29485B' },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { width: '23%', alignItems: 'center', gap: 8 },
  actionDisabled: { opacity: 0.58 },
  actionLabel: { color: colors.text, fontSize: 10, fontWeight: '700' },
  section: { gap: 12 },
  liveState: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  liveDotOffline: { backgroundColor: colors.subtle },
  liveText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  statusCard: { padding: 15 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusItem: {
    width: '48%',
    minHeight: 92,
    borderRadius: 16,
    padding: 12,
    backgroundColor: colors.background,
  },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIconActive: { backgroundColor: colors.successSoft },
  statusLabel: { color: colors.muted, fontSize: 9, marginTop: 8 },
  statusValue: { color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 2 },
  statusValueActive: { color: colors.success },
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 14,
    paddingTop: 13,
  },
  statusFooterText: { flex: 1, color: colors.muted, fontSize: 10 },
  infoCard: { paddingHorizontal: 15 },
  infoRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { width: 82, color: colors.muted, fontSize: 10 },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 17,
  },
  lastRow: { borderBottomWidth: 0 },
  identifierCard: { paddingHorizontal: 15 },
  identifierRow: {
    minHeight: 67,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  identifierLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  identifierValue: { color: colors.text, fontSize: 10, lineHeight: 16, marginTop: 5 },
  eventCount: { color: colors.subtle, fontSize: 10 },
  eventCard: { paddingHorizontal: 14 },
  eventRow: {
    minHeight: 69,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  eventCopy: { flex: 1 },
  eventTitle: { color: colors.text, fontSize: 11, fontWeight: '700', lineHeight: 17 },
  eventMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  noEvents: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noEventsText: { color: colors.muted, fontSize: 11 },
});
