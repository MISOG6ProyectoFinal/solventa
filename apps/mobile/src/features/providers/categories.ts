import { theme } from '../../shared/theme';
import { type IconName } from '../../shared/ui/icons';
import { type ProviderType } from './types';

export const providerTypes: ProviderType[] = ['grua', 'taller', 'perito', 'ambulancia'];

export const categories: Record<ProviderType, { color: string; icon: IconName }> = {
  grua: { color: theme.colors.blue, icon: 'grua' },
  taller: { color: theme.colors.navy, icon: 'taller' },
  perito: { color: theme.colors.teal, icon: 'perito' },
  ambulancia: { color: theme.colors.danger, icon: 'ambulancia' },
};
