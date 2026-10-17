import {
  createDrawerNavigator,
  createDrawerScreen,
} from '@react-navigation/drawer';
import HomeScreen from './screens/HomeScreen';
import HomeDrawerContent from './screens/HomeDrawerContent';

const HomeDrawer = createDrawerNavigator({
  screenOptions: {
    headerShown: false,
  },
  drawerContent: HomeDrawerContent,
  screens: {
    HomeScreen: createDrawerScreen({
      screen: HomeScreen,
    }),
  },
});

export default HomeDrawer;
