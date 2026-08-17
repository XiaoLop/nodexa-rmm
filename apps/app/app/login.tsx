import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../src/components/AppUi';
import { colors } from '../src/theme';

export default function LoginScreen() {
  const [secure, setSecure] = useState(true);
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundOrb} />
      <View style={styles.container}>
        <View style={styles.brand}><View style={styles.logo}><Ionicons name="git-network" size={29} color="#FFFFFF" /></View><View><Text style={styles.brandName}>Mesh Console</Text><Text style={styles.brandTagline}>Secure device operations</Text></View></View>
        <View style={styles.heading}><Text style={styles.eyebrow}>WELCOME BACK</Text><Text style={styles.title}>登录控制台</Text><Text style={styles.subtitle}>连接你的 MeshCentral 服务并管理所有设备</Text></View>
        <View style={styles.form}>
          <Field label="服务器地址" icon="server-outline" value="https://mesh.company.cn" />
          <Field label="用户名" icon="person-outline" value="lin.mo" />
          <View style={styles.fieldGroup}><Text style={styles.label}>密码</Text><View style={styles.field}><Ionicons name="lock-closed-outline" size={19} color={colors.muted} /><TextInput value="MeshConsole2026" secureTextEntry={secure} style={styles.input} /><Pressable onPress={() => setSecure(!secure)}><Ionicons name={secure ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.muted} /></Pressable></View></View>
          <View style={styles.formMeta}><View style={styles.remember}><View style={styles.checkbox}><Ionicons name="checkmark" size={13} color="#FFFFFF" /></View><Text style={styles.rememberText}>记住登录状态</Text></View><Text style={styles.forgot}>忘记密码？</Text></View>
          <PrimaryButton label="安全登录" icon="arrow-forward" onPress={() => router.replace('/')} />
          <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>或使用企业身份</Text><View style={styles.dividerLine} /></View>
          <Pressable style={styles.sso}><View style={styles.ssoIcon}><Text style={styles.ssoIconText}>S</Text></View><Text style={styles.ssoText}>使用 SSO 登录</Text><Ionicons name="chevron-forward" size={17} color={colors.subtle} /></Pressable>
        </View>
        <View style={styles.security}><Ionicons name="shield-checkmark-outline" size={17} color={colors.success} /><Text style={styles.securityText}>凭据仅用于当前会话，不会存储在 Mesh Console 服务器</Text></View>
        <Text style={styles.footer}>继续即表示你同意服务条款与隐私政策</Text>
      </View>
    </SafeAreaView>
  );
}

function Field({ label, icon, value }: { label: string; icon: keyof typeof Ionicons.glyphMap; value: string }) { return <View style={styles.fieldGroup}><Text style={styles.label}>{label}</Text><View style={styles.field}><Ionicons name={icon} size={19} color={colors.muted} /><TextInput defaultValue={value} style={styles.input} /></View></View>; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  backgroundOrb: { position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: colors.primarySoft, right: -170, top: -120 },
  container: { flex: 1, paddingHorizontal: 25, paddingTop: 30 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  logo: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: colors.text, fontSize: 16, fontWeight: '800' },
  brandTagline: { color: colors.muted, fontSize: 9, marginTop: 3, letterSpacing: 0.5 },
  heading: { marginTop: 49 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: colors.text, fontSize: 31, fontWeight: '800', marginTop: 9, letterSpacing: -0.7 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 9 },
  form: { marginTop: 35, gap: 17 },
  fieldGroup: { gap: 8 },
  label: { color: colors.text, fontSize: 11, fontWeight: '800' },
  field: { minHeight: 51, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 15, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, color: colors.text, fontSize: 12 },
  formMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  checkbox: { width: 18, height: 18, borderRadius: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  rememberText: { color: colors.muted, fontSize: 10 },
  forgot: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.subtle, fontSize: 9 },
  sso: { height: 51, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ssoIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' },
  ssoIconText: { color: colors.info, fontSize: 12, fontWeight: '800' },
  ssoText: { flex: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
  security: { marginTop: 'auto', minHeight: 55, borderRadius: 15, backgroundColor: colors.successSoft, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  securityText: { flex: 1, color: colors.success, fontSize: 9, lineHeight: 14 },
  footer: { color: colors.subtle, fontSize: 9, textAlign: 'center', marginVertical: 18 },
});
