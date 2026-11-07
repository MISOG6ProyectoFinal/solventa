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
