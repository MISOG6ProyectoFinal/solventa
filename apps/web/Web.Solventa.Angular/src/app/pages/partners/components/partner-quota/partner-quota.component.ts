import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ADMIN_ROLES } from '../../../../core/constants/roles.constants';
import { ApiError } from '../../../../core/interfaces/api-response.interface';
import { Partner, PartnerQuotaUsage } from '../../../../core/models/partner.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { PartnersService } from '../../services/partners.service';

@Component({
  selector: 'slv-partner-quota',
  host: { class: 'block' },
  standalone: true,
  imports: [DecimalPipe, FormsModule, AlertComponent, ButtonComponent, FieldComponent, InputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './partner-quota.component.html',
})
export class PartnerQuotaComponent {
  protected readonly locale = inject(LocaleService);
  private readonly partnersService = inject(PartnersService);
  private readonly auth = inject(AuthService);

  readonly partner = input.required<Partner>();

  protected readonly canEdit = computed(() => this.auth.hasRole(...ADMIN_ROLES));
  protected readonly usage = signal<PartnerQuotaUsage | null>(null);
  protected readonly loadError = signal(false);
  protected readonly quota = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly invalid = computed(() => {
    const quota = this.quota();
    return quota === null || !Number.isInteger(quota) || quota < 1;
  });

  private readonly partnerId = computed(() => this.partner().id);

  constructor() {
    effect(() => {
      const partner = this.partner();
      untracked(() => this.quota.set(partner.cuotaConsumo));
    });
    effect(() => {
      const partnerId = this.partnerId();
      untracked(() => this.refresh(partnerId));
    });
  }

  refresh(partnerId = this.partnerId()): void {
    this.loadError.set(false);
    this.partnersService.loadUsage(partnerId).subscribe({
      next: (usage) => this.usage.set(usage),
      error: () => {
        this.usage.set(null);
        this.loadError.set(true);
      },
    });
  }

  save(): void {
    const quota = this.quota();
    if (!this.canEdit() || this.invalid() || quota === null) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.partnersService.updateQuota(this.partnerId(), quota).subscribe({
      next: () => {
        this.saving.set(false);
        this.refresh();
      },
      error: (error: ApiError) => {
        this.saving.set(false);
        this.saveError.set(this.locale.t('partners.quota.error', { message: error.message }));
      },
    });
  }
}
