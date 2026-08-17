import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Card, IconTile } from '../../src/components/AppUi';
import { Screen } from '../../src/components/Screen';
import { eventPresentation } from '../../src/demoData';
import { useUiData } from '../../src/features/gateway/useUiData';
import { colors } from '../../src/theme';

const filters = ['全部', '上线', '离线', '变更'] as const;

export default function EventsScreen() {
  const { events } = useUiData();
  const [active, setActive] = useState<(typeof filters)[number]>('全部');
  const visible = events.filter((event) => active === '全部' || (active === '上线' && event.type === 'deviceOnline') || (active === '离线' && event.type === 'deviceOffline') || (active === '变更' && event.type === 'deviceChanged'));

  return (
    <Screen>
      <AppHeader
        title="事件"
        subtitle="实时追踪 MeshCentral 节点动态"
        right={<Pressable style={styles.calendar}><Ionicons name="calendar-outline" size={20} color={colors.text} /></Pressable>}
      />
      <View style={styles.summary}>
        <View><Text style={styles.summaryLabel}>今日事件</Text><Text style={styles.summaryValue}>24</Text></View>
        <View style={styles.summaryDivider} />
        <View><Text style={styles.summaryLabel}>需要关注</Text><Text style={[styles.summaryValue, { color: colors.danger }]}>2</Text></View>
        <View style={styles.summaryDivider} />
        <View><Text style={styles.summaryLabel}>最后更新</Text><Text style={styles.summaryTime}>13:36</Text></View>
      </View>
      <View style={styles.filters}>
        {filters.map((filter) => (
          <Pressable key={filter} style={[styles.filter, active === filter && styles.filterActive]} onPress={() => setActive(filter)}>
            <Text style={[styles.filterText, active === filter && styles.filterTextActive]}>{filter}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.dateRow}><Text style={styles.dateLabel}>今天 · 8月17日</Text><Text style={styles.dateCount}>{visible.length} 条</Text></View>
      <Card style={styles.eventCard}>
        {visible.map((event, index) => {
          const presentation = eventPresentation(event.type);
          const date = new Date(event.occurredAt);
          return (
            <View key={event.id} style={[styles.eventRow, index === visible.length - 1 && styles.lastRow]}>
              <View style={styles.timeline}>
                <IconTile name={presentation.icon} tone={presentation.tone} size={40} />
                {index !== visible.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <View style={styles.eventBody}>
                <View style={styles.eventTop}><Text style={styles.eventTitle}>{event.message}</Text><Text style={styles.eventTime}>{String(date.getHours()).padStart(2, '0')}:{String(date.getMinutes()).padStart(2, '0')}</Text></View>
                <Text style={styles.eventDescription}>{descriptionFor(event.type)}</Text>
                <View style={styles.eventSource}><Ionicons name="hardware-chip-outline" size={12} color={colors.muted} /><Text style={styles.eventSourceText}>{event.deviceId}</Text></View>
              </View>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

function descriptionFor(type: string) {
  if (type === 'deviceOnline') return 'Agent 与网关握手成功，设备可执行远程操作';
  if (type === 'deviceOffline') return '心跳超时，远程会话当前不可用';
  return '节点清单或配置信息发生变化';
}

const styles = StyleSheet.create({
  calendar: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  summary: { backgroundColor: colors.navy, borderRadius: 22, minHeight: 98, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { color: '#8FA7B8', fontSize: 10 },
  summaryValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 5 },
  summaryTime: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginTop: 8 },
  summaryDivider: { width: 1, height: 38, backgroundColor: '#29465A' },
  filters: { flexDirection: 'row', gap: 8 },
  filter: { flex: 1, height: 38, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  dateCount: { color: colors.subtle, fontSize: 11 },
  eventCard: { paddingHorizontal: 15 },
  eventRow: { minHeight: 112, flexDirection: 'row', gap: 12, paddingTop: 15 },
  lastRow: { paddingBottom: 15 },
  timeline: { alignItems: 'center' },
  timelineLine: { flex: 1, width: 1, backgroundColor: colors.border, marginTop: 7 },
  eventBody: { flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: 14 },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  eventTitle: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '800' },
  eventTime: { color: colors.subtle, fontSize: 10 },
  eventDescription: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 6 },
  eventSource: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  eventSourceText: { color: colors.subtle, fontSize: 9 },
});
