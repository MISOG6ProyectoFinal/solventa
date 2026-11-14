import { SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { BadgeComponent } from '../../../../ui/components/badge/badge.component';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { OfertaCotizacionResponse } from '../../interfaces/quote-payload.interface';
import { LocaleService } from '../../../../core/services/locale.service';

/** Panel derecho: desglose de cotización en tiempo real con los 4 estados (HU003). */
@Component({
  selector: 'slv-quote-breakdown',
  host: { class: 'block' },
  imports: [SlicePipe, CopCurrencyPipe, AlertComponent, BadgeComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-breakdown.component.html',
})
export class QuoteBreakdownComponent {
  protected readonly locale = inject(LocaleService);
  readonly isCalculating = input<boolean>(false);
  readonly quoteResult = input<OfertaCotizacionResponse | null>(null);
  readonly errorMessage = input<string | null>(null);
  readonly requiresConsent = input<boolean>(false);
  readonly consentValidated = input<boolean>(false);
  readonly ramoLabel = input<string>('');
}
