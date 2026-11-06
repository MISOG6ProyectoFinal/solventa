import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { Operator } from '../../../core/models/operator.model';
import { AuthService } from '../../../core/services/auth.service';
import { LocaleService } from '../../../core/services/locale.service';
import { AlertComponent } from '../../../ui/components/alert/alert.component';
import { BadgeComponent } from '../../../ui/components/badge/badge.component';
import { ButtonComponent } from '../../../ui/components/button/button.component';
import { CardComponent } from '../../../ui/components/card/card.component';
import { CreateOperatorModalComponent } from '../components/create-operator-modal/create-operator-modal.component';
import { EditRolesModalComponent } from '../components/edit-roles-modal/edit-roles-modal.component';
import { OperatorsService } from '../services/operators.service';

/** Administración de operadores del portal (solo administrador). */
@Component({
  selector: 'slv-users-page',
  imports: [
    CardComponent,
    BadgeComponent,
    ButtonComponent,
    AlertComponent,
    CreateOperatorModalComponent,
    EditRolesModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './users-page.component.html',
})
export class UsersPageComponent implements OnInit {
  protected readonly locale = inject(LocaleService);
  private readonly operatorsService = inject(OperatorsService);
  private readonly auth = inject(AuthService);

  protected readonly operators = this.operatorsService.operators;
  protected readonly loading = this.operatorsService.loading;
  protected readonly loadError = this.operatorsService.loadError;

  protected readonly showCreateModal = signal(false);
  protected readonly editing = signal<Operator | null>(null);
  protected readonly pendingId = signal<string | null>(null);
  protected readonly updateError = signal<string | null>(null);

  ngOnInit(): void {
    this.operatorsService.load();
  }

  protected reload(): void {
    this.operatorsService.load();
  }

  protected isSelf(operator: Operator): boolean {
    return operator.id === this.auth.operator()?.id;
  }

  protected toggleActive(operator: Operator): void {
    this.pendingId.set(operator.id);
    this.updateError.set(null);
    this.operatorsService.update(operator.id, { active: !operator.active }).subscribe({
      next: () => this.pendingId.set(null),
      error: (error: ApiError) => {
        this.pendingId.set(null);
        this.updateError.set(error.message || this.locale.t('users.updateError'));
      },
    });
  }

  protected onCreated(): void {
    this.showCreateModal.set(false);
  }

  protected onRolesSaved(): void {
    this.editing.set(null);
  }
}
