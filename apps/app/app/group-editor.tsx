import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AppHeader, Card, PrimaryButton } from '../src/components/AppUi';
import { Screen } from '../src/components/Screen';
import { colors } from '../src/theme';

const colorsList = ['#0F766E', '#3972D5', '#8B5CF6', '#E9942B', '#DB4B5B'];

export default function GroupEditorScreen() {
  const [selectedColor, setSelectedColor] = useState(colorsList[0]);
  const [notify, setNotify] = useState(true);
  return (
    <Screen keyboardShouldPersistTaps="handled">
      <AppHeader title="创建设备组" subtitle="统一管理一类设备的权限与策略" back />
      <View style={styles.progress}><View style={styles.progressActive} /><View style={styles.progressRest} /></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>基本信息</Text>
        <Card style={styles.formCard}>
          <Field label="设备组名称" placeholder="例如：生产服务器" value="华东区生产服务器" />
          <Field label="描述（可选）" placeholder="说明这个设备组的用途" multiline value="上海数据中心的核心业务节点" />
          <View style={styles.fieldGroup}><Text style={styles.label}>分组标识色</Text><View style={styles.colorRow}>{colorsList.map((color) => <Pressable key={color} style={[styles.color, { backgroundColor: color }, selectedColor === color && styles.colorSelected]} onPress={() => setSelectedColor(color)}>{selectedColor === color ? <Ionicons name="checkmark" size={17} color="#FFFFFF" /> : null}</Pressable>)}</View></View>
        </Card>
      </View>
      <View style={styles.section}><Text style={styles.sectionTitle}>默认策略</Text>
        <Card style={styles.policyCard}>
          <PolicyRow icon="desktop-outline" title="远程桌面" description="允许管理员发起远程桌面会话" enabled />
          <PolicyRow icon="terminal-outline" title="终端与命令" description="允许执行终端命令和脚本" enabled />
          <PolicyRow icon="folder-open-outline" title="文件传输" description="允许上传和下载节点文件" enabled />
          <View style={styles.notifyRow}><View style={styles.policyIcon}><Ionicons name="notifications-outline" size={18} color={colors.primary} /></View><View style={styles.policyCopy}><Text style={styles.policyTitle}>离线通知</Text><Text style={styles.policyDescription}>设备离线超过 15 分钟时通知</Text></View><Switch value={notify} onValueChange={setNotify} trackColor={{ true: colors.primarySoft }} thumbColor={notify ? colors.primary : colors.subtle} /></View>
        </Card>
      </View>
      <View style={styles.info}><Ionicons name="information-circle-outline" size={18} color={colors.info} /><Text style={styles.infoText}>创建设备组后，可通过邀请链接或安装脚本将 Agent 加入此组。</Text></View>
      <PrimaryButton label="创建设备组" icon="checkmark-circle-outline" />
    </Screen>
  );
}

function Field({ label, placeholder, value, multiline }: { label: string; placeholder: string; value?: string; multiline?: boolean }) { return <View style={styles.fieldGroup}><Text style={styles.label}>{label}</Text><TextInput defaultValue={value} placeholder={placeholder} placeholderTextColor={colors.subtle} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>; }
function PolicyRow({ icon, title, description, enabled }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; enabled: boolean }) { return <View style={styles.policyRow}><View style={styles.policyIcon}><Ionicons name={icon} size={18} color={colors.primary} /></View><View style={styles.policyCopy}><Text style={styles.policyTitle}>{title}</Text><Text style={styles.policyDescription}>{description}</Text></View><View style={[styles.policyCheck, enabled && styles.policyCheckActive]}>{enabled ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}</View></View>; }

const styles = StyleSheet.create({
  progress: { height: 4, borderRadius: 2, flexDirection: 'row', gap: 4, overflow: 'hidden' },
  progressActive: { width: '52%', backgroundColor: colors.primary, borderRadius: 2 },
  progressRest: { flex: 1, backgroundColor: colors.border, borderRadius: 2 },
  section: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  formCard: { padding: 17, gap: 19 },
  fieldGroup: { gap: 8 },
  label: { color: colors.text, fontSize: 11, fontWeight: '800' },
  input: { minHeight: 49, borderRadius: 14, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, color: colors.text, fontSize: 12 },
  multiline: { minHeight: 82, paddingTop: 13, textAlignVertical: 'top' },
  colorRow: { flexDirection: 'row', gap: 13 },
  color: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  colorSelected: { borderWidth: 3, borderColor: '#FFFFFF', outlineStyle: 'solid', outlineWidth: 2, outlineColor: colors.primary } as never,
  policyCard: { paddingHorizontal: 15 },
  policyRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  notifyRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11 },
  policyIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  policyCopy: { flex: 1 },
  policyTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  policyDescription: { color: colors.muted, fontSize: 9, marginTop: 4 },
  policyCheck: { width: 22, height: 22, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  policyCheckActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  info: { minHeight: 62, borderRadius: 16, paddingHorizontal: 14, backgroundColor: colors.infoSoft, flexDirection: 'row', alignItems: 'center', gap: 9 },
  infoText: { flex: 1, color: colors.info, fontSize: 10, lineHeight: 16 },
});
