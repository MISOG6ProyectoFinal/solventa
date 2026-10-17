import { AppText } from './AppText';

type AmountProps = {
  value: string;
  align?: 'left' | 'center';
};

export function Amount({ value, align = 'left' }: Readonly<AmountProps>) {
  return (
    <AppText variant="amount" style={{ textAlign: align }}>
      {value}
    </AppText>
  );
}
