import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  activeTab = signal('cotizar');
  tabs = signal([
    { id: 'cotizar', label: 'Cotización' },
    { id: 'polizas', label: 'Consulta de pólizas' }
  ]);

  selectedPolicy = this.opsService.selected;
  loadError = this.opsService.loadError;

  policies = this.opsService.policies;
  partners = this.opsService.partners;

  showEndosoModal = signal(false);
  showCancelModal = signal(false);

  searchPolicies(text: string): void {
    this.opsService.search(text);
  }

  openPolicy(id: string): void {
    this.opsService.open(id);
  }

  closePolicy(): void {
    this.opsService.close();
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
