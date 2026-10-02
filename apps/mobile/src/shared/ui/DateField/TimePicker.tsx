import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

import { theme } from '../../theme';
import { outfitFont } from '../../theme/fonts';
import { AppText } from '../AppText';

type TimePartProps = {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function TimePart({ label, value, max, onChange }: TimePartProps) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(pad(value));

  const commit = (digits: string) => {
    if (digits !== '' && Number(digits) > max) return;
    setText(digits);
    if (digits !== '') onChange(Number(digits));
  };

  return (
    <View style={styles.part}>
      <BottomSheetTextInput
        accessibilityLabel={label}
        value={focused ? text : pad(value)}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        onFocus={() => {
          setText(pad(value));
          setFocused(true);
        }}
        onChangeText={(next) => commit(next.replace(/\D/g, '').slice(0, 2))}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.focused]}
      />
      <AppText variant="caption" accessibilityElementsHidden importantForAccessibility="no">
        {label}
      </AppText>
    </View>
  );
}

type TimePickerProps = {
  hour: number;
  minute: number;
  onHour: (hour: number) => void;
  onMinute: (minute: number) => void;
};

export function TimePicker({ hour, minute, onHour, onMinute }: TimePickerProps) {
  return (
    <View style={styles.row}>
      <TimePart label="Hora" value={hour} max={23} onChange={onHour} />
      <AppText variant="subtitle" accessibilityElementsHidden importantForAccessibility="no" style={styles.colon}>
        :
      </AppText>
      <TimePart label="Minuto" value={minute} max={59} onChange={onMinute} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: theme.space.sm,
  },
  part: {
    alignItems: 'center',
    gap: theme.space.xs,
  },
  input: {
    width: 72,
    height: 64,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    textAlign: 'center',
    fontSize: 28,
    color: theme.colors.text,
    // Outfit Medium leaves the digits blank on Android.
    ...outfitFont('400'),
  },
  focused: {
    backgroundColor: theme.colors.info.background,
    borderColor: theme.colors.info.border,
  },
  colon: {
    marginTop: theme.space.lg,
    ...outfitFont('400'),
  },
});
