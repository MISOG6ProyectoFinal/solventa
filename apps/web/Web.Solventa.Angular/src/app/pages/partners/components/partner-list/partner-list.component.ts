import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Partner, PartnerRamo } from '../../../../core/models/partner.model';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { BadgeComponent } from '../../../../ui/components/badge/badge.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { LocaleService } from '../../../../core/services/locale.service';

@Component({
  selector: 'slv-partner-list',
  host: { class: 'block' },
  standalone: true,
  imports: [CommonModule, CardComponent, BadgeComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './partner-list.component.html'
})
export class PartnerListComponent {
  protected readonly locale = inject(LocaleService);
  readonly partners = input.required<readonly Partner[]>();
  readonly opened = output<string>();

  getAlcancesLabel(alcances: string[]): string {
    return alcances.map(a => this.locale.label('scope', a)).join(', ');
  }

  getRamosLabel(ramos: PartnerRamo[]): string {
    return ramos.map(ramo => this.locale.label('ramoApi', ramo.id, ramo.name)).join(', ') || '-';
  }

  getContractTone(status: string): 'success' | 'error' | 'warning' {
    return status === 'Activo' ? 'success' : 'error';
  }
}
