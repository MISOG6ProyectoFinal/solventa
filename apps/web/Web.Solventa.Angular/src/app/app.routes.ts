import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { PARTNERS_ROLES, USERS_ROLES } from './core/constants/roles.constants';
import { REMOTES } from './core/constants/remotes.constants';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { RemoteLoaderService } from './core/services/remote-loader.service';
import { ShellLayoutComponent } from './layout/shell-layout/shell-layout.component';
import { RemotePlaceholderComponent } from './shared/components/remote-placeholder/remote-placeholder.component';

/** Una ruta por cada MFE registrado; si el remoto no responde se muestra el placeholder. */
const remoteRoutes: Routes = REMOTES.map((remote) => ({
  path: remote.path,
  loadComponent: () => inject(RemoteLoaderService).load(remote, RemotePlaceholderComponent),
  canActivate: [roleGuard],
  data: { titleKey: remote.labelKey, roles: remote.roles },
}));

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: '',
    component: ShellLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: REMOTES[0].path, pathMatch: 'full' },
      {
        path: 'ops',
        loadComponent: () => import('./pages/ops/ops-page/ops-page.component').then((m) => m.OpsPageComponent),
        data: { titleKey: 'web.nav.ops' },
      },
      {
        path: 'partners',
        loadComponent: () => import('./pages/partners/partners-page/partners-page.component').then((m) => m.PartnersPageComponent),
        canActivate: [roleGuard],
        data: { titleKey: 'web.nav.partners', roles: PARTNERS_ROLES },
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./pages/users/users-page/users-page.component').then((m) => m.UsersPageComponent),
        canActivate: [roleGuard],
        data: { titleKey: 'web.nav.users', roles: USERS_ROLES },
      },
      ...remoteRoutes,
      {
        path: 'settings',
        loadComponent: () => import('./layout/settings-page/settings-page.component').then((m) => m.SettingsPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
