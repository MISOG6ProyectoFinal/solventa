import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Partner, Alcance } from '../../../../core/models/partner.model';
import { PARTNER_TABS } from '../../constants/partners.constants';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { TabsComponent } from '../../../../ui/components/tabs/tabs.component';
import { BadgeComponent } from '../../../../ui/components/badge/badge.component';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { RamosConfigComponent } from '../ramos-config/ramos-config.component';
import { OperacionesCanalComponent } from '../operaciones-canal/operaciones-canal.component';

@Component({
  selector: 'slv-partner-detail',
  standalone: true,
  imports: [
    CommonModule, 
    CardComponent, 
    TabsComponent, 
    BadgeComponent, 
    AlertComponent,
    ButtonComponent,
    RamosConfigComponent,
    OperacionesCanalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './partner-detail.component.html'
})
export class PartnerDetailComponent {
  readonly partner = input.required<Partner>();
  
  readonly backRequested = output<void>();
  readonly updateRequested = output<Partner>();

  readonly tabs = PARTNER_TABS;
  activeTab = signal('config');

  getAlcancesLabel(alcances: Alcance[]): string {
    const labels: Record<string, string> = {
      cotizacion: 'Cotización',
      emision: 'Emisión',
      consulta: 'Consulta de pólizas y siniestros'
    };
    return alcances.map(a => labels[a] || a).join(', ');
  }

  getContractTone(status: string): 'success' | 'error' | 'warning' {
    return status === 'Activo' ? 'success' : 'error';
  }
}
