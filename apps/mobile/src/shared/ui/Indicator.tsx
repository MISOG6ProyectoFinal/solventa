import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type IndicatorTone = 'primary' | 'secondary' | 'accent';

type IndicatorProps = {
  tone: IndicatorTone;
  children: string;
};

const toneColor = {
  primary: theme.colors.navy,
  secondary: theme.colors.blue,
  accent: theme.colors.teal,
};

export function Indicator({ tone, children }: IndicatorProps) {
  const color = toneColor[tone];

  return (
    <View style={styles.row}>
      <View style={[styles.bar, { backgroundColor: color }]} />
      <AppText variant="bodySmall" style={{ color }}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  bar: {
    width: 3,
    height: 24,
    borderRadius: theme.radius.full,
  },
});
