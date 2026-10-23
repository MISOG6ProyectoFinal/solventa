import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { Banner } from './Banner';
import { Button } from './Button';

type ErrorStateProps = {
  message: string;
  retry?: { label: string; onPress: () => void };
};

export function ErrorState({ message, retry }: Readonly<ErrorStateProps>) {
  return (
    <View style={styles.container}>
      <Banner variant="error">{message}</Banner>
      {retry ? <Button title={retry.label} variant="outlined" onPress={retry.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.space.sm,
  },
});
