import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';

type ScreenProps = {
  children: ReactNode;
  testID?: string;
  withTabBar?: boolean;
};

export function Screen({ children, testID, withTabBar = false }: ScreenProps) {
  // The native stack header already occupies the top inset.
  const edges: Edge[] = withTabBar ? ['left', 'right'] : ['left', 'right', 'bottom'];

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
