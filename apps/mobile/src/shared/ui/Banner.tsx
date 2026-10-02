import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

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
      <Text style={[theme.type.body, { color: theme.colors[variant].text }]}>
        {children}
      </Text>
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
