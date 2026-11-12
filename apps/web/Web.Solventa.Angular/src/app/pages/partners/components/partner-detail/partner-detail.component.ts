import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Partner } from '../../../../core/models/partner.model';
import { PARTNER_TABS } from '../../constants/partners.constants';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { TabsComponent } from '../../../../ui/components/tabs/tabs.component';
import { BadgeComponent } from '../../../../ui/components/badge/badge.component';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { RamosConfigComponent } from '../ramos-config/ramos-config.component';
import { OperacionesCanalComponent } from '../operaciones-canal/operaciones-canal.component';
import { PartnerQuotaComponent } from '../partner-quota/partner-quota.component';
import { LocaleService } from '../../../../core/services/locale.service';

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
    OperacionesCanalComponent,
    PartnerQuotaComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './partner-detail.component.html'
})
export class PartnerDetailComponent {
  protected readonly locale = inject(LocaleService);
  readonly partner = input.required<Partner>();
  
  readonly backRequested = output<void>();

  readonly tabs = computed(() => PARTNER_TABS.map((tab) => ({ id: tab.id, label: this.locale.t(tab.labelKey) })));
  activeTab = signal('config');

  getAlcancesLabel(alcances: string[]): string {
    return alcances.map(a => this.locale.label('scope', a)).join(', ');
  }

  getContractTone(status: string): 'success' | 'error' | 'warning' {
    return status === 'Activo' ? 'success' : 'error';
  }
}
