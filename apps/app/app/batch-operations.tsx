import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Card, IconTile, PrimaryButton } from '../src/components/AppUi';
import { Screen } from '../src/components/Screen';
import { platformIcon } from '../src/demoData';
import { useUiData } from '../src/features/gateway/useUiData';
import { colors } from '../src/theme';

const operationItems = [
  { id: 'command', label: '执行指令', icon: 'terminal-outline' as const, tone: 'primary' as const },
  { id: 'file', label: '上传文件', icon: 'cloud-upload-outline' as const, tone: 'info' as const },
  { id: 'restart', label: '重启设备', icon: 'refresh-outline' as const, tone: 'warning' as const },
  { id: 'message', label: '发送消息', icon: 'chatbox-outline' as const, tone: 'success' as const },
];

export default function BatchOperationsScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { devices } = useUiData();
  const online = devices.filter((device) => device.online);
  const [operation, setOperation] = useState(params.mode === 'file' ? 'file' : 'command');
  const [selected, setSelected] = useState(online.slice(0, 3).map((device) => device.id));
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <AppHeader title="批量执行操作" subtitle="选择多个在线节点执行同一任务" back />
      <View style={styles.steps}><Step number="1" label="选择操作" active /><View style={styles.stepLine} /><Step number="2" label="选择设备" active /><View style={styles.stepLineMuted} /><Step number="3" label="确认执行" /></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>操作类型</Text><View style={styles.operationGrid}>{operationItems.map((item) => <Pressable key={item.id} style={[styles.operation, operation === item.id && styles.operationActive]} onPress={() => setOperation(item.id)}><IconTile name={item.icon} tone={item.tone} size={40} /><Text style={[styles.operationLabel, operation === item.id && styles.operationLabelActive]}>{item.label}</Text>{operation === item.id ? <View style={styles.operationCheck}><Ionicons name="checkmark" size={11} color="#FFFFFF" /></View> : null}</Pressable>)}</View></View>
      {operation === 'command' ? <View style={styles.section}><View style={styles.titleRow}><Text style={styles.sectionTitle}>执行指令</Text><View style={styles.shellBadge}><Text style={styles.shellBadgeText}>Shell</Text></View></View><View style={styles.terminal}><View style={styles.terminalTop}><View style={styles.terminalDots}><View style={[styles.dot, { backgroundColor: colors.danger }]} /><View style={[styles.dot, { backgroundColor: colors.warning }]} /><View style={[styles.dot, { backgroundColor: colors.success }]} /></View><Text style={styles.terminalLabel}>COMMAND</Text></View><TextInput defaultValue="sudo apt update && sudo apt upgrade -y" multiline style={styles.terminalInput} /></View></View> : <View style={styles.upload}><IconTile name="document-attach-outline" tone="info" size={44} /><View style={styles.uploadCopy}><Text style={styles.uploadTitle}>mesh-agent-config.json</Text><Text style={styles.uploadMeta}>12 KB · 上传至 /tmp</Text></View><Ionicons name="close-circle" size={20} color={colors.subtle} /></View>}
      <View style={styles.section}><View style={styles.titleRow}><Text style={styles.sectionTitle}>目标设备</Text><Text style={styles.selectedText}>已选 {selected.length} 台</Text></View><Card style={styles.deviceCard}>{online.map((device, index) => { const checked = selected.includes(device.id); return <Pressable key={device.id} style={[styles.deviceRow, index === online.length - 1 && styles.lastRow]} onPress={() => toggle(device.id)}><View style={[styles.checkbox, checked && styles.checkboxActive]}>{checked ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}</View><IconTile name={platformIcon(device.platform)} tone="neutral" size={37} /><View style={styles.deviceCopy}><Text style={styles.deviceName}>{device.name}</Text><Text style={styles.deviceMeta}>{device.groupName} · {device.platform}</Text></View><View style={styles.onlineDot} /></Pressable>; })}</Card></View>
      <View style={styles.warning}><Ionicons name="warning-outline" size={19} color={colors.warning} /><Text style={styles.warningText}>批量操作无法撤销。执行前请确认命令已在测试设备上验证。</Text></View>
      <PrimaryButton label={`下一步 · 确认 ${selected.length} 台设备`} icon="arrow-forward" disabled={selected.length === 0} />
    </Screen>
  );
}

function Step({ number, label, active }: { number: string; label: string; active?: boolean }) { return <View style={styles.step}><View style={[styles.stepCircle, active && styles.stepCircleActive]}><Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{number}</Text></View><Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text></View>; }

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { width: 75, alignItems: 'center', gap: 6 },
  stepCircle: { width: 25, height: 25, borderRadius: 9, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: colors.primary },
  stepNumber: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  stepNumberActive: { color: '#FFFFFF' },
  stepLabel: { color: colors.subtle, fontSize: 9 },
  stepLabelActive: { color: colors.text, fontWeight: '700' },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.primary, marginTop: 12 },
  stepLineMuted: { flex: 1, height: 2, backgroundColor: colors.border, marginTop: 12 },
  section: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  operationGrid: { flexDirection: 'row', gap: 8 },
  operation: { flex: 1, minHeight: 90, paddingVertical: 11, borderRadius: 17, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 7 },
  operationActive: { borderColor: colors.primary, backgroundColor: '#F2FBF9' },
  operationLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  operationLabelActive: { color: colors.primary },
  operationCheck: { position: 'absolute', right: 6, top: 6, width: 17, height: 17, borderRadius: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  shellBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.surfaceRaised },
  shellBadgeText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  terminal: { borderRadius: 18, backgroundColor: '#112A3C', overflow: 'hidden' },
  terminalTop: { height: 37, paddingHorizontal: 13, backgroundColor: '#0B2233', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  terminalDots: { flexDirection: 'row', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  terminalLabel: { color: '#728B9A', fontSize: 8, letterSpacing: 1.2 },
  terminalInput: { minHeight: 72, color: '#7FD6CB', fontFamily: 'monospace', fontSize: 11, padding: 14, textAlignVertical: 'top' },
  upload: { minHeight: 75, borderRadius: 18, paddingHorizontal: 14, backgroundColor: colors.infoSoft, flexDirection: 'row', alignItems: 'center', gap: 11 },
  uploadCopy: { flex: 1 },
  uploadTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  uploadMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  selectedText: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  deviceCard: { paddingHorizontal: 14 },
  deviceRow: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lastRow: { borderBottomWidth: 0 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  deviceCopy: { flex: 1 },
  deviceName: { color: colors.text, fontSize: 11, fontWeight: '800' },
  deviceMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  warning: { minHeight: 60, borderRadius: 16, paddingHorizontal: 14, backgroundColor: colors.warningSoft, flexDirection: 'row', alignItems: 'center', gap: 9 },
  warningText: { flex: 1, color: colors.warning, fontSize: 9, lineHeight: 15 },
});
