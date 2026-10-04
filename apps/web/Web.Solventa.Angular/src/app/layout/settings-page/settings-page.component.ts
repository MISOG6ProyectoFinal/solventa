import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InputDirective } from '../../shared/directives/input.directive';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { Locale, LocaleService } from '../../core/services/locale.service';
import { CardComponent } from '../../ui/components/card/card.component';
import { FieldComponent } from '../../ui/components/field/field.component';

/** Ajustes: sección de idioma. Réplica de `Ajustes.tsx`. */
@Component({
  selector: 'slv-settings-page',
  imports: [RouterLink, PageHeaderComponent, CardComponent, FieldComponent, InputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings-page.component.html',
})
export class SettingsPageComponent {
  protected readonly locale = inject(LocaleService);

  protected onLocaleChange(event: Event): void {
    this.locale.setLocale((event.target as HTMLSelectElement).value as Locale);
  }
}
