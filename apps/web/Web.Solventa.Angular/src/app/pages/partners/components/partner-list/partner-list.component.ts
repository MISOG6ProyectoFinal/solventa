import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Partner, PartnerRamo } from '../../../../core/models/partner.model';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { BadgeComponent } from '../../../../ui/components/badge/badge.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';

@Component({
  selector: 'slv-partner-list',
  standalone: true,
  imports: [CommonModule, CardComponent, BadgeComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './partner-list.component.html'
})
export class PartnerListComponent {
  readonly partners = input.required<readonly Partner[]>();
  readonly opened = output<string>();

  getAlcancesLabel(alcances: string[]): string {
    const labels: Record<string, string> = {
      cotizacion: 'Cotización',
      emision: 'Emisión',
      consulta: 'Consulta de pólizas y siniestros'
    };
    return alcances.map(a => labels[a] || a).join(', ');
  }

  getRamosLabel(ramos: PartnerRamo[]): string {
    return ramos.map(ramo => ramo.name).join(', ') || '-';
  }

  getContractTone(status: string): 'success' | 'error' | 'warning' {
    return status === 'Activo' ? 'success' : 'error';
  }
}
