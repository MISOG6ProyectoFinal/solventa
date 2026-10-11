import { createStaticNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ComponentScreen from '../features/components/screens/ComponentScreen';
import ComponentsScreen from '../features/components/screens/ComponentsScreen';
import { ClaimReportStack } from '../features/claims/ClaimReportStack';
import ClaimsScreen from '../features/claims/screens/ClaimsScreen';
import HomeScreen from '../features/home/screens/HomeScreen';
import { QuoteStack } from '../features/quote/QuoteStack';
import ProductsScreen from '../features/quote/screens/ProductsScreen';
import { TabBar } from '../shared/ui';
import { EmptyTabScreen } from './emptyTabs';

const Tabs = createBottomTabNavigator({
  initialRouteName: 'Home',
  screenOptions: {
    headerShown: false,
  },
  tabBar: ({ state, navigation }) => {
    const route = state.routes[state.index];
    if (!route) {
      return null;
    }

    return (
      <TabBar
        value={route.name}
        onChange={(id) => navigation.navigate(id)}
      />
    );
  },
  screens: {
    Home: HomeScreen,
    Policies: EmptyTabScreen,
    Claims: ClaimsScreen,
    Buy: ProductsScreen,
  },
});

export const RootStack = createNativeStackNavigator({
  initialRouteName: 'Main',
  screenOptions: {
    headerShown: false,
  },
  screens: {
    Main: Tabs,
    ClaimReport: ClaimReportStack,
    Quote: QuoteStack,
    Components: ComponentsScreen,
    Component: ComponentScreen,
  },
});

const RootNavigation = createStaticNavigation(RootStack);

export default RootNavigation;
