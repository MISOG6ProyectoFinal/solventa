import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';

type CardProps = {
  children: ReactNode;
  variant?: 'default' | 'inverse';
  testID?: string;
};

export function Card({ children, variant = 'default', testID }: CardProps) {
  return (
    <View testID={testID} style={[styles.card, variant === 'inverse' && styles.inverse]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space.lg,
    gap: theme.space.md,
  },
  inverse: {
    backgroundColor: theme.colors.navy,
    borderColor: theme.colors.navy,
  },
});
