import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription, catchError, of } from 'rxjs';
import { Policy } from '../../../../core/models/policy.model';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { ModalComponent } from '../../../../ui/components/modal/modal.component';
import { CancellationCause } from '../../../../core/models/catalog.model';
import { CatalogService } from '../../../../core/services/catalog.service';
import { CancellationQuote } from '../../interfaces/cancellation-quote.interface';
import { OpsPoliciesService } from '../../services/ops-policies.service';
import { todayIso } from '../../utils/today.utils';
import { LocaleService } from '../../../../core/services/locale.service';

type CancelStep = 'form' | 'confirm';

/** Modal "Cancelar póliza": causa, recálculo de la devolución en el backend y confirmación. */
@Component({
  selector: 'slv-cancel-policy-modal',
  imports: [FormsModule, ModalComponent, AlertComponent, FieldComponent, InputDirective, ButtonComponent, CopCurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cancel-policy-modal.component.html',
})
export class CancelPolicyModalComponent {
  protected readonly locale = inject(LocaleService);
  private readonly opsService = inject(OpsPoliciesService);
  readonly policy = input.required<Policy>();
  /** Mensaje si la cancelación definitiva falló en el backend. */
  readonly error = input<string | null>(null);
  protected readonly currentError = linkedSignal(() => this.error());

  readonly closed = output<void>();
  readonly confirmed = output<string>();

  protected readonly causes = toSignal(inject(CatalogService).cancellationCauses$.pipe(catchError(() => of([]))), {
    initialValue: [] as readonly CancellationCause[],
  });
  protected readonly today = todayIso();

  protected readonly step = signal<CancelStep>('form');
  protected readonly cause = signal('');
  protected readonly quote = signal<CancellationQuote | null>(null);
  protected readonly calculating = signal(false);
  protected readonly quoteError = signal(false);
  private pending?: Subscription;

  protected readonly selectedCause = computed(() => this.causes().find((cause) => cause.id === this.cause()));

  protected onCauseChange(cause: string): void {
    this.pending?.unsubscribe();
    this.cause.set(cause);
    this.quote.set(null);
    this.quoteError.set(false);
    this.currentError.set(null);
    if (!cause) {
      this.calculating.set(false);
      return;
    }
    this.calculating.set(true);
    this.pending = this.opsService.quoteCancellation(this.policy().id, cause).subscribe({
      next: (quote) => {
        this.quote.set(quote);
        this.calculating.set(false);
      },
      error: () => {
        this.quoteError.set(true);
        this.calculating.set(false);
      },
    });
  }

  protected goToConfirmation(): void {
    if (this.quote()) {
      this.currentError.set(null);
      this.step.set('confirm');
    }
  }

  protected confirm(): void {
    this.confirmed.emit(this.cause());
  }
}
