import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type StatProps = {
  label: string;
  value: string;
  detail?: string;
  variant?: 'default' | 'inverse';
  testID?: string;
};

export function Stat({ label, value, detail, variant = 'default', testID }: StatProps) {
  const inverse = variant === 'inverse';

  return (
    <View testID={testID} style={[styles.card, inverse && styles.inverse]}>
      <AppText variant="label" style={[styles.overline, inverse ? styles.onNavyMuted : styles.muted]}>
        {label}
      </AppText>
      <AppText variant="sectionTitle" style={inverse && styles.onNavy}>
        {value}
      </AppText>
      {detail ? (
        <AppText
          variant="caption"
          style={[styles.detail, inverse ? styles.onNavyMuted : styles.muted]}
        >
          {detail}
        </AppText>
      ) : null}
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
    gap: theme.space.xs,
  },
  inverse: {
    backgroundColor: theme.colors.navy,
    borderWidth: 0,
  },
  overline: {
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
  },
  detail: {
    fontFamily: theme.type.body.fontFamily,
    fontWeight: theme.type.body.fontWeight,
  },
  muted: {
    color: theme.colors.textMuted,
  },
  onNavy: {
    color: theme.colors.onNavy,
  },
  onNavyMuted: {
    color: theme.colors.onNavyMuted,
  },
});
