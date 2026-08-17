import { StyleSheet, Text, View } from 'react-native';
import type { ConnectionStatus } from '@meshcentral/shared-state';
import { colors } from '../theme';

const labels: Record<ConnectionStatus, string> = {
  idle: '待连接',
  connecting: '连接中',
  connected: '已连接',
  reconnecting: '重连中',
  disconnected: '已断开',
  error: '异常',
};

export function StatusPill({
  status,
  configured,
}: {
  status: ConnectionStatus;
  configured: boolean;
}) {
  const active = status === 'connected';
  return (
    <View style={[styles.pill, active && styles.active]}>
      <View style={[styles.dot, active && styles.activeDot]} />
      <Text style={[styles.text, active && styles.activeText]}>
        {configured ? labels[status] : '未配置'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
  },
  active: { backgroundColor: '#12372f' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.muted },
  activeDot: { backgroundColor: colors.primary },
  text: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  activeText: { color: colors.primary },
});
