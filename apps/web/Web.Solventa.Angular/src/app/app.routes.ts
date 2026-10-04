import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { REMOTES } from './core/constants/remotes.constants';
import { RemoteLoaderService } from './core/services/remote-loader.service';
import { ShellLayoutComponent } from './layout/shell-layout/shell-layout.component';
import { RemotePlaceholderComponent } from './shared/components/remote-placeholder/remote-placeholder.component';

/** Una ruta por cada MFE registrado; si el remoto no responde se muestra el placeholder. */
const remoteRoutes: Routes = REMOTES.map((remote) => ({
  path: remote.path,
  loadComponent: () => inject(RemoteLoaderService).load(remote, RemotePlaceholderComponent),
  data: { titleKey: remote.labelKey },
}));

export const routes: Routes = [
  {
    path: '',
    component: ShellLayoutComponent,
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
        data: { titleKey: 'web.nav.partners' },
      },
      ...remoteRoutes,
      {
        path: 'settings',
        loadComponent: () => import('./layout/settings-page/settings-page.component').then((m) => m.SettingsPageComponent),
      },
      {
        path: 'design-system',
        loadComponent: () => import('./layout/design-system-page/design-system-page.component').then((m) => m.DesignSystemPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
