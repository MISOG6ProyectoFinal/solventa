import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RamoId } from '../../../../core/models/ramo.model';
import { RAMOS } from '../../../../shared/constants/ramos.constants';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { PROVIDER_SCENARIOS } from '../../constants/ops.constants';
import { OfertaCotizacionResponse } from '../../interfaces/quote-payload.interface';
import { mapFormValuesToQuotePayload } from '../../services/quote-payload.mapper';
import { QuotesService } from '../../services/quotes.service';
import { ConsentPanelComponent } from '../consent-panel/consent-panel.component';
import { QuoteBreakdownComponent } from '../quote-breakdown/quote-breakdown.component';
import { QuoteFormComponent } from '../quote-form/quote-form.component';

const DEFAULT_QUOTE_ERROR = 'Error al calcular cotización';

interface QuoteErrorDetail {
  readonly mensaje?: string;
  readonly campos?: readonly { readonly campo: string; readonly error: string }[];
}

/** El backend responde igual en todos los canales: `{ codigo, mensaje, campos? }`. */
export function quoteErrorMessage(detail: unknown): string {
  if (typeof detail === 'string' && detail !== '') {
    return detail;
  }
  if (typeof detail !== 'object' || detail === null || Array.isArray(detail)) {
    return DEFAULT_QUOTE_ERROR;
  }
  const { mensaje, campos } = detail as QuoteErrorDetail;
  if (!mensaje) {
    return DEFAULT_QUOTE_ERROR;
  }
  const fields = (campos ?? []).map(({ campo, error }) => `${campo}: ${error}`);
  return fields.length ? `${mensaje} ${fields.join('. ')}` : mensaje;
}

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
    QuoteBreakdownComponent,
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
  protected readonly consentValidated = signal(false);
  protected readonly consentimientoId = signal<string | null>(null);
  protected readonly formValues = signal<Record<string, string>>({});

  private readonly ramoMeta = computed(() => RAMOS.find((ramo) => ramo.id === this.ramo()));
  protected readonly ramoLabel = computed(() => this.ramoMeta()?.label ?? '');
  protected readonly requiresConsent = computed(() => this.ramoMeta()?.requiresConsent ?? false);
  protected readonly puedeCalcular = computed(
    () => !this.requiresConsent() || this.consentValidated(),
  );

  protected onConsentValidated(consentimientoId: string): void {
    this.consentimientoId.set(consentimientoId);
    this.consentValidated.set(true);
  }

  protected onQuoteReady(values: Record<string, string>): void {
    this.isCalculating.set(true);
    this.errorMessage.set(null);

    const consentId = this.consentimientoId();
    const enrichedValues = {
      ...values,
      ...(consentId ? { consentimiento_id: consentId } : {}),
    };

    const payload = mapFormValuesToQuotePayload(this.ramo(), enrichedValues);
    this.quotesService.cotizar(payload).subscribe({
      next: (response) => {
        this.quoteResult.set({
          ...response,
          degradada: response.degradada,
        });
        this.isCalculating.set(false);
      },
      error: (err) => {
        this.errorMessage.set(quoteErrorMessage(err?.error?.detail));
        this.isCalculating.set(false);
      },
    });
  }
}
