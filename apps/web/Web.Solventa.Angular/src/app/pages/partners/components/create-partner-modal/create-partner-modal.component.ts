import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../../../core/interfaces/api-response.interface';
import { Alcance, Partner, PartnerCreated, PartnerType } from '../../../../core/models/partner.model';
import { PARTNER_TYPES, ALCANCES } from '../../../../shared/constants/ramos.constants';
import { ModalComponent } from '../../../../ui/components/modal/modal.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { PartnersService } from '../../services/partners.service';

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
  private readonly partnersService = inject(PartnersService);

  readonly open = input.required<boolean>();

  readonly closed = output<void>();
  readonly created = output<Partner>();

  name = signal('');
  identifier = signal('');
  tipo = signal<PartnerType>('Retailer');
  pais = signal('Colombia');
  email = signal('');
  alcances = signal<Alcance[]>(['cotizacion', 'emision']);

  errors = signal<Record<string, string>>({});
  submitError = signal<string | null>(null);
  saving = signal(false);
  createdResult = signal<PartnerCreated | null>(null);

  readonly partnerTypes = PARTNER_TYPES;
  readonly alcancesOptions = ALCANCES;

  toggleAlcance(a: Alcance) {
    this.alcances.update(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  }

  alcancesLabel(alcances: Alcance[]): string {
    return alcances.map(a => ALCANCES.find(option => option.id === a)?.label ?? a).join(', ');
  }

  reset() {
    this.name.set('');
    this.identifier.set('');
    this.tipo.set('Retailer');
    this.pais.set('Colombia');
    this.email.set('');
    this.alcances.set(['cotizacion', 'emision']);
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
          else this.submitError.set('No fue posible crear el socio. Intente de nuevo.');
        },
      });
  }

  private validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!this.name().trim()) errors['name'] = 'Requerido';

    const identifier = this.identifier().trim();
    if (!identifier) errors['identifier'] = 'Requerido';
    else if (!IDENTIFIER_PATTERN.test(identifier)) errors['identifier'] = 'Use letras, números y guiones (mínimo 2)';

    const email = this.email().trim();
    if (!email) errors['email'] = 'Requerido';
    else if (!EMAIL_PATTERN.test(email)) errors['email'] = 'Correo inválido';

    if (this.alcances().length === 0) errors['alcances'] = 'Seleccione al menos uno';
    return errors;
  }
}
