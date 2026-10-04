import { Injectable, signal } from '@angular/core';

/** Estado del shell (sidebar y menú de perfil) como signals. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly sidebarOpen = signal(true);
  readonly profileOpen = signal(false);

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  toggleProfile(): void {
    this.profileOpen.update((v) => !v);
  }

  closeProfile(): void {
    this.profileOpen.set(false);
  }
}
