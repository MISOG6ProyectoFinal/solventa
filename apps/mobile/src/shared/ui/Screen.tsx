import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';
import { AppHeader, type AppHeaderProps } from './AppHeader';

type ScreenHeaderProps = AppHeaderProps & {
  hide?: boolean;
};

type ScreenProps = {
  children?: ReactNode;
  testID?: string;
  withTabBar?: boolean;
  header: ScreenHeaderProps | { hide: true };
};

export function Screen({ children, testID, withTabBar = false, header }: ScreenProps) {
  const showHeader = !header.hide;
  // The header occupies the top inset. The tab bar occupies the bottom inset.
  const edges: Edge[] = ['left', 'right'];

  if (!showHeader) {
    edges.push('top');
  }

  if (!withTabBar) {
    edges.push('bottom');
  }

  return (
    <SafeAreaView testID={testID} edges={edges} style={styles.screen}>
      {showHeader ? (
        <AppHeader
          title={header.title}
          subtitle={header.subtitle}
          leadingIcon={header.leadingIcon}
          hideBackButton={header.hideBackButton}
        />
      ) : null}
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
