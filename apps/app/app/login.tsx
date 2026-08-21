import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '../src/components/AppUi';
import { useGateway } from '../src/features/gateway/GatewayProvider';
import { colors } from '../src/theme';

export default function LoginScreen() {
  const { login } = useGateway();
  const [secure, setSecure] = useState(true); // 密码是否可见
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true); // 是否记住账号密码
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!username || !password) {
      setErrorMsg('请输入用户名和密码');
      return;
    }
    if (loading) return;
    setErrorMsg('');
    setLoading(true);
    try {
      await login(username, password, remember);
      router.replace('/');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '无法连接到服务器');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.backgroundOrb} />
      <View style={styles.container}>
        <View style={styles.brand}><View style={styles.logo}><Ionicons name="git-network" size={29} color="#FFFFFF" /></View><View><Text style={styles.brandName}>Mesh Console</Text><Text style={styles.brandTagline}>Secure device operations</Text></View></View>
        <View style={styles.heading}><Text style={styles.eyebrow}>WELCOME BACK</Text><Text style={styles.title}>登录控制台</Text><Text style={styles.subtitle}>连接你的 MeshCentral 服务并管理所有设备</Text></View>
        <View style={styles.form}>
          <Field label="用户名" icon="person-outline" value={username} onChangeText={setUsername} />
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>密码</Text>
            <View style={styles.field}>
              <Ionicons name="lock-closed-outline" size={19} color={colors.muted} />
              <TextInput 
                value={password} 
                onChangeText={setPassword}
                secureTextEntry={secure} 
                style={styles.input} 
                autoCapitalize="none"
              />
              <Pressable onPress={() => setSecure(!secure)}>
                <Ionicons name={secure ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.muted} />
              </Pressable>
            </View>
          </View>
          <View style={styles.formMeta}>
            <Pressable style={styles.remember} onPress={() => setRemember(!remember)}>
              <View style={[styles.checkbox, !remember && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}>
                {remember && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
              </View>
              <Text style={styles.rememberText}>记住登录状态</Text>
            </Pressable>
          </View>
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}
          <PrimaryButton 
            label={loading ? "登录中..." : "安全登录"} 
            icon={loading ? "hourglass-outline" : "arrow-forward"} 
            onPress={handleLogin} 
          />
        </View>
        <View style={styles.security}><Ionicons name="shield-checkmark-outline" size={17} color={colors.success} /><Text style={styles.securityText}>凭据仅用于当前会话，不会存储在 Mesh Console 服务器</Text></View>
        <Text style={styles.footer}>继续即表示你同意服务条款与隐私政策</Text>
      </View>
    </SafeAreaView>
  );
}

function Field({ label, icon, value, onChangeText }: { label: string; icon: keyof typeof Ionicons.glyphMap; value: string; onChangeText: (text: string) => void }) { 
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <Ionicons name={icon} size={19} color={colors.muted} />
        <TextInput value={value} onChangeText={onChangeText} style={styles.input} autoCapitalize="none" />
      </View>
    </View>
  ); 
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  backgroundOrb: { position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: colors.primarySoft, right: -170, top: -120 },
  container: { flex: 1, paddingHorizontal: 25, paddingTop: 50 },
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
  input: { flex: 1, color: colors.text, fontSize: 12, outlineStyle: 'none' as any },
  formMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  checkbox: { width: 18, height: 18, borderRadius: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  rememberText: { color: colors.muted, fontSize: 10 },
  forgot: { color: colors.primary, fontSize: 10, fontWeight: '800' },
  security: { marginTop: 'auto', minHeight: 55, borderRadius: 15, backgroundColor: colors.successSoft, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  securityText: { flex: 1, color: colors.success, fontSize: 9, lineHeight: 14 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.dangerSoft, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  errorText: { flex: 1, color: colors.danger, fontSize: 11, lineHeight: 16 },
  footer: { color: colors.subtle, fontSize: 9, textAlign: 'center', marginVertical: 18 },
});
