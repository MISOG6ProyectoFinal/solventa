/** Tokens del DS Solventa (espejo de `ds` en `src/web/ui.tsx` de los mockups). */
export const DS = {
  primary: '#163A5F',
  secondary: '#2878B5',
  accent: '#28A6A1',
  bg: '#F5F8FA',
  text: '#1D2733',
  white: '#FFFFFF',
  border: '#D4DEE6',
  muted: '#5A6A7A',
  mutedBg: '#E8EEF2',
  success: '#28A6A1',
  warning: '#E8A838',
  error: '#C45C5C',
  info: '#2878B5',
  onPrimaryMuted: '#9BB8D0',
} as const;

export type Tone = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'primary';
export type AlertTone = 'success' | 'warning' | 'error' | 'info';
export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'danger' | 'ghost';

export interface Swatch {
  readonly name: string;
  readonly token: string;
  readonly hex: string;
  readonly role: string;
}

export const BRAND_SWATCHES: readonly Swatch[] = [
  { name: 'Primary', token: '--primary', hex: '#163A5F', role: 'Headers, botones primarios, nav activo' },
  { name: 'Primary light', token: '--primary-light', hex: '#2878B5', role: 'Hover / enlaces' },
  { name: 'Primary dark', token: '--primary-dark', hex: '#0F2A45', role: 'Estado pressed' },
  { name: 'Secondary', token: '--secondary', hex: '#2878B5', role: 'CTAs, enlaces, información' },
  { name: 'Secondary light', token: '--secondary-light', hex: '#5A9BC9', role: 'Soft fill' },
  { name: 'Secondary dark', token: '--secondary-dark', hex: '#1E5A8A', role: 'Pressed' },
  { name: 'Accent', token: '--accent', hex: '#28A6A1', role: 'Énfasis, éxito, highlights' },
  { name: 'Accent light', token: '--accent-light', hex: '#5CBCB8', role: 'Soft fill' },
  { name: 'Accent dark', token: '--accent-dark', hex: '#1E7D79', role: 'Pressed' },
];

export const NEUTRAL_SWATCHES: readonly Swatch[] = [
  { name: 'Background', token: '--background', hex: '#F5F8FA', role: 'Fondo de página' },
  { name: 'Foreground', token: '--foreground', hex: '#1D2733', role: 'Texto principal' },
  { name: 'Card', token: '--card', hex: '#FFFFFF', role: 'Superficies de tarjeta' },
  { name: 'Muted', token: '--muted', hex: '#E8EEF2', role: 'Hover, disabled' },
  { name: 'Muted foreground', token: '--muted-foreground', hex: '#5A6A7A', role: 'Texto secundario' },
  { name: 'Border', token: '--border', hex: '#D4DEE6', role: 'Bordes y separadores' },
  { name: 'On primary muted', token: '--on-primary-muted', hex: '#9BB8D0', role: 'Texto sobre azul primario' },
];

export interface StatusSwatch {
  readonly name: string;
  readonly base: string;
  readonly surface: string;
  readonly border: string;
  readonly text: string;
}

export const STATUS_SWATCHES: readonly StatusSwatch[] = [
  { name: 'Success', base: '#28A6A1', surface: '#E6F6F5', border: '#A8DED9', text: '#1E7D79' },
  { name: 'Info', base: '#2878B5', surface: '#EAF3FA', border: '#B8D4EA', text: '#1E5A8A' },
  { name: 'Warning', base: '#E8A838', surface: '#FFF8EB', border: '#F0D9A0', text: '#8A6A10' },
  { name: 'Error', base: '#C45C5C', surface: '#FDF0F0', border: '#E8B8B8', text: '#8A3A3A' },
];
