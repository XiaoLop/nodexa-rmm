import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MeshCentralControlProvider } from '../src/features/gateway/MeshCentralControlProvider';
import { colors } from '../src/theme';

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    primary: colors.primary,
    border: colors.border,
    text: colors.text,
  },
};

export default function RootLayout() {
  return (
    <MeshCentralControlProvider>
      <ThemeProvider value={appTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style="dark" />
      </ThemeProvider>
    </MeshCentralControlProvider>
  );
}
