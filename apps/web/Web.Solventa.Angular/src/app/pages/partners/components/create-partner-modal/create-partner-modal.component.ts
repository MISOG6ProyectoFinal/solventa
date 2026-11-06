import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ApiError } from '../../../../core/interfaces/api-response.interface';
import { Partner, PartnerCreated } from '../../../../core/models/partner.model';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ModalComponent } from '../../../../ui/components/modal/modal.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { PartnersService } from '../../services/partners.service';
import { LocaleService } from '../../../../core/services/locale.service';

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{1,62}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUPLICATE_IDENTIFIER = 'identificador_duplicado';

@Component({
  selector: 'slv-create-partner-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    FieldComponent,
    InputDirective,
    ButtonComponent,
    AlertComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-partner-modal.component.html'
})
export class CreatePartnerModalComponent {
  protected readonly locale = inject(LocaleService);
  private readonly partnersService = inject(PartnersService);

  readonly open = input.required<boolean>();

  readonly closed = output<void>();
  readonly created = output<Partner>();

  name = signal('');
  identifier = signal('');
  tipo = signal('');
  pais = signal('Colombia');
  email = signal('');
  alcances = signal<string[]>([]);

  errors = signal<Record<string, string>>({});
  submitError = signal<string | null>(null);
  saving = signal(false);
  createdResult = signal<PartnerCreated | null>(null);

  private readonly catalog = inject(CatalogService);
  readonly partnerTypes = toSignal(this.catalog.partnerTypes$.pipe(catchError(() => of([]))), { initialValue: [] });
  readonly alcancesOptions = toSignal(this.catalog.partnerScopes$.pipe(catchError(() => of([]))), { initialValue: [] });

  constructor() {
    effect(() => {
      const [first] = this.partnerTypes();
      if (first && !untracked(() => this.tipo())) this.tipo.set(first);
    });
  }

  toggleAlcance(a: string) {
    this.alcances.update(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  }

  alcancesLabel(alcances: string[]): string {
    return alcances.map(a => this.locale.label('scope', a)).join(', ');
  }

  reset() {
    this.name.set('');
    this.identifier.set('');
    this.tipo.set(this.partnerTypes()[0] ?? '');
    this.pais.set('Colombia');
    this.email.set('');
    this.alcances.set([]);
    this.errors.set({});
    this.submitError.set(null);
    this.saving.set(false);
    this.createdResult.set(null);
  }

  handleClose() {
    const created = this.createdResult();
    this.reset();
    if (created) this.created.emit(created.partner);
    else this.closed.emit();
  }

  submit() {
    const errors = this.validate();
    this.errors.set(errors);
    this.submitError.set(null);
    if (Object.keys(errors).length || this.saving()) return;

    this.saving.set(true);
    this.partnersService
      .create({
        name: this.name(),
        identifier: this.identifier(),
        tipo: this.tipo(),
        pais: this.pais(),
        contactEmail: this.email(),
        alcances: this.alcances(),
      })
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.createdResult.set(result);
        },
        error: (error: ApiError) => {
          this.saving.set(false);
          if (error.code === DUPLICATE_IDENTIFIER) this.errors.set({ identifier: error.message });
          else this.submitError.set(this.locale.t('createPartner.error'));
        },
      });
  }

  private validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    const required = this.locale.t('common.requiredShort');
    if (!this.name().trim()) errors['name'] = required;

    const identifier = this.identifier().trim();
    if (!identifier) errors['identifier'] = required;
    else if (!IDENTIFIER_PATTERN.test(identifier)) errors['identifier'] = this.locale.t('createPartner.identifierInvalid');

    const email = this.email().trim();
    if (!email) errors['email'] = required;
    else if (!EMAIL_PATTERN.test(email)) errors['email'] = this.locale.t('createPartner.emailInvalid');

    if (this.alcances().length === 0) errors['alcances'] = this.locale.t('createPartner.scopesRequired');
    return errors;
  }
}
