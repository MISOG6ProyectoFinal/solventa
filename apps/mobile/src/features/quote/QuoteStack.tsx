import { createNativeStackNavigator } from '@react-navigation/native-stack';

import QuoteFormScreen from './screens/QuoteFormScreen';
import QuoteResultScreen from './screens/QuoteResultScreen';

export const QuoteStack = createNativeStackNavigator({
  initialRouteName: 'Form',
  screenOptions: {
    headerShown: false,
  },
  screens: {
    Form: QuoteFormScreen,
    Result: QuoteResultScreen,
  },
});
