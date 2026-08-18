import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Card, CompactEventRow } from '../../src/components/AppUi';
import { Screen } from '../../src/components/Screen';
import { useUiData } from '../../src/features/gateway/useUiData';
import { colors } from '../../src/theme';

const filters = ['全部', '上线', '离线', '变更'] as const;

export default function EventsScreen() {
  const { events } = useUiData();
  const [active, setActive] = useState<(typeof filters)[number]>('全部');
  const visible = events.filter(
    (event) =>
      active === '全部' ||
      (active === '上线' && (event.type === 'deviceOnline' || event.message?.includes('上线'))) ||
      (active === '离线' && (event.type === 'deviceOffline' || event.message?.includes('断开'))) ||
      (active === '变更' && event.type === 'deviceChanged' && !event.message?.includes('上线') && !event.message?.includes('断开'))
  );

  return (
    <Screen>
      <AppHeader
        title="审计日志"
        subtitle="实时追踪 MeshCentral 节点与远控操作事件"
        right={
          <Pressable style={styles.calendar}>
            <Ionicons name="calendar-outline" size={20} color={colors.text} />
          </Pressable>
        }
      />
      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>今日事件</Text>
          <Text style={styles.summaryValue}>{events.length}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View>
          <Text style={styles.summaryLabel}>离线/告警</Text>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>
            {events.filter((e) => e.type === 'deviceOffline' || e.message?.includes('断开')).length}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View>
          <Text style={styles.summaryLabel}>模式</Text>
          <Text style={styles.summaryTime}>实时审计</Text>
        </View>
      </View>
      <View style={styles.filters}>
        {filters.map((filter) => (
          <Pressable
            key={filter}
            style={[styles.filter, active === filter && styles.filterActive]}
            onPress={() => setActive(filter)}
          >
            <Text style={[styles.filterText, active === filter && styles.filterTextActive]}>{filter}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.dateRow}>
        <Text style={styles.dateLabel}>日志记录</Text>
        <Text style={styles.dateCount}>{visible.length} 条记录</Text>
      </View>
      <Card style={styles.eventCard}>
        {visible.map((event, index) => (
          <CompactEventRow
            key={event.id}
            event={event}
            isLast={index === visible.length - 1}
          />
        ))}
      </Card>
    </Screen>
  );
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
  eventCard: { paddingHorizontal: 12, paddingVertical: 4 },
});
