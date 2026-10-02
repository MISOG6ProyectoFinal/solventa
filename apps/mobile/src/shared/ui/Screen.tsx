import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';

type ScreenProps = {
  children?: ReactNode;
  testID?: string;
  withHeader?: boolean;
  withTabBar?: boolean;
};

export function Screen({ children, testID, withHeader = false, withTabBar = false }: ScreenProps) {
  // AppHeader occupies the top inset. The tab bar occupies the bottom inset.
  const edges: Edge[] = ['left', 'right'];

  if (!withHeader) {
    edges.push('top');
  }

  if (!withTabBar) {
    edges.push('bottom');
  }

  return (
    <SafeAreaView testID={testID} edges={edges} style={styles.screen}>
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
