import { StatusBar } from 'react-native';

import { Screen } from '../shared/ui';

export function EmptyTabScreen() {
  return (
    <Screen header={{ hide: true }} withTabBar>
      <StatusBar barStyle="dark-content" />
    </Screen>
  );
}
