import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocaleService } from '../../../core/services/locale.service';
import { AlertComponent } from '../../../ui/components/alert/alert.component';
import { TabsComponent } from '../../../ui/components/tabs/tabs.component';
import { OpsPoliciesService } from '../services/ops-policies.service';
import { QuoteTabComponent } from '../components/quote-tab/quote-tab.component';
import { PolicyListComponent } from '../components/policy-list/policy-list.component';
import { PolicyDetailComponent } from '../components/policy-detail/policy-detail.component';
import { EndorsementModalComponent } from '../components/endorsement-modal/endorsement-modal.component';
import { CancelPolicyModalComponent } from '../components/cancel-policy-modal/cancel-policy-modal.component';

@Component({
  selector: 'slv-ops-page',
  standalone: true,
  imports: [
    CommonModule,
    AlertComponent,
    TabsComponent,
    QuoteTabComponent,
    PolicyListComponent,
    PolicyDetailComponent,
    EndorsementModalComponent,
    CancelPolicyModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ops-page.component.html'
})
export class OpsPageComponent {
  private readonly opsService = inject(OpsPoliciesService);
  protected readonly locale = inject(LocaleService);

  activeTab = signal('cotizar');
  tabs = computed(() => [
    { id: 'cotizar', label: this.locale.t('ops.tab.quote') },
    { id: 'polizas', label: this.locale.t('ops.tab.policies') },
  ]);

  selectedPolicyId = signal<string | null>(null);
  selectedPolicy = this.opsService.selected;

  policies = this.opsService.policies;
  partners = this.opsService.partners;
  loading = this.opsService.loading;
  loadError = this.opsService.loadError;

  constructor() {
    this.opsService.load();
  }

  reload(): void {
    this.opsService.load();
  }

  showEndosoModal = signal(false);
  showCancelModal = signal(false);

  searchPolicies(_text: string): void {
    // Filtrado manejado reactivamente en PolicyListComponent
  }

  openPolicy(id: string): void {
    this.selectedPolicyId.set(id);
    this.opsService.open(id);
  }

  closePolicy(): void {
    this.selectedPolicyId.set(null);
    this.opsService.open(null);
  }

  onEndorsementContinued(draft: any): void {
    // Aquí se llamaría al servicio para registrar el endoso
    this.showEndosoModal.set(false);
    console.log('Endoso registrado:', draft);
  }

  onCancellationConfirmed(cause: string): void {
    const id = this.selectedPolicy()?.id;
    if (id) {
      this.opsService.cancel(id, cause);
    }
    this.showCancelModal.set(false);
  }
}
