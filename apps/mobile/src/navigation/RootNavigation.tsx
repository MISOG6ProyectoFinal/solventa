import { createStaticNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ComponentScreen from '../features/components/screens/ComponentScreen';
import ComponentsScreen from '../features/components/screens/ComponentsScreen';
import { ClaimReportStack } from '../features/claims/ClaimReportStack';
import AssistanceConfirmScreen from '../features/claims/screens/AssistanceConfirmScreen';
import AssistanceServiceScreen from '../features/claims/screens/AssistanceServiceScreen';
import AvisoDetailScreen from '../features/claims/screens/AvisoDetailScreen';
import ClaimsScreen from '../features/claims/screens/ClaimsScreen';
import DevToolsScreen from '../features/devtools/screens/DevToolsScreen';
import { QuoteStack } from '../features/quote/QuoteStack';
import ProductsScreen from '../features/quote/screens/ProductsScreen';
import CheckingScreen from '../features/session/screens/CheckingScreen';
import LoginScreen from '../features/session/screens/LoginScreen';
import RegisterScreen from '../features/session/screens/RegisterScreen';
import { useSessionStore } from '../features/session/store/useSessionStore';
import { TabBar } from '../shared/ui';
import { EmptyTabScreen } from './emptyTabs';
import HomeDrawer from '../features/home/HomeStack';

function useIsChecking() {
  return useSessionStore((state) => state.status === 'checking');
}

function useIsSignedIn() {
  return useSessionStore((state) => state.status === 'signedIn');
}

function useIsSignedOut() {
  return useSessionStore((state) => state.status === 'signedOut');
}

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
    Home: HomeDrawer,
    Policies: EmptyTabScreen,
    Claims: ClaimsScreen,
    Buy: ProductsScreen,
  },
});

export const RootStack = createNativeStackNavigator({
  screenOptions: {
    headerShown: false,
  },
  groups: {
    Checking: {
      if: useIsChecking,
      screens: {
        Checking: CheckingScreen,
      },
    },
    SignedIn: {
      if: useIsSignedIn,
      screens: {
        Main: Tabs,
        ClaimReport: ClaimReportStack,
        AvisoDetail: AvisoDetailScreen,
        AssistanceService: AssistanceServiceScreen,
        AssistanceConfirm: AssistanceConfirmScreen,
        Quote: QuoteStack,
      },
    },
    SignedOut: {
      if: useIsSignedOut,
      screens: {
        Login: LoginScreen,
        Register: RegisterScreen,
      },
    },
    // Last, so the first active group still decides the initial route.
    Dev: {
      screens: {
        DevTools: DevToolsScreen,
        Components: ComponentsScreen,
        Component: ComponentScreen,
      },
    },
  },
});

const RootNavigation = createStaticNavigation(RootStack);

export default RootNavigation;
