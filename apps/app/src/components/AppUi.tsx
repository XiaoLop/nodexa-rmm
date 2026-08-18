import { Ionicons } from '@expo/vector-icons';
import {
  formatEventMessage,
  getEventTargetName,
  type Device,
  type DeviceGroup,
  type GatewayEvent,
} from '@meshcentral/shared-state';
import { router } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useUiData } from '../features/gateway/useUiData';
import { colors, shadows } from '../theme';

export function platformIcon(platform?: string) {
  const value = platform?.toLowerCase() ?? '';
  if (value.includes('windows')) return 'logo-windows' as const;
  if (value.includes('mac')) return 'logo-apple' as const;
  if (value.includes('ubuntu') || value.includes('linux') || value.includes('raspberry')) return 'logo-tux' as const;
  return 'desktop-outline' as const;
}

export function eventPresentation(event: GatewayEvent | string) {
  const type = typeof event === 'string' ? event : event.type;
  const msg = typeof event === 'string' ? '' : (event.message ?? '');

  if (msg.includes('桌面') || msg.includes('远程桌面')) return { icon: 'desktop-outline' as const, tone: 'primary' as const };
  if (msg.includes('文件') || msg.includes('上传') || msg.includes('下载')) return { icon: 'folder-open-outline' as const, tone: 'info' as const };
  if (msg.includes('终端') || msg.includes('命令')) return { icon: 'terminal-outline' as const, tone: 'warning' as const };
  if (type === 'deviceOnline' || msg.includes('Powered On') || msg.includes('上线')) return { icon: 'arrow-up-circle-outline' as const, tone: 'success' as const };
  if (type === 'deviceOffline' || msg.includes('断开') || msg.includes('离线')) return { icon: 'cloud-offline-outline' as const, tone: 'danger' as const };
  if (type === 'deviceRemoved') return { icon: 'trash-outline' as const, tone: 'danger' as const };
  return { icon: 'sync-circle-outline' as const, tone: 'info' as const };
}

export function AppHeader({
  title,
  subtitle,
  back = false,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable accessibilityLabel="返回" style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function IconTile({
  name,
  tone = 'primary',
  size = 42,
}: {
  name: keyof typeof Ionicons.glyphMap;
  tone?: 'primary' | 'info' | 'success' | 'danger' | 'warning' | 'neutral';
  size?: number;
}) {
  const palette = {
    primary: [colors.primarySoft, colors.primary],
    info: [colors.infoSoft, colors.info],
    success: [colors.successSoft, colors.success],
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
    neutral: [colors.surfaceRaised, colors.muted],
  }[tone];

  return (
    <View
      style={[
        styles.iconTile,
        { width: size, height: size, borderRadius: size / 3, backgroundColor: palette[0] },
      ]}
    >
      <Ionicons name={name} size={size * 0.46} color={palette[1]} />
    </View>
  );
}

export function StatusBadge({ online }: { online: boolean }) {
  return (
    <View style={[styles.badge, online ? styles.onlineBadge : styles.offlineBadge]}>
      <View style={[styles.badgeDot, { backgroundColor: online ? colors.success : colors.subtle }]} />
      <Text style={[styles.badgeText, { color: online ? colors.success : colors.muted }]}>
        {online ? '在线' : '离线'}
      </Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primaryButton, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon ? <Ionicons name={icon} size={19} color="#FFFFFF" /> : null}
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      {icon ? <Ionicons name={icon} size={18} color={colors.primary} /> : null}
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function CompactEventRow({
  event,
  isLast = false,
  devices: devicesProp,
  groups: groupsProp,
}: {
  event: GatewayEvent;
  isLast?: boolean;
  devices?: Device[] | Record<string, Device>;
  groups?: DeviceGroup[] | Record<string, DeviceGroup>;
}) {
  const uiData = useUiData();
  const devices = devicesProp ?? uiData.devices;
  const groups = groupsProp ?? uiData.groups;

  const presentation = eventPresentation(event);
  const timeStr = formatEventFullTime(event.occurredAt);
  const targetDevice = getEventTargetName(event, devices);
  const displayMsg = formatEventMessage(event, devices, groups);

  return (
    <View style={[styles.compactRow, isLast && styles.lastCompactRow]}>
      <IconTile name={presentation.icon} tone={presentation.tone} size={28} />
      <View style={styles.compactContent}>
        <Text style={styles.compactText} numberOfLines={2}>
          <Text style={styles.compactTime}>{timeStr}</Text>
          <Text style={styles.compactSep}> - </Text>
          {event.user ? (
            <>
              <Text style={styles.compactLink}>{event.user}</Text>
              <Text style={styles.compactSep}> → </Text>
            </>
          ) : null}
          {targetDevice ? (
            <>
              <Text style={styles.compactLink}>{targetDevice}</Text>
              <Text style={styles.compactSep}> → </Text>
            </>
          ) : null}
          <Text style={styles.compactMsg}>{displayMsg}</Text>
          {event.ip ? <Text style={styles.compactIp}> ({event.ip})</Text> : null}
        </Text>
      </View>
    </View>
  );
}

function formatEventFullTime(value: string) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '00:00:00';
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

const styles = StyleSheet.create({
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1 },
  headerTitle: { color: colors.text, fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: colors.muted, fontSize: 12, marginTop: 4 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  iconTile: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  onlineBadge: { backgroundColor: colors.successSoft },
  offlineBadge: { backgroundColor: colors.surfaceRaised },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastCompactRow: {
    borderBottomWidth: 0,
  },
  compactContent: {
    flex: 1,
  },
  compactText: {
    lineHeight: 18,
  },
  compactTime: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  compactSep: {
    color: colors.subtle,
    fontSize: 12,
  },
  compactLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  compactMsg: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  compactIp: {
    color: colors.subtle,
    fontSize: 11,
  },
});
