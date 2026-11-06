import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Operator, OperatorRole } from '../../../../core/models/operator.model';
import { LocaleService } from '../../../../core/services/locale.service';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { ModalComponent } from '../../../../ui/components/modal/modal.component';
import { OperatorsService } from '../../services/operators.service';
import { RoleSelectComponent } from '../role-select/role-select.component';

@Component({
  selector: 'slv-edit-roles-modal',
  imports: [ModalComponent, FieldComponent, ButtonComponent, AlertComponent, RoleSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './edit-roles-modal.component.html',
})
export class EditRolesModalComponent {
  protected readonly locale = inject(LocaleService);
  private readonly operatorsService = inject(OperatorsService);

  /** Operador a editar; sin valor el modal está cerrado. */
  readonly operator = input<Operator | null>(null);

  readonly closed = output<void>();
  readonly saved = output<Operator>();

  protected readonly roles = signal<readonly OperatorRole[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  constructor() {
    effect(() => {
      const operator = this.operator();
      untracked(() => {
        this.roles.set(operator?.roles ?? []);
        this.error.set(null);
        this.saving.set(false);
      });
    });
  }

  protected submit(): void {
    const operator = this.operator();
    if (!operator || this.saving()) return;
    if (this.roles().length === 0) {
      this.error.set(this.locale.t('createOperator.rolesRequired'));
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.operatorsService.update(operator.id, { roles: this.roles() }).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.saved.emit(updated);
      },
      error: () => {
        this.saving.set(false);
        this.error.set(this.locale.t('editRoles.error'));
      },
    });
  }
}
