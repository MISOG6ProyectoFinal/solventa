import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../theme';
import { AppText } from './AppText';

type BannerVariant = 'success' | 'info' | 'warning' | 'error' | 'progress';

type BannerProps = {
  variant: BannerVariant;
  children: ReactNode;
  testID?: string;
};

export function Banner({ variant, children, testID }: BannerProps) {
  return (
    <View
      testID={testID}
      style={[styles.banner, { backgroundColor: theme.colors[variant].background }]}
    >
      <AppText variant="body" style={{ color: theme.colors[variant].text }}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignSelf: 'stretch',
    borderRadius: theme.radius.medium,
    padding: theme.space.md,
  },
});
