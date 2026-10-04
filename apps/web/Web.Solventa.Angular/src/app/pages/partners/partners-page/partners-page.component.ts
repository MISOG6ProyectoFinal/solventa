import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PartnersService } from '../services/partners.service';
import { PartnerListComponent } from '../components/partner-list/partner-list.component';
import { PartnerDetailComponent } from '../components/partner-detail/partner-detail.component';
import { CreatePartnerModalComponent } from '../components/create-partner-modal/create-partner-modal.component';
import { ButtonComponent } from '../../../ui/components/button/button.component';
import { Partner } from '../../../core/models/partner.model';

@Component({
  selector: 'slv-partners-page',
  standalone: true,
  imports: [
    CommonModule,
    PartnerListComponent,
    PartnerDetailComponent,
    CreatePartnerModalComponent,
    ButtonComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './partners-page.component.html'
})
export class PartnersPageComponent {
  private readonly partnersService = inject(PartnersService);

  readonly partners = this.partnersService.partners;
  
  readonly existingIdentifiers = computed(() => 
    this.partners().map(p => p.identifier.toLowerCase())
  );

  selectedPartnerId = signal<string | null>(null);
  selectedPartner = computed(() => this.partnersService.findById(this.selectedPartnerId()));
  
  showCreateModal = signal(false);

  openPartner(id: string): void {
    this.selectedPartnerId.set(id);
  }

  closePartner(): void {
    this.selectedPartnerId.set(null);
  }

  onPartnerCreated(partner: Partner): void {
    this.partnersService.addPartner(partner);
    this.showCreateModal.set(false);
    this.selectedPartnerId.set(partner.id);
  }

  onPartnerUpdated(partner: Partner): void {
    this.partnersService.updatePartner(partner);
  }
}
