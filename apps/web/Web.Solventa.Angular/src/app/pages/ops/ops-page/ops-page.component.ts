import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { EndorsementDraft } from '../interfaces/endorsement-draft.interface';
import { LocaleService } from '../../../core/services/locale.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
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
    PageHeaderComponent,
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
  endorsementError = signal<string | null>(null);
  showCancelModal = signal(false);
  cancellationError = signal<string | null>(null);

  searchPolicies(_text: string): void {
    // Filtrado manejado reactivamente en PolicyListComponent
  }

  openPolicy(id: string): void {
    this.selectedPolicyId.set(id);
    this.opsService.open(id);
  }

  closePolicy(): void {
    this.selectedPolicyId.set(null);
    this.cancellationError.set(null);
    this.endorsementError.set(null);
    this.opsService.open(null);
  }

  onEndorsementSaved(draft: EndorsementDraft): void {
    const id = this.selectedPolicy()?.id;
    if (!id) return;
    this.endorsementError.set(null);
    this.opsService.registerEndorsement(id, draft).subscribe({
      next: () => this.showEndosoModal.set(false),
      error: (error: ApiError) => this.endorsementError.set(error.message),
    });
  }

  onCancellationConfirmed(cause: string): void {
    const id = this.selectedPolicy()?.id;
    if (!id) return;
    this.cancellationError.set(null);
    this.opsService.cancel(id, cause).subscribe({
      next: () => {
        this.showCancelModal.set(false);
        this.cancellationError.set(null);
      },
      error: (error: ApiError) => this.cancellationError.set(error.message),
    });
  }
}
