import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Card, IconTile, PrimaryButton, SecondaryButton } from '../src/components/AppUi';
import { Screen } from '../src/components/Screen';
import { colors } from '../src/theme';

const systems = [
  { label: 'Windows', icon: 'logo-windows' as const },
  { label: 'macOS', icon: 'logo-apple' as const },
  { label: 'Linux', icon: 'logo-tux' as const },
  { label: '其他', icon: 'ellipsis-horizontal' as const },
];

export default function AddDeviceScreen() {
  return (
    <Screen>
      <AppHeader title="添加设备" subtitle="安装 Mesh Agent 并连接到当前服务器" back />
      <View style={styles.stepper}>
        <Step number="1" label="选择系统" active />
        <View style={styles.lineActive} />
        <Step number="2" label="安装 Agent" active />
        <View style={styles.line} />
        <Step number="3" label="完成连接" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>设备操作系统</Text>
        <View style={styles.systemGrid}>
          {systems.map((system, index) => (
            <Pressable
              key={system.label}
              style={[styles.system, index === 0 && styles.systemActive]}
            >
              <Ionicons
                name={system.icon}
                size={24}
                color={index === 0 ? colors.primary : colors.muted}
              />
              <Text style={[styles.systemLabel, index === 0 && styles.systemLabelActive]}>
                {system.label}
              </Text>
              {index === 0 ? (
                <View style={styles.systemCheck}>
                  <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.titleRow}>
          <Text style={styles.sectionTitle}>安装方式</Text>
          <View style={styles.recommended}>
            <Text style={styles.recommendedText}>推荐</Text>
          </View>
        </View>
        <Card style={styles.installCard}>
          <View style={styles.installHeader}>
            <IconTile name="terminal-outline" tone="primary" size={45} />
            <View style={styles.installCopy}>
              <Text style={styles.installTitle}>PowerShell 一键安装</Text>
              <Text style={styles.installMeta}>以管理员身份运行以下命令</Text>
            </View>
          </View>
          <View style={styles.codeBlock}>
            <Text style={styles.code}>irm https://mesh.company.cn/agent.ps1 | iex</Text>
            <Pressable style={styles.copy}>
              <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
              <Text style={styles.copyText}>复制</Text>
            </Pressable>
          </View>
          <View style={styles.codeMeta}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.success} />
            <Text style={styles.codeMetaText}>脚本已使用 SHA-256 签名验证</Text>
          </View>
        </Card>
      </View>

      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>或者</Text>
        <View style={styles.orLine} />
      </View>

      <Card style={styles.qrCard}>
        <View style={styles.qr}>
          <View style={styles.qrGrid}>
            {Array.from({ length: 36 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.qrPixel,
                  {
                    opacity: [0, 2, 3, 7, 10, 12, 15, 17, 20, 23, 25, 27, 30, 32, 33, 35].includes(
                      index,
                    )
                      ? 1
                      : 0.08,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.qrLogo}>
            <Ionicons name="git-network" size={18} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.qrCopy}>
          <Text style={styles.qrTitle}>扫码下载安装包</Text>
          <Text style={styles.qrMeta}>
            适用于在目标设备上打开此页面，或通过手机扫码分享安装链接。
          </Text>
          <SecondaryButton label="分享安装链接" icon="share-social-outline" />
        </View>
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>连接设置</Text>
        <Card style={styles.settingCard}>
          <SettingRow label="加入设备组" value="生产服务器" icon="layers-outline" />
          <SettingRow label="邀请有效期" value="24 小时" icon="time-outline" />
          <SettingRow label="无人值守访问" value="已允许" icon="key-outline" last />
        </Card>
      </View>
      <View style={styles.tip}>
        <Ionicons name="information-circle-outline" size={18} color={colors.info} />
        <Text style={styles.tipText}>
          Agent 完成安装后会自动出现在设备列表。首次连接通常需要 10–30 秒。
        </Text>
      </View>
      <PrimaryButton label="我已完成安装，检查连接" icon="radio-outline" />
    </Screen>
  );
}

function Step({ number, label, active }: { number: string; label: string; active?: boolean }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepCircle, active && styles.stepCircleActive]}>
        <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{number}</Text>
      </View>
      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
    </View>
  );
}
function SettingRow({
  label,
  value,
  icon,
  last,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  last?: boolean;
}) {
  return (
    <Pressable style={[styles.settingRow, last && styles.lastRow]}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { width: 75, alignItems: 'center', gap: 6 },
  stepCircle: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: { backgroundColor: colors.primary },
  stepNumber: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  stepNumberActive: { color: '#FFFFFF' },
  stepLabel: { color: colors.subtle, fontSize: 9 },
  stepLabelActive: { color: colors.text, fontWeight: '700' },
  line: { flex: 1, height: 2, backgroundColor: colors.border, marginTop: 12 },
  lineActive: { flex: 1, height: 2, backgroundColor: colors.primary, marginTop: 12 },
  section: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recommended: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.successSoft,
    borderRadius: 7,
  },
  recommendedText: { color: colors.success, fontSize: 8, fontWeight: '800' },
  systemGrid: { flexDirection: 'row', gap: 8 },
  system: {
    flex: 1,
    minHeight: 76,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  systemActive: { borderColor: colors.primary, backgroundColor: '#F2FBF9' },
  systemLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  systemLabelActive: { color: colors.primary },
  systemCheck: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 16,
    height: 16,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  installCard: { padding: 16 },
  installHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  installCopy: { flex: 1 },
  installTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  installMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  codeBlock: {
    minHeight: 62,
    marginTop: 15,
    borderRadius: 14,
    backgroundColor: colors.navy,
    paddingLeft: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    overflow: 'hidden',
  },
  code: { flex: 1, color: '#7FD6CB', fontFamily: 'monospace', fontSize: 9 },
  copy: {
    alignSelf: 'stretch',
    paddingHorizontal: 13,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  copyText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  codeMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 11 },
  codeMetaText: { color: colors.success, fontSize: 9 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { color: colors.subtle, fontSize: 9 },
  qrCard: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  qr: {
    width: 102,
    height: 102,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrGrid: { width: 80, height: 80, flexDirection: 'row', flexWrap: 'wrap' },
  qrPixel: {
    width: 13.3,
    height: 13.3,
    backgroundColor: colors.navy,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  qrLogo: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCopy: { flex: 1, gap: 8 },
  qrTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  qrMeta: { color: colors.muted, fontSize: 9, lineHeight: 15 },
  settingCard: { paddingHorizontal: 15 },
  settingRow: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  settingLabel: { flex: 1, color: colors.muted, fontSize: 10 },
  settingValue: { color: colors.text, fontSize: 10, fontWeight: '700' },
  tip: {
    minHeight: 62,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: colors.infoSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  tipText: { flex: 1, color: colors.info, fontSize: 9, lineHeight: 15 },
});
