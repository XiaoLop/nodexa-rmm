import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Card, IconTile, SectionHeader, StatusBadge } from '../../src/components/AppUi';
import { Screen } from '../../src/components/Screen';
import { demoDevices, eventPresentation, platformIcon } from '../../src/demoData';
import { useUiData } from '../../src/features/gateway/useUiData';
import { colors } from '../../src/theme';

export function generateStaticParams() {
  return demoDevices.map((device) => ({ id: device.id }));
}

const actions = [
  { label: '远程桌面', icon: 'scan-outline' as const, tone: 'primary' as const },
  { label: '终端', icon: 'terminal-outline' as const, tone: 'info' as const },
  { label: '文件', icon: 'folder-open-outline' as const, tone: 'warning' as const },
  { label: '电源', icon: 'power-outline' as const, tone: 'danger' as const },
];

export default function DeviceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { devices, events, sendPowerAction } = useUiData();
  const device = devices.find((item) => item.id === id) ?? devices[0];
  if (!device) return null;
  const relatedEvents = events.filter((event) => event.deviceId === device.id).slice(0, 5);

  const handleActionPress = (label: string) => {
    if (label === '电源') {
      Alert.alert(
        '设备电源管理',
        `请选择要对 [${device.name}] 执行的操作：`,
        [
          { text: '重启设备', onPress: () => sendPowerAction(device.id, 'reset') },
          { text: '唤醒设备 (WoL)', onPress: () => sendPowerAction(device.id, 'wake') },
          { text: '关机', style: 'destructive', onPress: () => sendPowerAction(device.id, 'poweroff') },
          { text: '取消', style: 'cancel' },
        ],
      );
    }
  };

  return (
    <Screen>
      <AppHeader title="设备详情" back right={<Pressable style={styles.more}><Ionicons name="ellipsis-horizontal" size={21} color={colors.text} /></Pressable>} />
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.deviceIcon}><Ionicons name={platformIcon(device.platform)} size={31} color="#FFFFFF" /></View>
        <Text style={styles.deviceName}>{device.name}</Text>
        <Text style={styles.deviceGroup}>{device.groupName} · {device.platform}</Text>
        <View style={styles.badgeWrap}><StatusBadge online={device.online} /></View>
        <View style={styles.heroMetrics}>
          <HeroMetric label="CPU" value="18%" />
          <View style={styles.heroDivider} />
          <HeroMetric label="内存" value="4.2 GB" />
          <View style={styles.heroDivider} />
          <HeroMetric label="延迟" value="42 ms" />
        </View>
      </View>

      <View style={styles.actionGrid}>
        {actions.map((action) => (
          <Pressable key={action.label} style={styles.action} onPress={() => handleActionPress(action.label)}>
            <IconTile name={action.icon} tone={action.tone} size={44} />
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title="设备信息" action={<Pressable><Text style={styles.link}>完整清单</Text></Pressable>} />
        <Card style={styles.infoCard}>
          <InfoRow icon="hardware-chip-outline" label="Agent 版本" value={device.agentVersion || '0.9.6'} />
          <InfoRow icon="globe-outline" label="公网 IP" value="118.25.61.104" />
          <InfoRow icon="git-network-outline" label="局域网 IP" value="10.20.4.18" />
          <InfoRow icon="time-outline" label="最近心跳" value="刚刚" last />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="性能概览" action={<Text style={styles.updated}>过去 15 分钟</Text>} />
        <Card style={styles.performanceCard}>
          <View style={styles.performanceTop}><View><Text style={styles.performanceLabel}>CPU 使用率</Text><Text style={styles.performanceValue}>18<Text style={styles.performanceUnit}>%</Text></Text></View><View style={styles.legend}><View style={styles.legendDot} /><Text style={styles.legendText}>正常</Text></View></View>
          <View style={styles.chart}>{[28, 39, 32, 48, 44, 63, 51, 46, 56, 40, 35, 42, 31, 27, 33, 29].map((height, index) => <View key={index} style={[styles.bar, { height }]} />)}</View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="最近事件" />
        <Card style={styles.eventCard}>{relatedEvents.map((event, index) => { const presentation = eventPresentation(event.type); return <View key={event.id} style={[styles.eventRow, index === relatedEvents.length - 1 && styles.lastRow]}><IconTile name={presentation.icon} tone={presentation.tone} size={36} /><View style={styles.eventCopy}><Text style={styles.eventTitle}>{event.message}</Text><Text style={styles.eventMeta}>今天 · {new Date(event.occurredAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text></View></View>; })}</Card>
      </View>
    </Screen>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) { return <View style={styles.heroMetric}><Text style={styles.heroMetricValue}>{value}</Text><Text style={styles.heroMetricLabel}>{label}</Text></View>; }
function InfoRow({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) { return <View style={[styles.infoRow, last && styles.lastRow]}><Ionicons name={icon} size={17} color={colors.primary} /><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  more: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 27, backgroundColor: colors.navy, padding: 22, alignItems: 'center', overflow: 'hidden' },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#17485A', right: -70, top: -90 },
  deviceIcon: { width: 64, height: 64, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  deviceName: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 13 },
  deviceGroup: { color: '#9DB2C0', fontSize: 10, marginTop: 6 },
  badgeWrap: { marginTop: 11 },
  heroMetrics: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 20, paddingTop: 17, borderTopWidth: 1, borderTopColor: '#29485B' },
  heroMetric: { alignItems: 'center', gap: 4 },
  heroMetricValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  heroMetricLabel: { color: '#7894A5', fontSize: 9 },
  heroDivider: { width: 1, height: 27, backgroundColor: '#29485B' },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { width: '23%', alignItems: 'center', gap: 8 },
  actionLabel: { color: colors.text, fontSize: 10, fontWeight: '700' },
  section: { gap: 12 },
  link: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  infoCard: { paddingHorizontal: 15 },
  infoRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoLabel: { flex: 1, color: colors.muted, fontSize: 11 },
  infoValue: { color: colors.text, fontSize: 11, fontWeight: '700' },
  lastRow: { borderBottomWidth: 0 },
  updated: { color: colors.subtle, fontSize: 10 },
  performanceCard: { padding: 17 },
  performanceTop: { flexDirection: 'row', justifyContent: 'space-between' },
  performanceLabel: { color: colors.muted, fontSize: 10 },
  performanceValue: { color: colors.text, fontSize: 29, fontWeight: '800', marginTop: 5 },
  performanceUnit: { color: colors.muted, fontSize: 12 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  legendText: { color: colors.success, fontSize: 10, fontWeight: '700' },
  chart: { height: 70, flexDirection: 'row', alignItems: 'flex-end', gap: 5, marginTop: 12 },
  bar: { flex: 1, borderRadius: 4, backgroundColor: colors.primarySoft, borderTopWidth: 3, borderTopColor: colors.primary },
  eventCard: { paddingHorizontal: 14 },
  eventRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  eventCopy: { flex: 1 },
  eventTitle: { color: colors.text, fontSize: 11, fontWeight: '700' },
  eventMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
});
