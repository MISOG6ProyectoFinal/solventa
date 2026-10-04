import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { REMOTES } from '../../core/constants/remotes.constants';
import { LayoutService } from '../../core/services/layout.service';
import { LocaleService } from '../../core/services/locale.service';
import { IconComponent } from '../../ui/components/icon/icon.component';
import { LogoComponent } from '../../ui/components/logo/logo.component';

/** Shell: header sticky + sidebar (`w-56`) + área de contenido. Idéntico a `WebApp` del mockup. */
@Component({
  selector: 'slv-shell-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:mousedown)': 'onDocumentMouseDown($event)' },
  templateUrl: './shell-layout.component.html',
})
export class ShellLayoutComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly locale = inject(LocaleService);
  private readonly router = inject(Router);

  protected readonly remotes = REMOTES;

  private readonly profile = viewChild.required<ElementRef<HTMLElement>>('profile');

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Como en el mockup, el sidebar se oculta en la pantalla de Ajustes. */
  protected readonly showSidebar = computed(() => this.layout.sidebarOpen() && !this.url().startsWith('/settings'));

  protected onDocumentMouseDown(event: MouseEvent): void {
    if (this.layout.profileOpen() && !this.profile().nativeElement.contains(event.target as Node)) {
      this.layout.closeProfile();
    }
  }
}
