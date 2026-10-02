import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../features/home/screens/HomeScreen';
import DetailsScreen from '../features/home/screens/DetailsScreen';
import FieldsScreen from '../features/home/screens/FieldsScreen';
import RowsScreen from '../features/home/screens/RowsScreen';
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
    Details: DetailsScreen,
    Fields: {
      screen: FieldsScreen,
      options: {
        title: 'Campos',
      },
    },
    Rows: {
      screen: RowsScreen,
      options: {
        title: 'Filas',
      },
    },
  },
});

const RootNavigation = createStaticNavigation(RootStack);

export default RootNavigation;
