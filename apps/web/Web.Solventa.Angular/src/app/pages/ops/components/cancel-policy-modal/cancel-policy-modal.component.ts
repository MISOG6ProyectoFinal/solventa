import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Policy } from '../../../../core/models/policy.model';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { ModalComponent } from '../../../../ui/components/modal/modal.component';
import { CANCEL_CAUSES, NON_REFUNDABLE_CAUSE, OPS_TODAY } from '../../constants/ops.constants';
import { calculateCancellation } from '../../utils/policy-cancellation.utils';

type CancelStep = 'form' | 'confirm';

/** Modal "Cancelar póliza": causa, cálculo de devolución y confirmación. */
@Component({
  selector: 'slv-cancel-policy-modal',
  imports: [FormsModule, ModalComponent, AlertComponent, FieldComponent, InputDirective, ButtonComponent, CopCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cancel-policy-modal.component.html',
})
export class CancelPolicyModalComponent {
  readonly policy = input.required<Policy>();

  readonly closed = output<void>();
  readonly confirmed = output<string>();

  protected readonly causes = CANCEL_CAUSES;
  protected readonly nonRefundableCause = NON_REFUNDABLE_CAUSE;
  protected readonly today = OPS_TODAY;

  protected readonly step = signal<CancelStep>('form');
  protected readonly cause = signal('');

  protected readonly quote = computed(() => {
    const cause = this.cause();
    return cause ? calculateCancellation(this.policy(), cause, OPS_TODAY) : null;
  });

  protected goToConfirmation(): void {
    if (this.quote()) this.step.set('confirm');
  }

  protected confirm(): void {
    this.confirmed.emit(this.cause());
  }
}
