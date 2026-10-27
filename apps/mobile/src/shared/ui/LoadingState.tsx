import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type LoadingStateProps = {
  label: string;
  testID?: string;
};

export function LoadingState({ label, testID }: Readonly<LoadingStateProps>) {
  return (
    <View style={styles.container}>
      <ActivityIndicator testID={testID} accessibilityLabel={label} color={theme.colors.blue} />
      <AppText variant="bodySmall">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
    padding: theme.space.lg,
  },
});
