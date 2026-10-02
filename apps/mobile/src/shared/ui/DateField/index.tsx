import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '../../theme';
import { outfitFont } from '../../theme/fonts';
import { AppText } from '../AppText';
import { Button } from '../Button';
import { FieldFrame } from '../FieldFrame';
import { Icon } from '../Icon';
import { Sheet, type SheetHandle } from '../Sheet';
import { formatDate, formatTime, months, parseDate, parseTime } from './date';
import { MonthGrid } from './MonthGrid';
import { TimePicker } from './TimePicker';

type DateFieldProps = {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  error?: boolean;
  yearSelection?: boolean;
  timeSelection?: boolean;
  testID?: string;
};

export function DateField({
  label,
  value,
  onChange,
  required = false,
  error = false,
  yearSelection = true,
  timeSelection = false,
  testID,
}: DateFieldProps) {
  const parsed = useMemo(() => parseDate(value), [value]);
  const sheet = useRef<SheetHandle>(null);
  const [focused, setFocused] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const initial = parsed ?? { month: new Date().getMonth() + 1, year: new Date().getFullYear() };
    return { month: initial.month, year: initial.year };
  });
  const [clock, setClock] = useState(() => parseTime(parsed?.time) ?? { hour: 0, minute: 0 });
  const [pendingDay, setPendingDay] = useState<number | null>(null);
  const pickingTime = timeSelection && pendingDay !== null;

  const open = () => {
    const next = parseDate(value);
    if (next && (next.month !== cursor.month || next.year !== cursor.year)) {
      setCursor({ month: next.month, year: next.year });
    }
    setClock(parseTime(next?.time) ?? { hour: 0, minute: 0 });
    setPendingDay(null);
    setFocused(true);
    sheet.current?.present();
  };

  const setYear = useCallback((year: number) => {
    setCursor((current) => ({ month: current.month, year }));
  }, []);

  const shiftMonth = useCallback((delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month - 1 + delta, 1);
      return { month: next.getMonth() + 1, year: next.getFullYear() };
    });
  }, []);

  const choose = useCallback(
    (day: number) => {
      if (timeSelection) {
        setPendingDay(day);
        return;
      }
      onChange?.(formatDate({ day, month: cursor.month, year: cursor.year, time: parsed?.time }));
      sheet.current?.dismiss();
    },
    [cursor, onChange, parsed, timeSelection],
  );

  const confirmTime = useCallback(() => {
    if (pendingDay === null) return;
    onChange?.(
      formatDate({ day: pendingDay, month: cursor.month, year: cursor.year, time: formatTime(clock) }),
    );
    sheet.current?.dismiss();
  }, [clock, cursor, onChange, pendingDay]);

  const setHour = useCallback((hour: number) => {
    setClock((current) => ({ ...current, hour }));
  }, []);

  const setMinute = useCallback((minute: number) => {
    setClock((current) => ({ ...current, minute }));
  }, []);

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
          {shown || (timeSelection ? 'dd/mm/aaaa hh:mm' : 'dd/mm/aaaa')}
        </AppText>
      </FieldFrame>
      <Sheet ref={sheet} onClose={() => { setFocused(false); setPendingDay(null); }} testID="date-sheet">
        {focused && !pickingTime ? (
          <MonthGrid
            month={cursor.month}
            year={cursor.year}
            selectedDay={pendingDay ?? parsed?.day ?? null}
            selectedMonth={parsed?.month ?? null}
            selectedYear={parsed?.year ?? null}
            onShift={shiftMonth}
            onChoose={choose}
            yearSelection={yearSelection}
            onYear={setYear}
          />
        ) : null}
        {focused && pickingTime ? (
          <>
            <AppText variant="subtitle" style={styles.chosen}>
              {`${pendingDay} de ${months[cursor.month - 1]} de ${cursor.year}`}
            </AppText>
            <TimePicker hour={clock.hour} minute={clock.minute} onHour={setHour} onMinute={setMinute} />
            <View style={{height: theme.space.md}} />
            <Button title="Listo" onPress={confirmTime} />
            <Button title="Cambiar fecha" variant="text" onPress={() => setPendingDay(null)} />
          </>
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
  chosen: {
    textAlign: 'center',
    // Outfit Medium leaves the digits blank on Android.
    ...outfitFont('400'),
  },
});
