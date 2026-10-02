import { Text } from 'react-native';

import { theme } from '../theme';

type AmountProps = {
  value: string;
  align?: 'left' | 'center';
};

export function Amount({ value, align = 'left' }: AmountProps) {
  return <Text style={[theme.type.amount, { textAlign: align }]}>{value}</Text>;
}
