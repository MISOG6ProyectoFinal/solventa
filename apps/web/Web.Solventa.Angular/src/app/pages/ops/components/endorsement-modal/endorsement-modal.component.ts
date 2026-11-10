import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Policy } from '../../../../core/models/policy.model';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { ModalComponent } from '../../../../ui/components/modal/modal.component';
import { todayIso } from '../../utils/today.utils';
import { EndorsementDraft } from '../../interfaces/endorsement-draft.interface';
import { LocaleService } from '../../../../core/services/locale.service';

/** El mapper rellena con "-" lo que no tiene; en el formulario eso es un campo vacío. */
const clean = (value: string | undefined): string => (!value || value === '-' ? '' : value);

/** Modal "Registrar endoso": Antes (solo lectura) y Después (editable) de los datos del asegurado. */
@Component({
  selector: 'slv-endorsement-modal',
  imports: [FormsModule, ModalComponent, AlertComponent, FieldComponent, InputDirective, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './endorsement-modal.component.html',
})
export class EndorsementModalComponent {
  protected readonly locale = inject(LocaleService);
  readonly policy = input.required<Policy>();
  /** Error de negocio del backend al guardar, si lo hubo. */
  readonly error = input<string | null>(null);

  readonly closed = output<void>();
  readonly saved = output<EndorsementDraft>();

  protected readonly before = computed(() => ({
    name: clean(this.policy().insuredName),
    phone: clean(this.policy().phone),
    email: clean(this.policy().email),
    address: clean(this.policy().address),
  }));

  protected readonly effectiveDate = signal(todayIso());
  protected readonly name = linkedSignal(() => this.before().name);
  protected readonly phone = linkedSignal(() => this.before().phone);
  protected readonly email = linkedSignal(() => this.before().email);
  protected readonly address = linkedSignal(() => this.before().address);
  protected readonly reason = signal('');

  private readonly submitted = signal(false);

  /** Guardar solo se habilita si algún campo difiere del valor original. */
  protected readonly changed = computed(() => {
    const before = this.before();
    return (
      this.name().trim() !== before.name ||
      this.phone().trim() !== before.phone ||
      this.email().trim() !== before.email ||
      this.address().trim() !== before.address
    );
  });

  protected readonly reasonError = computed(() =>
    this.submitted() && !this.reason().trim() ? this.locale.t('endorsement.reasonRequired') : '',
  );
  protected readonly dateError = computed(() => {
    const date = this.effectiveDate();
    if (!date) return this.submitted() ? this.locale.t('endorsement.dateRequired') : '';
    const { startDate, endDate } = this.policy();
    return date < startDate || date > endDate
      ? this.locale.t('endorsement.dateOutOfRange', { start: startDate, end: endDate })
      : '';
  });

  protected submit(): void {
    this.submitted.set(true);
    if (!this.changed() || this.reasonError() || this.dateError() || !this.name().trim()) return;

    this.saved.emit({
      effectiveDate: this.effectiveDate(),
      name: this.name().trim(),
      phone: this.phone().trim(),
      email: this.email().trim(),
      address: this.address().trim(),
      reason: this.reason().trim(),
    });
  }
}
