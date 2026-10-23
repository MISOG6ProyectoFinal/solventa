import { StyleSheet } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';

type EmptyStateProps = {
  message: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ message, action }: Readonly<EmptyStateProps>) {
  return (
    <Card style={styles.card}>
      <AppText variant="bodySmall" style={styles.message}>
        {message}
      </AppText>
      {action ? <Button title={action.label} onPress={action.onPress} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: theme.space.xl,
    gap: theme.space.lg,
  },
  message: {
    textAlign: 'center',
  },
});
