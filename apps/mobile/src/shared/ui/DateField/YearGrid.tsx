import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '../../theme';
import { AppText } from '../AppText';
import { yearsPerPage } from './date';

const columns = 3;
const cellHeight = 40;

type YearProps = {
  year: number;
  selected: boolean;
  style: StyleProp<ViewStyle>;
  onChoose: (year: number) => void;
};

const Year = memo(function Year({ year, selected, style, onChoose }: YearProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Año ${year}`}
      accessibilityState={{ selected }}
      onPress={() => onChoose(year)}
      style={style}
    >
      <AppText variant="bodySmall" style={styles.label}>
        {year}
      </AppText>
    </Pressable>
  );
});

type YearGridProps = {
  start: number;
  selectedYear: number;
  onChoose: (year: number) => void;
};

export const YearGrid = memo(function YearGrid({ start, selectedYear, onChoose }: YearGridProps) {
  const { width } = useWindowDimensions();
  const cellWidth = (width - theme.space.lg * 2) / columns;
  const cellStyle = useMemo(() => [styles.cell, { width: cellWidth }], [cellWidth]);
  const selectedStyle = useMemo(() => [cellStyle, styles.selected], [cellStyle]);

  return (
    <View style={[styles.grid, { height: cellHeight * (yearsPerPage / columns) }]}>
      {Array.from({ length: yearsPerPage }, (_, index) => {
        const year = start + index;

        return (
          <Year
            key={year}
            year={year}
            selected={year === selectedYear}
            style={year === selectedYear ? selectedStyle : cellStyle}
            onChoose={onChoose}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
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
  selected: {
    backgroundColor: theme.colors.info.background,
  },
  label: {
    color: theme.colors.text,
  },
});
