import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ReportClaimScreen from './screens/ReportClaimScreen';

export const ClaimReportStack = createNativeStackNavigator({
  initialRouteName: 'Report',
  screenOptions: {
    headerShown: false,
  },
  screens: {
    Report: ReportClaimScreen,
  },
});
