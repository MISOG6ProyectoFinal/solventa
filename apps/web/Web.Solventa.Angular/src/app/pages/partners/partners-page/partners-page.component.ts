import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PartnersService } from '../services/partners.service';
import { PartnerListComponent } from '../components/partner-list/partner-list.component';
import { PartnerDetailComponent } from '../components/partner-detail/partner-detail.component';
import { CreatePartnerModalComponent } from '../components/create-partner-modal/create-partner-modal.component';
import { ButtonComponent } from '../../../ui/components/button/button.component';
import { AlertComponent } from '../../../ui/components/alert/alert.component';
import { Partner } from '../../../core/models/partner.model';

@Component({
  selector: 'slv-partners-page',
  standalone: true,
  imports: [
    CommonModule,
    PartnerListComponent,
    PartnerDetailComponent,
    CreatePartnerModalComponent,
    ButtonComponent,
    AlertComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './partners-page.component.html'
})
export class PartnersPageComponent implements OnInit {
  private readonly partnersService = inject(PartnersService);

  readonly partners = this.partnersService.partners;
  readonly loading = this.partnersService.loading;
  readonly loadError = this.partnersService.loadError;

  selectedPartnerId = signal<string | null>(null);
  selectedPartner = computed(() => this.partnersService.findById(this.selectedPartnerId()));
  
  showCreateModal = signal(false);

  ngOnInit(): void {
    this.partnersService.load();
  }

  reload(): void {
    this.partnersService.load();
  }

  openPartner(id: string): void {
    this.selectedPartnerId.set(id);
  }

  closePartner(): void {
    this.selectedPartnerId.set(null);
  }

  onPartnerCreated(partner: Partner): void {
    this.showCreateModal.set(false);
    this.selectedPartnerId.set(partner.id);
  }

  onPartnerUpdated(partner: Partner): void {
    this.partnersService.updatePartner(partner);
  }
}
