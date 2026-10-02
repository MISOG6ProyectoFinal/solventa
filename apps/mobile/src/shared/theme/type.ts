import { TextStyle } from 'react-native';

import { colors } from './colors';
import { font, outfitFont } from './fonts';

const fraunces = font('Fraunces-SemiBold', '600');
const frauncesText = font('FrauncesText-SemiBold', '600');

export const type = {
  greeting: {
    ...frauncesText,
    fontSize: 24,
    lineHeight: 32,
    color: colors.text,
  },
  screenTitle: {
    ...fraunces,
    fontSize: 48,
    lineHeight: 60,
    color: colors.text,
  },
  sectionTitle: {
    ...outfitFont('500'),
    fontSize: 18,
    lineHeight: 28,
    color: colors.text,
  },
  label: {
    ...outfitFont('400'),
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  labelAccent: {
    ...outfitFont('400'),
    fontSize: 11,
    lineHeight: 16.5,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: colors.blue,
  },
  body: {
    ...outfitFont('400'),
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  bodyMedium: {
    ...outfitFont('500'),
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  value: {
    ...outfitFont('600'),
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  bodySmall: {
    ...outfitFont('400'),
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  button: {
    ...outfitFont('600'),
    fontSize: 14,
    lineHeight: 20,
    color: colors.onNavy,
  },
  amount: {
    ...fraunces,
    fontSize: 48,
    lineHeight: 48,
    color: colors.text,
  },
  caption: {
    ...outfitFont('500'),
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
} as const satisfies Record<string, TextStyle>;
