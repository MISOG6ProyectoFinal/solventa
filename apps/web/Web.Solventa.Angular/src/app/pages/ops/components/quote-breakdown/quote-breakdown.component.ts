import { SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { BadgeComponent } from '../../../../ui/components/badge/badge.component';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { OfertaCotizacionResponse } from '../../interfaces/quote-payload.interface';

/** Panel derecho: desglose de cotización en tiempo real con los 4 estados (HU003). */
@Component({
  selector: 'slv-quote-breakdown',
  imports: [SlicePipe, CopCurrencyPipe, BadgeComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-breakdown.component.html',
})
export class QuoteBreakdownComponent {
  readonly isCalculating = input<boolean>(false);
  readonly quoteResult = input<OfertaCotizacionResponse | null>(null);
  readonly errorMessage = input<string | null>(null);
  readonly requiresConsent = input<boolean>(false);
  readonly consentValidated = input<boolean>(false);
  readonly ramoLabel = input<string>('');
}
