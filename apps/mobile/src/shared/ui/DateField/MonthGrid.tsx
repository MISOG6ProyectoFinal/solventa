import { memo, useCallback, useMemo, type StyleProp, type ViewStyle } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { theme } from '../../theme';
import { outfitFont } from '../../theme/fonts';
import { AppText } from '../AppText';
import { IconButton } from '../IconButton';
import { monthLabels, monthLayout, months } from './date';

const weekdays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const cellHeight = 40;

type DayProps = {
  day: number;
  label: string;
  selected: boolean;
  style: StyleProp<ViewStyle>;
  onChoose: (day: number) => void;
};

const Day = memo(function Day({ day, label, selected, style, onChoose }: DayProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => onChoose(day)}
      style={style}
    >
      <AppText variant="bodySmall" style={styles.dayLabel}>
        {day}
      </AppText>
    </Pressable>
  );
});

type MonthGridProps = {
  month: number;
  year: number;
  selectedDay: number | null;
  selectedMonth: number | null;
  selectedYear: number | null;
  onShift: (delta: number) => void;
  onChoose: (day: number) => void;
};

export const MonthGrid = memo(function MonthGrid({
  month,
  year,
  selectedDay,
  selectedMonth,
  selectedYear,
  onShift,
  onChoose,
}: MonthGridProps) {
  const { width } = useWindowDimensions();
  const cellWidth = (width - theme.space.lg * 2) / 7;
  const cellStyle = useMemo(() => [styles.cell, { width: cellWidth }], [cellWidth]);
  const selectedStyle = useMemo(() => [cellStyle, styles.selectedDay], [cellStyle]);
  const monthName = months[month - 1];
  const { lead, days, rows } = monthLayout(year, month);
  const showPrevious = useCallback(() => onShift(-1), [onShift]);
  const showNext = useCallback(() => onShift(1), [onShift]);

  return (
    <>
      <View style={styles.monthRow}>
        <IconButton label="Mes anterior" icon="volver" color="dark" onPress={showPrevious} />
        <AppText variant="subtitle" numberOfLines={1} style={styles.monthTitle}>
          {`${monthLabels[month - 1]} ${year}`}
        </AppText>
        <IconButton label="Mes siguiente" icon="siguiente" color="dark" onPress={showNext} />
      </View>
      <View style={[styles.grid, { height: cellHeight * (1 + rows) }]}>
        {weekdays.map((weekday) => (
          <View key={weekday} style={cellStyle}>
            <AppText variant="caption" style={styles.weekday}>
              {weekday}
            </AppText>
          </View>
        ))}
        {lead > 0 ? <View style={{ width: cellWidth * lead, height: cellHeight }} /> : null}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const selected = selectedDay === day && selectedMonth === month && selectedYear === year;

          return (
            <Day
              key={day}
              day={day}
              label={`${day} de ${monthName} de ${year}`}
              selected={selected}
              style={selected ? selectedStyle : cellStyle}
              onChoose={onChoose}
            />
          );
        })}
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthTitle: {
    flex: 1,
    textAlign: 'center',
    // Outfit Medium leaves the digits blank on Android.
    ...outfitFont('400'),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    height: cellHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.medium,
  },
  weekday: {
    textAlign: 'center',
    color: theme.colors.textMuted,
  },
  selectedDay: {
    backgroundColor: theme.colors.info.background,
  },
  dayLabel: {
    color: theme.colors.text,
  },
});
