import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ReportClaimScreen from './screens/ReportClaimScreen';
import PhotoPreviewScreen from './screens/PhotoPreviewScreen';
import TakePhotoScreen from './screens/TakePhotoScreen';

export const ClaimReportStack = createNativeStackNavigator({
  initialRouteName: 'Report',
  screenOptions: {
    headerShown: false,
  },
  screens: {
    Report: ReportClaimScreen,
    TakePhoto: TakePhotoScreen,
    PhotoPreview: PhotoPreviewScreen,
  },
});
