import { RemoteConfig } from '../interfaces/remote-config.interface';
import { PARTNERS_ROLES, USERS_ROLES } from './roles.constants';

/** Micro Frontends registrados. Agregar aquí un remoto nuevo (y en `public/federation.manifest.json`). */
export const REMOTES: readonly RemoteConfig[] = [
  {
    name: 'ops-polizas',
    exposed: './Component',
    path: 'ops',
    labelKey: 'web.nav.ops',
    icon: 'polizas',
    testId: 'nav-operaciones',
  },
  {
    name: 'socios-integraciones',
    exposed: './Component',
    path: 'partners',
    labelKey: 'web.nav.partners',
    icon: 'socios',
    testId: 'nav-socios',
    roles: PARTNERS_ROLES,
  },
  {
    name: 'usuarios',
    exposed: './Component',
    path: 'usuarios',
    labelKey: 'web.nav.users',
    icon: 'usuario',
    testId: 'nav-usuarios',
    roles: USERS_ROLES,
  },
];
