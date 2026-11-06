import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Policy } from '../../../../core/models/policy.model';
import { CLAIM_STATUS_TONE, PAYMENT_STATUS_TONE, POLICY_STATUS_TONE } from '../../../../shared/constants/status-tone.constants';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { BadgeComponent } from '../../../../ui/components/badge/badge.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { TabsComponent } from '../../../../ui/components/tabs/tabs.component';
import { DETAIL_TABS } from '../../constants/ops.constants';
import { LocaleService } from '../../../../core/services/locale.service';

interface InfoItem {
  readonly label: string;
  readonly value: string;
}

/** Detalle de una póliza: acciones, resumen y pestañas (asegurado, coberturas, pagos, siniestros). */
@Component({
  selector: 'slv-policy-detail',
  imports: [AlertComponent, BadgeComponent, ButtonComponent, CardComponent, TabsComponent, CopCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './policy-detail.component.html',
})
export class PolicyDetailComponent {
  protected readonly locale = inject(LocaleService);
  readonly policy = input.required<Policy>();

  readonly backRequested = output<void>();
  readonly endorsementRequested = output<void>();
  readonly cancellationRequested = output<void>();

  protected readonly tabs = computed(() => DETAIL_TABS.map((tab) => ({ id: tab.id, label: this.locale.t(tab.labelKey) })));
  protected readonly statusTone = POLICY_STATUS_TONE;
  protected readonly paymentTone = PAYMENT_STATUS_TONE;
  protected readonly claimTone = CLAIM_STATUS_TONE;

  protected readonly activeTab = signal<string>(DETAIL_TABS[0].id);

  protected readonly isActive = computed(() => this.policy().status === 'Activa');

  private readonly currency = new CopCurrencyPipe();

  protected readonly insuredInfo = computed<readonly InfoItem[]>(() => {
    const policy = this.policy();
    const items: InfoItem[] = [
      { label: this.locale.t('policy.info.name'), value: policy.insuredName },
      { label: this.locale.t('policy.info.id'), value: `${policy.tipoDocumento} ${policy.identification}` },
      { label: this.locale.t('policy.info.email'), value: policy.email },
      { label: this.locale.t('policy.info.phone'), value: policy.phone },
      { label: this.locale.t('policy.info.address'), value: policy.address ?? '-' },
      { label: this.locale.t('policy.info.premium'), value: this.currency.transform(policy.premium) },
    ];
    if (policy.sumaAsegurada !== undefined) {
      items.push({ label: this.locale.t('policy.info.insuredSum'), value: this.currency.transform(policy.sumaAsegurada) });
    }
    return items;
  });
}
