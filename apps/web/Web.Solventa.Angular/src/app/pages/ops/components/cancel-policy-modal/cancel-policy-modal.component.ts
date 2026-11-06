import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { Policy } from '../../../../core/models/policy.model';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { ModalComponent } from '../../../../ui/components/modal/modal.component';
import { CancellationCause } from '../../../../core/models/catalog.model';
import { CatalogService } from '../../../../core/services/catalog.service';
import { todayIso } from '../../utils/today.utils';
import { calculateCancellation } from '../../utils/policy-cancellation.utils';
import { LocaleService } from '../../../../core/services/locale.service';

type CancelStep = 'form' | 'confirm';

/** Modal "Cancelar póliza": causa, cálculo de devolución y confirmación. */
@Component({
  selector: 'slv-cancel-policy-modal',
  imports: [FormsModule, ModalComponent, AlertComponent, FieldComponent, InputDirective, ButtonComponent, CopCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cancel-policy-modal.component.html',
})
export class CancelPolicyModalComponent {
  protected readonly locale = inject(LocaleService);
  readonly policy = input.required<Policy>();

  readonly closed = output<void>();
  readonly confirmed = output<string>();

  protected readonly causes = toSignal(inject(CatalogService).cancellationCauses$.pipe(catchError(() => of([]))), {
    initialValue: [] as readonly CancellationCause[],
  });
  protected readonly today = todayIso();

  protected readonly step = signal<CancelStep>('form');
  protected readonly cause = signal('');

  protected readonly selectedCause = computed(() => this.causes().find((cause) => cause.id === this.cause()));

  protected readonly quote = computed(() => {
    const cause = this.selectedCause();
    return cause ? calculateCancellation(this.policy(), cause.refundable, this.today) : null;
  });

  protected goToConfirmation(): void {
    if (this.quote()) this.step.set('confirm');
  }

  protected confirm(): void {
    this.confirmed.emit(this.cause());
  }
}
