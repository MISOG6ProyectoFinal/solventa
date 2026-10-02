import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ComponentScreen from '../features/components/screens/ComponentScreen';
import ComponentsScreen from '../features/components/screens/ComponentsScreen';
import HomeScreen from '../features/home/screens/HomeScreen';
import { theme } from '../shared/theme';

export const RootStack = createNativeStackNavigator({
  initialRouteName: 'Home',
  screenOptions: {
    headerTitleStyle: {
      fontFamily: theme.type.button.fontFamily,
      fontWeight: theme.type.button.fontWeight,
    },
  },
  screens: {
    Home: HomeScreen,
    Components: {
      screen: ComponentsScreen,
      options: {
        title: 'Componentes',
      },
    },
    Component: ComponentScreen,
  },
});

const RootNavigation = createStaticNavigation(RootStack);

export default RootNavigation;
