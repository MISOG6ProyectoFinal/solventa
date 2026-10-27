import { createStaticNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ClaimReportStack } from '../features/claims/ClaimReportStack';
import AssistanceConfirmScreen from '../features/claims/screens/AssistanceConfirmScreen';
import AssistanceServiceScreen from '../features/claims/screens/AssistanceServiceScreen';
import AvisoDetailScreen from '../features/claims/screens/AvisoDetailScreen';
import ClaimsScreen from '../features/claims/screens/ClaimsScreen';
import HomeDrawer from '../features/home/HomeStack';
import PoliciesScreen from '../features/policies/screens/PoliciesScreen';
import NearbyProvidersScreen from '../features/providers/screens/NearbyProvidersScreen';
import SettingsScreen from '../features/settings/screens/SettingsScreen';
import { QuoteStack } from '../features/quote/QuoteStack';
import ProductsScreen from '../features/quote/screens/ProductsScreen';
import CheckingScreen from '../features/session/screens/CheckingScreen';
import LoginScreen from '../features/session/screens/LoginScreen';
import RegisterScreen from '../features/session/screens/RegisterScreen';
import { useSessionStore } from '../features/session/store/useSessionStore';
import { TabBar } from '../shared/ui';

type DevScreens = {
  DevTools: typeof import('../features/devtools/screens/DevToolsScreen').default;
  Components: typeof import('../features/components/screens/ComponentsScreen').default;
  Component: typeof import('../features/components/screens/ComponentScreen').default;
};

// Metro drops the branch in release builds, so these screens never reach the bundle.
const devScreens: DevScreens = __DEV__
  ? {
      DevTools: require('../features/devtools/screens/DevToolsScreen').default,
      Components: require('../features/components/screens/ComponentsScreen').default,
      Component: require('../features/components/screens/ComponentScreen').default,
    }
  : ({} as DevScreens);

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
    Policies: PoliciesScreen,
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
        NearbyProviders: NearbyProvidersScreen,
        Settings: SettingsScreen,
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
      screens: devScreens,
    },
  },
});

const RootNavigation = createStaticNavigation(RootStack);

export default RootNavigation;
