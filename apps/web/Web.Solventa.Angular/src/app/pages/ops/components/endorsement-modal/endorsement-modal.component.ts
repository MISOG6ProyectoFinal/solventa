import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Policy } from '../../../../core/models/policy.model';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { ModalComponent } from '../../../../ui/components/modal/modal.component';
import { ENDORSEMENT_TYPES, OPS_TODAY } from '../../constants/ops.constants';
import { EndorsementDraft } from '../../interfaces/endorsement-draft.interface';

/** Modal "Registrar endoso": paso de edición de los datos del asegurado. */
@Component({
  selector: 'slv-endorsement-modal',
  imports: [FormsModule, ModalComponent, AlertComponent, FieldComponent, InputDirective, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './endorsement-modal.component.html',
})
export class EndorsementModalComponent {
  readonly policy = input.required<Policy>();

  readonly closed = output<void>();
  readonly continued = output<EndorsementDraft>();

  protected readonly types = ENDORSEMENT_TYPES;
  protected readonly type = signal(ENDORSEMENT_TYPES[0].id);
  protected readonly effectiveDate = signal(OPS_TODAY);
  protected readonly phone = linkedSignal(() => this.policy().phone);
  protected readonly email = linkedSignal(() => this.policy().email);
  protected readonly address = linkedSignal(() => this.policy().address ?? '');
  protected readonly reason = signal('');

  private readonly submitted = signal(false);

  protected readonly reasonError = computed(() =>
    this.submitted() && !this.reason().trim() ? 'El motivo del endoso es obligatorio.' : '',
  );
  protected readonly dateError = computed(() =>
    this.submitted() && !this.effectiveDate() ? 'La fecha efectiva es obligatoria.' : '',
  );

  protected submit(): void {
    this.submitted.set(true);
    if (this.reasonError() || this.dateError()) return;

    this.continued.emit({
      type: this.type(),
      effectiveDate: this.effectiveDate(),
      phone: this.phone(),
      email: this.email(),
      address: this.address(),
      reason: this.reason().trim(),
    });
  }
}
