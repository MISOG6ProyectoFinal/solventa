import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';

type ScreenProps = {
  children: ReactNode;
  testID?: string;
  withTabBar?: boolean;
};

export function Screen({ children, testID, withTabBar = false }: ScreenProps) {
  return (
    <SafeAreaView
      testID={testID}
      edges={withTabBar ? ['top', 'left', 'right'] : undefined}
      style={styles.screen}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
