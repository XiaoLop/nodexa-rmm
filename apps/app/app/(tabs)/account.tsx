import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { AppHeader, Card, IconTile } from '../../src/components/AppUi';
import { Screen } from '../../src/components/Screen';
import { colors } from '../../src/theme';

const menuItems = [
  { label: '服务器连接', value: 'mesh.company.cn', icon: 'server-outline' as const, tone: 'info' as const },
  { label: '登录与安全', value: '双重验证已开启', icon: 'shield-checkmark-outline' as const, tone: 'success' as const },
  { label: '通知设置', value: '仅重要事件', icon: 'notifications-outline' as const, tone: 'warning' as const },
  { label: '外观与语言', value: '跟随系统 · 简体中文', icon: 'color-palette-outline' as const, tone: 'primary' as const },
];

export default function AccountScreen() {
  return (
    <Screen>
      <AppHeader title="我的账户" right={<Pressable style={styles.settings}><Ionicons name="settings-outline" size={20} color={colors.text} /></Pressable>} />
      <View style={styles.profileCard}>
        <View style={styles.profilePattern} />
        <View style={styles.profileTop}>
          <View style={styles.avatar}><Text style={styles.avatarText}>林默</Text></View>
          <View style={styles.profileCopy}><Text style={styles.name}>林默</Text><Text style={styles.role}>系统管理员 · IT Operations</Text></View>
          <Pressable style={styles.edit}><Ionicons name="create-outline" size={18} color="#FFFFFF" /></Pressable>
        </View>
        <View style={styles.profileStats}>
          <View><Text style={styles.statValue}>管理员</Text><Text style={styles.statLabel}>账户角色</Text></View>
          <View style={styles.statDivider} />
          <View><Text style={styles.statValue}>3 个</Text><Text style={styles.statLabel}>授权设备组</Text></View>
          <View style={styles.statDivider} />
          <View><Text style={styles.statValue}>13:21</Text><Text style={styles.statLabel}>最近登录</Text></View>
        </View>
      </View>

      <Card style={styles.gatewayCard}>
        <View style={styles.gatewayTop}>
          <IconTile name="git-network-outline" tone="success" size={44} />
          <View style={styles.gatewayCopy}><Text style={styles.gatewayTitle}>MeshCentral 网关</Text><Text style={styles.gatewayMeta}>wss://mesh.company.cn/control</Text></View>
          <View style={styles.connected}><View style={styles.connectedDot} /><Text style={styles.connectedText}>已连接</Text></View>
        </View>
        <View style={styles.gatewayFooter}><Text style={styles.gatewayFootText}>延迟 38 ms</Text><Text style={styles.gatewayFootText}>TLS 1.3</Text><Text style={styles.gatewayFootText}>v1.1.52</Text></View>
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

      <Card style={styles.biometric}><IconTile name="finger-print-outline" tone="primary" size={42} /><View style={styles.biometricCopy}><Text style={styles.biometricTitle}>Face ID 快速解锁</Text><Text style={styles.biometricMeta}>下次打开应用时验证身份</Text></View><Switch value trackColor={{ true: colors.primarySoft }} thumbColor={colors.primary} /></Card>
      <Pressable style={styles.logout} onPress={() => router.push('/login')}><Ionicons name="log-out-outline" size={19} color={colors.danger} /><Text style={styles.logoutText}>退出当前账户</Text></Pressable>
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
  edit: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#25465A', alignItems: 'center', justifyContent: 'center' },
  profileStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#29465A' },
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
  biometric: { minHeight: 76, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  biometricCopy: { flex: 1 },
  biometricTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  biometricMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  logout: { minHeight: 50, borderRadius: 16, backgroundColor: colors.dangerSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { color: colors.danger, fontSize: 13, fontWeight: '800' },
  version: { color: colors.subtle, fontSize: 9, textAlign: 'center' },
});
