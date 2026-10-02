import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { theme } from '../../theme';
import { AppText } from '../AppText';
import { FieldFrame } from '../FieldFrame';
import { Icon } from '../Icon';
import { Sheet, type SheetHandle } from '../Sheet';
import { formatDate, parseDate } from './date';
import { MonthGrid } from './MonthGrid';

type DateFieldProps = {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  error?: boolean;
  testID?: string;
};

export function DateField({
  label,
  value,
  onChange,
  required = false,
  error = false,
  testID,
}: DateFieldProps) {
  const parsed = useMemo(() => parseDate(value), [value]);
  const sheet = useRef<SheetHandle>(null);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const initial = parsed ?? { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
    return { month: initial.month, year: initial.year };
  });

  const open = () => {
    const next = parseDate(value);
    if (next && (next.month !== cursor.month || next.year !== cursor.year)) {
      setCursor({ month: next.month, year: next.year });
    }
    setFocused(true);
    sheet.current?.present();
  };

  const shiftMonth = useCallback((delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month - 1 + delta, 1);
      return { month: next.getMonth() + 1, year: next.getFullYear() };
    });
  }, []);

  const choose = useCallback(
    (day: number) => {
      onChange?.(formatDate({ day, month: cursor.month, year: cursor.year, time: parsed?.time }));
      sheet.current?.dismiss();
    },
    [cursor, onChange, parsed],
  );

  const shown = parsed ? formatDate(parsed) : value;

  return (
    <>
      <FieldFrame
        label={label}
        required={required}
        error={error}
        focused={focused}
        message={error ? 'Obligatorio' : undefined}
        testID={testID}
        onPress={open}
        trailing={<Icon name="calendario" size={16} color="gray" testID={testID ? `${testID}-icon` : undefined} />}
      >
        <AppText variant="bodySmall" style={shown ? styles.value : styles.placeholder}>
          {shown || 'dd/mm/aaaa'}
        </AppText>
      </FieldFrame>
      <Sheet ref={sheet} onClose={() => setFocused(false)} testID="date-sheet">
        {focused ? (
          <MonthGrid
            month={cursor.month}
            year={cursor.year}
            selectedDay={parsed?.day ?? null}
            selectedMonth={parsed?.month ?? null}
            selectedYear={parsed?.year ?? null}
            onShift={shiftMonth}
            onChoose={choose}
          />
        ) : null}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  value: {
    color: theme.colors.text,
  },
  placeholder: {
    color: theme.colors.textMuted,
  },
});
