import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Partner } from '../../../../core/models/partner.model';
import { RAMOS } from '../../../../shared/constants/ramos.constants';
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

  getRamosLabel(ramosIds: string[]): string {
    if (!ramosIds || ramosIds.length === 0) return '-';
    return ramosIds.map(id => RAMOS.find(r => r.id === id)?.label ?? id).join(', ');
  }

  getContractTone(status: string): 'success' | 'error' | 'warning' {
    return status === 'Activo' ? 'success' : 'error';
  }
}
