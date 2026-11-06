import { ChangeDetectionStrategy, Component, inject, model } from '@angular/core';
import { OPERATOR_ROLES } from '../../../../core/constants/roles.constants';
import { OperatorRole } from '../../../../core/models/operator.model';
import { LocaleService } from '../../../../core/services/locale.service';

/** Casillas de roles con su descripción. */
@Component({
  selector: 'slv-role-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-select.component.html',
})
export class RoleSelectComponent {
  protected readonly locale = inject(LocaleService);

  readonly roles = model<readonly OperatorRole[]>([]);

  protected readonly options = OPERATOR_ROLES;

  protected toggle(role: OperatorRole): void {
    this.roles.update((current) => (current.includes(role) ? current.filter((item) => item !== role) : [...current, role]));
  }
}
