import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Card, IconTile } from '../../src/components/AppUi';
import { Screen } from '../../src/components/Screen';
import { useUiData } from '../../src/features/gateway/useUiData';
import { colors } from '../../src/theme';

function formatDateTime(value?: string) {
  if (!value) return '暂无记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无记录';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export default function AccountScreen() {
  const { currentUser, groups, status, logout } = useUiData();
  const [loggingOut, setLoggingOut] = useState(false);
  const role = currentUser.siteadmin ? '系统管理员' : '普通用户';
  const accountName = currentUser.username || currentUser.id?.split('/').filter(Boolean).at(-1) || '未知账户';
  const connectionLabel = status === 'connected' ? '已连接' : status === 'connecting' || status === 'reconnecting' ? '连接中' : '未连接';
  const connected = status === 'connected';
  const menuItems = [
    { label: '登录账户', value: accountName, icon: 'person-outline' as const, tone: 'primary' as const },
    { label: '电子邮箱', value: currentUser.email || '未设置', icon: 'mail-outline' as const, tone: 'info' as const },
    { label: '账户创建时间', value: formatDateTime(currentUser.creationAt), icon: 'calendar-outline' as const, tone: 'warning' as const },
    { label: '上次登录时间', value: formatDateTime(currentUser.previousLoginAt || currentUser.lastLoginAt), icon: 'time-outline' as const, tone: 'success' as const },
  ];

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Screen>
      <AppHeader title="我的账户" right={<Pressable style={styles.settings}><Ionicons name="settings-outline" size={20} color={colors.text} /></Pressable>} />
      <View style={styles.profileCard}>
        <View style={styles.profilePattern} />
        <View style={styles.profileTop}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{currentUser.avatarText}</Text></View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{currentUser.displayName}</Text>
            <Text style={styles.role}>{role} · {accountName}</Text>
            {currentUser.email ? <Text style={styles.profileEmail}>{currentUser.email}</Text> : null}
          </View>
          <View style={styles.verified}><Ionicons name="shield-checkmark" size={18} color="#FFFFFF" /></View>
        </View>
        <View style={styles.profileStats}>
          <View style={styles.statItem}><Text style={styles.statValue}>{role}</Text><Text style={styles.statLabel}>账户角色</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statValue}>{groups.length} 个</Text><Text style={styles.statLabel}>授权设备组</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}><Text style={styles.statValue}>{currentUser.language?.toUpperCase() || '默认'}</Text><Text style={styles.statLabel}>账户语言</Text></View>
        </View>
      </View>

      <Card style={styles.gatewayCard}>
        <View style={styles.gatewayTop}>
          <IconTile name="git-network-outline" tone={connected ? 'success' : 'neutral'} size={44} />
          <View style={styles.gatewayCopy}><Text style={styles.gatewayTitle}>MeshCentral 网关</Text></View>
          <View style={[styles.connected, !connected && styles.disconnected]}><View style={[styles.connectedDot, !connected && styles.disconnectedDot]} /><Text style={[styles.connectedText, !connected && styles.disconnectedText]}>{connectionLabel}</Text></View>
        </View>
        <View style={styles.gatewayFooter}><Text style={styles.gatewayFootText}>安全 WebSocket</Text><Text style={styles.gatewayFootText}>{groups.length} 个设备组</Text><Text style={styles.gatewayFootText}>{role}</Text></View>
      </Card>

      <View style={styles.section}><Text style={styles.sectionTitle}>账户与偏好</Text>
        <Card style={styles.menuCard}>{menuItems.map((item, index) => (
          <Pressable key={item.label} style={[styles.menuRow, index === menuItems.length - 1 && styles.lastRow]}>
            <IconTile name={item.icon} tone={item.tone} size={38} />
            <View style={styles.menuCopy}><Text style={styles.menuLabel}>{item.label}</Text><Text style={styles.menuValue}>{item.value}</Text></View>
            <Ionicons name="chevron-forward" size={17} color={colors.subtle} />
          </Pressable>
        ))}</Card>
      </View>

      <Card style={styles.securityCard}><IconTile name="key-outline" tone="success" size={42} /><View style={styles.biometricCopy}><Text style={styles.biometricTitle}>认证状态</Text><Text style={styles.biometricMeta}>退出后将清除本机保存的登录凭据和当前会话</Text></View><Ionicons name="checkmark-circle" size={22} color={colors.success} /></Card>
      <Pressable style={[styles.logout, loggingOut && styles.logoutDisabled]} onPress={handleLogout} disabled={loggingOut}><Ionicons name="log-out-outline" size={19} color={colors.danger} /><Text style={styles.logoutText}>{loggingOut ? '正在安全退出...' : '退出当前账户'}</Text></Pressable>
      <Text style={styles.version}>Mesh Console 0.1.0 · Powered by MeshCentral</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  settings: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  profileCard: { borderRadius: 26, backgroundColor: colors.navy, padding: 20, overflow: 'hidden' },
  profilePattern: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#17465A', right: -70, top: -95 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 19, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  profileCopy: { flex: 1 },
  name: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  role: { color: '#9EB3C1', fontSize: 10, marginTop: 5 },
  profileEmail: { color: '#7F99AA', fontSize: 9, marginTop: 4 },
  verified: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#25465A', alignItems: 'center', justifyContent: 'center' },
  profileStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#29465A' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  statLabel: { color: '#7F99AA', fontSize: 9, marginTop: 4 },
  statDivider: { width: 1, height: 28, backgroundColor: '#29465A' },
  gatewayCard: { padding: 15 },
  gatewayTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  gatewayCopy: { flex: 1 },
  gatewayTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  gatewayMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  connected: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.successSoft, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  connectedText: { color: colors.success, fontSize: 9, fontWeight: '800' },
  disconnected: { backgroundColor: colors.surfaceRaised },
  disconnectedDot: { backgroundColor: colors.subtle },
  disconnectedText: { color: colors.muted },
  gatewayFooter: { flexDirection: 'row', gap: 17, marginTop: 13, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  gatewayFootText: { color: colors.subtle, fontSize: 9 },
  section: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  menuCard: { paddingHorizontal: 14 },
  menuRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lastRow: { borderBottomWidth: 0 },
  menuCopy: { flex: 1 },
  menuLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
  menuValue: { color: colors.muted, fontSize: 9, marginTop: 4 },
  securityCard: { minHeight: 76, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  biometricCopy: { flex: 1 },
  biometricTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  biometricMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  logout: { minHeight: 50, borderRadius: 16, backgroundColor: colors.dangerSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutDisabled: { opacity: 0.6 },
  logoutText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  version: { color: colors.subtle, fontSize: 9, textAlign: 'center' },
});
