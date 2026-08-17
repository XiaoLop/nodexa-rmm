import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { colors } from '../theme';

export function Screen(props: ScrollViewProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} {...props} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 20, paddingBottom: 44 },
});
