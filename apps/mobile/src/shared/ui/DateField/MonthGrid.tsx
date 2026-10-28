import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '../../theme';
import { outfitFont } from '../../theme/fonts';
import { AppText } from '../AppText';
import { IconButton } from '../IconButton';
import { useTexts } from '../../texts';
import { monthLayout, yearPageStart, yearsPerPage } from './date';
import { YearGrid } from './YearGrid';

const cellHeight = 40;

type DayProps = {
  day: number;
  month: number;
  year: number;
  label: string;
  selected: boolean;
  style: StyleProp<ViewStyle>;
  onChoose: (day: number) => void;
};

const Day = memo(function Day({ day, month, year, label, selected, style, onChoose }: DayProps) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    <Pressable
      testID={`date-day-${year}-${pad(month)}-${pad(day)}`}
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
  yearSelection?: boolean;
  onYear?: (year: number) => void;
};

export const MonthGrid = memo(function MonthGrid({
  month,
  year,
  selectedDay,
  selectedMonth,
  selectedYear,
  onShift,
  onChoose,
  yearSelection = false,
  onYear,
}: MonthGridProps) {
  const { width } = useWindowDimensions();
  const cellWidth = (width - theme.space.lg * 2) / 7;
  const cellStyle = useMemo(() => [styles.cell, { width: cellWidth }], [cellWidth]);
  const selectedStyle = useMemo(() => [cellStyle, styles.selectedDay], [cellStyle]);
  const texts = useTexts();
  const monthName = texts.date.months[month - 1] ?? '';
  const monthLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)}`;
  const { lead, days, rows } = monthLayout(year, month);
  const [yearPage, setYearPage] = useState<number | null>(null);
  const pickingYear = yearSelection && yearPage !== null;

  const showPrevious = useCallback(() => {
    if (yearPage !== null) {
      setYearPage(yearPage - yearsPerPage);
      return;
    }
    onShift(-1);
  }, [onShift, yearPage]);

  const showNext = useCallback(() => {
    if (yearPage !== null) {
      setYearPage(yearPage + yearsPerPage);
      return;
    }
    onShift(1);
  }, [onShift, yearPage]);

  const toggleYears = useCallback(() => {
    setYearPage((page) => (page === null ? yearPageStart(year) : null));
  }, [year]);

  const chooseYear = useCallback(
    (nextYear: number) => {
      onYear?.(nextYear);
      setYearPage(null);
    },
    [onYear],
  );

  const title =
    yearPage === null
      ? `${monthLabel} ${year}`
      : texts.date.yearRange(yearPage, yearPage + yearsPerPage - 1);

  return (
    <>
      <View style={styles.monthRow}>
        <IconButton
          testID={pickingYear ? undefined : 'date-month-previous'}
          label={pickingYear ? texts.date.previousYears : texts.date.previousMonth}
          icon="volver"
          color="dark"
          onPress={showPrevious}
        />
        {yearSelection ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pickingYear ? texts.date.backToMonth : texts.date.changeYear}
            onPress={toggleYears}
            style={styles.monthTitleHit}
          >
            <AppText variant="subtitle" numberOfLines={1} style={styles.monthTitle}>
              {title}
            </AppText>
          </Pressable>
        ) : (
          <AppText variant="subtitle" numberOfLines={1} style={[styles.monthTitle, styles.monthTitleHit]}>
            {title}
          </AppText>
        )}
        <IconButton
          testID={pickingYear ? undefined : 'date-month-next'}
          label={pickingYear ? texts.date.nextYears : texts.date.nextMonth}
          icon="siguiente"
          color="dark"
          onPress={showNext}
        />
      </View>
      {yearPage !== null ? (
        <YearGrid start={yearPage} selectedYear={year} onChoose={chooseYear} />
      ) : (
        <View style={[styles.grid, { height: cellHeight * (1 + rows) }]}>
          {texts.date.weekdays.map((weekday, index) => (
            <View key={`${weekday}-${index}`} style={cellStyle}>
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
                month={month}
                year={year}
                label={`${day} de ${monthName} de ${year}`}
                selected={selected}
                style={selected ? selectedStyle : cellStyle}
                onChoose={onChoose}
              />
            );
          })}
        </View>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthTitleHit: {
    flex: 1,
  },
  monthTitle: {
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
