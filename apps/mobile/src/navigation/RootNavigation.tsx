import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../features/home/screens/HomeScreen';

const RootStack = createNativeStackNavigator({
  screens: {
    Home: HomeScreen,
  },
});

const RootNavigation = createStaticNavigation(RootStack);

export default RootNavigation;
