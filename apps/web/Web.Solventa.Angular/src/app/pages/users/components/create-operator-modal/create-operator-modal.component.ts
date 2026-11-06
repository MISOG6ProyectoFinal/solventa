import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from '../../../../core/interfaces/api-response.interface';
import { Operator, OperatorRole } from '../../../../core/models/operator.model';
import { LocaleService } from '../../../../core/services/locale.service';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { isEmail } from '../../../../shared/utils/validators';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { ModalComponent } from '../../../../ui/components/modal/modal.component';
import { OperatorsService } from '../../services/operators.service';
import { RoleSelectComponent } from '../role-select/role-select.component';

const MIN_PASSWORD_LENGTH = 8;
const CONFLICT = 409;
const UNPROCESSABLE = 422;

@Component({
  selector: 'slv-create-operator-modal',
  imports: [FormsModule, ModalComponent, FieldComponent, InputDirective, ButtonComponent, AlertComponent, RoleSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-operator-modal.component.html',
})
export class CreateOperatorModalComponent {
  protected readonly locale = inject(LocaleService);
  private readonly operatorsService = inject(OperatorsService);

  readonly open = input.required<boolean>();

  readonly closed = output<void>();
  readonly created = output<Operator>();

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly roles = signal<readonly OperatorRole[]>(['consulta']);

  protected readonly errors = signal<Record<string, string>>({});
  protected readonly submitError = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected close(): void {
    this.reset();
    this.closed.emit();
  }

  protected submit(): void {
    const errors = this.validate();
    this.errors.set(errors);
    this.submitError.set(null);
    if (Object.keys(errors).length || this.saving()) return;

    this.saving.set(true);
    this.operatorsService
      .create({ email: this.email().trim(), name: this.name().trim(), roles: this.roles(), password: this.password() })
      .subscribe({
        next: (operator) => {
          this.reset();
          this.created.emit(operator);
        },
        error: (error: ApiError) => {
          this.saving.set(false);
          const showsBackendMessage = error.status === CONFLICT || error.status === UNPROCESSABLE;
          this.submitError.set(showsBackendMessage ? error.message : this.locale.t('createOperator.error'));
        },
      });
  }

  private reset(): void {
    this.name.set('');
    this.email.set('');
    this.password.set('');
    this.roles.set(['consulta']);
    this.errors.set({});
    this.submitError.set(null);
    this.saving.set(false);
  }

  private validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    const required = this.locale.t('common.requiredShort');
    if (!this.name().trim()) errors['name'] = required;

    const email = this.email().trim();
    if (!email) errors['email'] = required;
    else if (!isEmail(email)) errors['email'] = this.locale.t('createOperator.emailInvalid');

    if (!this.password()) errors['password'] = required;
    else if (this.password().length < MIN_PASSWORD_LENGTH) errors['password'] = this.locale.t('createOperator.credentialShort');

    if (this.roles().length === 0) errors['roles'] = this.locale.t('createOperator.rolesRequired');
    return errors;
  }
}
