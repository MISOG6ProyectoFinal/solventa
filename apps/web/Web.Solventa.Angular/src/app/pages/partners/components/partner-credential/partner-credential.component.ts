import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ADMIN_ROLES } from '../../../../core/constants/roles.constants';
import { ApiError } from '../../../../core/interfaces/api-response.interface';
import { CredentialEvent, Partner } from '../../../../core/models/partner.model';
import { AuthService } from '../../../../core/services/auth.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { PartnersService } from '../../services/partners.service';

export const DEFAULT_GRACE_MINUTES = 1440;
const MAX_GRACE_MINUTES = 10_080;

@Component({
  selector: 'slv-partner-credential',
  standalone: true,
  imports: [FormsModule, AlertComponent, ButtonComponent, FieldComponent, InputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './partner-credential.component.html',
})
export class PartnerCredentialComponent {
  protected readonly locale = inject(LocaleService);
  private readonly partnersService = inject(PartnersService);
  private readonly auth = inject(AuthService);

  readonly partner = input.required<Partner>();

  protected readonly canEdit = computed(() => this.auth.hasRole(...ADMIN_ROLES));
  protected readonly events = signal<CredentialEvent[]>([]);
  protected readonly graceMinutes = signal<number | null>(DEFAULT_GRACE_MINUTES);
  protected readonly newSecret = signal<string | null>(null);
  protected readonly confirmingRevocation = signal(false);
  protected readonly working = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly invalidGrace = computed(() => {
    const minutes = this.graceMinutes();
    return minutes === null || !Number.isInteger(minutes) || minutes < 0 || minutes > MAX_GRACE_MINUTES;
  });

  private readonly partnerId = computed(() => this.partner().id);

  constructor() {
    effect(() => {
      const partnerId = this.partnerId();
      untracked(() => {
        this.newSecret.set(null);
        this.confirmingRevocation.set(false);
        this.error.set(null);
        this.loadEvents(partnerId);
      });
    });
  }

  eventLabel(event: CredentialEvent): string {
    return this.locale.t('partners.credentialEvent', {
      type: this.locale.label('credentialEvent', event.type),
      actor: event.actor,
      date: event.date,
    });
  }

  rotate(): void {
    const minutes = this.graceMinutes();
    if (!this.canEdit() || this.invalidGrace() || minutes === null) return;
    this.start();
    this.partnersService.rotateCredential(this.partnerId(), minutes).subscribe({
      next: ({ secret }) => {
        this.newSecret.set(secret);
        this.finish();
      },
      error: (error: ApiError) => this.fail(error),
    });
  }

  revoke(): void {
    if (!this.canEdit()) return;
    if (!this.confirmingRevocation()) {
      this.confirmingRevocation.set(true);
      return;
    }
    this.start();
    this.partnersService.revokeCredential(this.partnerId()).subscribe({
      next: () => {
        this.newSecret.set(null);
        this.finish();
      },
      error: (error: ApiError) => this.fail(error),
    });
  }

  cancelRevocation(): void {
    this.confirmingRevocation.set(false);
  }

  private loadEvents(partnerId: string): void {
    this.partnersService.loadCredentialEvents(partnerId).subscribe({
      next: (events) => this.events.set(events),
      error: () => this.events.set([]),
    });
  }

  private start(): void {
    this.working.set(true);
    this.error.set(null);
  }

  private finish(): void {
    this.working.set(false);
    this.confirmingRevocation.set(false);
    this.loadEvents(this.partnerId());
  }

  private fail(error: ApiError): void {
    this.working.set(false);
    this.error.set(this.locale.t('partners.credentialError', { message: error.message }));
  }
}
