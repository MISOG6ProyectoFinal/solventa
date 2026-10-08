import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ClaimDetailScreen from './screens/ClaimDetailScreen';
import PhotoPreviewScreen from './screens/PhotoPreviewScreen';
import RecordVideoScreen from './screens/RecordVideoScreen';
import ReportClaimScreen from './screens/ReportClaimScreen';
import TakePhotoScreen from './screens/TakePhotoScreen';
import VideoPreviewScreen from './screens/VideoPreviewScreen';

export const ClaimReportStack = createNativeStackNavigator({
  initialRouteName: 'Report',
  screenOptions: {
    headerShown: false,
  },
  screens: {
    Report: ReportClaimScreen,
    TakePhoto: TakePhotoScreen,
    RecordVideo: RecordVideoScreen,
    PhotoPreview: PhotoPreviewScreen,
    ClaimDetail: ClaimDetailScreen,
    VideoPreview: VideoPreviewScreen,
  },
});
