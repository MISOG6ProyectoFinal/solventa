import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RamoId } from '../../../../core/models/ramo.model';
import { RAMOS } from '../../../../shared/constants/ramos.constants';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { CopCurrencyPipe } from '../../../../shared/pipes/cop-currency.pipe';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { PROVIDER_SCENARIOS } from '../../constants/ops.constants';
import { OfertaCotizacionResponse } from '../../interfaces/quote-payload.interface';
import { mapFormValuesToQuotePayload } from '../../services/quote-payload.mapper';
import { QuotesService } from '../../services/quotes.service';
import { ConsentPanelComponent } from '../consent-panel/consent-panel.component';
import { QuoteFormComponent } from '../quote-form/quote-form.component';

/** Pestaña "Cotización": formulario por ramo, consentimiento, simulación de proveedores y desglose. */
@Component({
  selector: 'slv-quote-tab',
  imports: [
    FormsModule,
    CardComponent,
    FieldComponent,
    InputDirective,
    ButtonComponent,
    QuoteFormComponent,
    ConsentPanelComponent,
    CopCurrencyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-tab.component.html',
})
export class QuoteTabComponent {
  private readonly quotesService = inject(QuotesService);

  protected readonly scenarios = PROVIDER_SCENARIOS;
  protected readonly scenario = signal(PROVIDER_SCENARIOS[0].id);
  protected readonly ramo = signal<RamoId>('VIDA_HIPOTECARIO');

  protected readonly isCalculating = signal(false);
  protected readonly quoteResult = signal<OfertaCotizacionResponse | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly ramoMeta = computed(() => RAMOS.find((ramo) => ramo.id === this.ramo()));
  protected readonly ramoLabel = computed(() => this.ramoMeta()?.label ?? '');
  protected readonly requiresConsent = computed(() => this.ramoMeta()?.requiresConsent ?? false);

  protected onQuoteReady(values: Record<string, string>): void {
    this.isCalculating.set(true);
    this.errorMessage.set(null);
    const payload = mapFormValuesToQuotePayload(this.ramo(), values);
    this.quotesService.cotizar(payload).subscribe({
      next: (response) => {
        this.quoteResult.set(response);
        this.isCalculating.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail ?? 'Error al calcular cotización');
        this.isCalculating.set(false);
      },
    });
  }
}
