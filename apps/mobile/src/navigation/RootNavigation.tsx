import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../features/home/screens/HomeScreen';
import DetailsScreen from '../features/home/screens/DetailsScreen';
import FieldsScreen from '../features/home/screens/FieldsScreen';

export const RootStack = createNativeStackNavigator({
  initialRouteName: 'Home',
  screens: {
    Home: HomeScreen,
    Details: DetailsScreen,
    Fields: {
      screen: FieldsScreen,
      options: {
        title: 'Campos',
      },
    },
  },
});

const RootNavigation = createStaticNavigation(RootStack);

export default RootNavigation;
