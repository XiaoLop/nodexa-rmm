import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, CompactEventRow, IconTile, SectionHeader } from '../../src/components/AppUi';
import { Screen } from '../../src/components/Screen';
import { useUiData } from '../../src/features/gateway/useUiData';
import { colors } from '../../src/theme';

const quickActions = [
  { label: '创建设备组', icon: 'layers-outline' as const, tone: 'primary' as const, route: '/group-editor' },
  { label: '批量传文件', icon: 'cloud-upload-outline' as const, tone: 'info' as const, route: '/batch-operations?mode=file' },
  { label: '批量执行', icon: 'terminal-outline' as const, tone: 'warning' as const, route: '/batch-operations' },
  { label: '添加设备', icon: 'add-circle-outline' as const, tone: 'success' as const, route: '/add-device' },
];

export default function DashboardScreen() {
  const { devices, groups, events, status, currentUser } = useUiData();
  const online = devices.filter((device) => device.online).length;
  const onlineRate = devices.length > 0 ? Math.round((online / devices.length) * 100) : 0;

  return (
    <Screen>
      <View style={styles.topbar}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{currentUser.avatarText}</Text>
            <View style={[styles.avatarOnline, status !== 'connected' && styles.avatarOffline]} />
          </View>
          <View>
            <Text style={styles.greeting}>{currentUser.greeting}</Text>
            <View style={styles.connectionRow}>
              <View style={[styles.connectionDot, status !== 'connected' && styles.connectionDotConnecting]} />
              <Text style={styles.connectionText}>
                {status === 'connected' ? '网关已连接' : '正在连接网关...'}
              </Text>
            </View>
          </View>
        </View>
        <Pressable style={styles.notification}>
          <Ionicons name="notifications-outline" size={21} color={colors.text} />
          <View style={styles.notificationDot} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroOrbLarge} />
        <View style={styles.heroOrbSmall} />
        <Text style={styles.heroEyebrow}>MESH OVERVIEW</Text>
        <Text style={styles.heroTitle}>
          {status === 'connected' ? '设备实时监控中' : '网关同步中'}
        </Text>
        <Text style={styles.heroCopy}>
          {status === 'connected'
            ? `已同步 ${devices.length} 台设备与 ${groups.length} 个分组`
            : '正在建立 WebSocket 控制通道...'}
        </Text>
        <View style={styles.heroFooter}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{onlineRate}%</Text>
            <Text style={styles.heroMetricLabel}>在线率</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{status === 'connected' ? '38 ms' : '--'}</Text>
            <Text style={styles.heroMetricLabel}>网关延迟</Text>
          </View>
          <Pressable style={styles.heroAction} onPress={() => router.push('/devices')}>
            <Text style={styles.heroActionText}>查看设备</Text>
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeader title="快捷操作" />
        <View style={styles.quickGrid}>
          {quickActions.map((action) => (
            <Pressable key={action.label} style={styles.quickAction} onPress={() => router.push(action.route as never)}>
              <IconTile name={action.icon} tone={action.tone} size={44} />
              <Text style={styles.quickLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeader title="运行数据" action={<Text style={styles.updated}>刚刚更新</Text>} />
        <View style={styles.metricGrid}>
          <Metric label="设备组" value={groups.length} icon="layers" tone="primary" />
          <Metric label="设备总数" value={devices.length} icon="desktop" tone="info" />
          <Metric label="在线设备" value={online} icon="checkmark-circle" tone="success" />
          <Metric label="离线设备" value={devices.length - online} icon="cloud-offline" tone="danger" />
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeader title="最近事件" action={<Pressable onPress={() => router.push('/events')}><Text style={styles.link}>查看全部</Text></Pressable>} />
        <Card style={styles.eventsCard}>
          {events.slice(0, 5).map((event, index) => (
            <CompactEventRow key={event.id} event={event} isLast={index === 4 || index === Math.min(events.length, 5) - 1} />
          ))}
        </Card>
      </View>
    </Screen>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap; tone: 'primary' | 'info' | 'success' | 'danger' }) {
  return (
    <Card style={styles.metricCard}>
      <View style={styles.metricTop}><IconTile name={icon} tone={tone} size={36} /><Text style={styles.metricTrend}>↗ 2.4%</Text></View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  avatarOnline: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.background },
  avatarOffline: { backgroundColor: colors.subtle },
  greeting: { color: colors.text, fontSize: 17, fontWeight: '800' },
  connectionRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  connectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  connectionDotConnecting: { backgroundColor: colors.warning },
  connectionText: { color: colors.muted, fontSize: 11 },
  notification: { width: 43, height: 43, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', right: 10, top: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: colors.surface },
  hero: { minHeight: 212, padding: 22, borderRadius: 28, backgroundColor: colors.navy, overflow: 'hidden' },
  heroOrbLarge: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#17465A', right: -58, top: -66 },
  heroOrbSmall: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, opacity: 0.24, right: 28, bottom: -32 },
  heroEyebrow: { color: '#7FD6CB', fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', marginTop: 12, letterSpacing: -0.5 },
  heroCopy: { color: '#AFC2D0', fontSize: 12, marginTop: 7 },
  heroFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: 17, marginTop: 27 },
  heroMetric: { gap: 2 },
  heroMetricValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  heroMetricLabel: { color: '#93AABB', fontSize: 10 },
  heroDivider: { width: 1, height: 33, backgroundColor: '#315064' },
  heroAction: { marginLeft: 'auto', backgroundColor: colors.primary, borderRadius: 13, paddingHorizontal: 14, height: 39, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroActionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  sectionBlock: { gap: 13 },
  quickGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  quickAction: { width: '23%', alignItems: 'center', gap: 8 },
  quickLabel: { color: colors.text, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  updated: { color: colors.subtle, fontSize: 11 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 11, justifyContent: 'space-between' },
  metricCard: { width: '47.8%', padding: 15, minHeight: 133 },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricTrend: { color: colors.success, fontSize: 9, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 27, fontWeight: '800', marginTop: 10 },
  metricLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  link: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  eventsCard: { paddingHorizontal: 15 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lastRow: { borderBottomWidth: 0 },
  eventCopy: { flex: 1 },
  eventTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  eventMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
});
