import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, filter, map, of, switchMap } from 'rxjs';
import { RamoId } from '../../../../core/models/ramo.model';
import { CatalogService } from '../../../../core/services/catalog.service';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { PROVIDER_SCENARIOS } from '../../constants/ops.constants';
import { ProductContract } from '../../interfaces/product-contract.interface';
import { OfertaCotizacionResponse } from '../../interfaces/quote-payload.interface';
import { mapFormValuesToQuotePayload } from '../../services/quote-payload.mapper';
import { QuotesService } from '../../services/quotes.service';
import { SimulatorService } from '../../services/simulator.service';
import { ConsentPanelComponent } from '../consent-panel/consent-panel.component';
import { QuoteBreakdownComponent } from '../quote-breakdown/quote-breakdown.component';
import { QuoteFormComponent } from '../quote-form/quote-form.component';
import { QUOTE_ROLES } from '../../../../core/constants/roles.constants';
import { AuthService } from '../../../../core/services/auth.service';
import { LocaleService } from '../../../../core/services/locale.service';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';

interface QuoteErrorDetail {
  readonly mensaje?: string;
  readonly campos?: readonly { readonly campo: string; readonly error: string }[];
}

/** El backend responde igual en todos los canales: `{ codigo, mensaje, campos? }`. */
export function quoteErrorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === 'string' && detail !== '') {
    return detail;
  }
  if (typeof detail !== 'object' || detail === null || Array.isArray(detail)) {
    return fallback;
  }
  const { mensaje, campos } = detail as QuoteErrorDetail;
  if (!mensaje) {
    return fallback;
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
    AlertComponent,
    QuoteFormComponent,
    ConsentPanelComponent,
    QuoteBreakdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-tab.component.html',
})
export class QuoteTabComponent {
  protected readonly locale = inject(LocaleService);
  private readonly quotesService = inject(QuotesService);
  private readonly catalog = inject(CatalogService);
  private readonly auth = inject(AuthService);

  private readonly simulator = inject(SimulatorService);

  protected readonly scenarios = PROVIDER_SCENARIOS;
  protected readonly scenario = signal(PROVIDER_SCENARIOS[0].id);
  protected readonly simulatorError = signal(false);
  protected readonly catalogFailed = signal(false);
  protected readonly ramos = toSignal(
    this.quotesService.getRamos().pipe(
      catchError(() => {
        this.catalogFailed.set(true);
        return of([]);
      }),
    ),
    { initialValue: [] },
  );
  protected readonly documentTypes = toSignal(this.catalog.documentTypes$.pipe(catchError(() => of([]))), {
    initialValue: [],
  });
  protected readonly ramo = signal<RamoId>('');

  protected readonly isCalculating = signal(false);
  protected readonly quoteResult = signal<OfertaCotizacionResponse | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly consentValidated = signal(false);
  protected readonly consentimientoId = signal<string | null>(null);
  protected readonly formValues = signal<Record<string, string>>({});

  private readonly ramoMeta = computed(() => this.ramos().find((ramo) => ramo.id === this.ramo()));
  private readonly productId = computed(() => this.ramoMeta()?.products[0]?.id ?? '');
  private readonly loadedContract = toSignal(
    toObservable(this.productId).pipe(
      filter((productId) => productId !== ''),
      switchMap((productId) =>
        this.quotesService.getContract(productId).pipe(
          map((contract) => ({ productId, contract })),
          catchError(() => {
            this.catalogFailed.set(true);
            return of(null);
          }),
        ),
      ),
    ),
    { initialValue: null },
  );
  protected readonly contract = computed<ProductContract | null>(() => {
    const loaded = this.loadedContract();
    return loaded?.productId === this.productId() ? loaded.contract : null;
  });
  protected readonly ramoLabel = computed(() => this.locale.label('ramo', this.ramo(), this.ramoMeta()?.name ?? ''));
  protected readonly requiresConsent = computed(() => this.ramoMeta()?.requiresConsent ?? false);
  protected readonly canQuote = computed(() => this.auth.hasRole(...QUOTE_ROLES));
  protected readonly puedeCalcular = computed(
    () => this.canQuote() && this.contract() !== null && (!this.requiresConsent() || this.consentValidated()),
  );

  constructor() {
    effect(() => {
      const [first] = this.ramos();
      if (first && !untracked(() => this.ramo())) this.ramo.set(first.id);
    });

    this.simulator.openFinance().subscribe({
      next: ({ modo }) => this.scenario.set(PROVIDER_SCENARIOS.find((s) => s.mode === modo)?.id ?? PROVIDER_SCENARIOS[0].id),
      error: () => this.simulatorError.set(true),
    });
  }

  protected changeScenario(id: string): void {
    const scenario = PROVIDER_SCENARIOS.find((s) => s.id === id);
    if (!scenario) return;
    this.scenario.set(id);
    this.simulatorError.set(false);
    this.simulator.setOpenFinance(scenario.mode).subscribe({ error: () => this.simulatorError.set(true) });
  }

  protected onConsentValidated(consentimientoId: string): void {
    this.consentimientoId.set(consentimientoId);
    this.consentValidated.set(true);
  }

  protected onQuoteReady(values: Record<string, string>): void {
    const contract = this.contract();
    if (!this.canQuote() || !contract) return;
    this.isCalculating.set(true);
    this.errorMessage.set(null);

    const consentId = this.consentimientoId();
    const enrichedValues = {
      ...values,
      ...(consentId ? { consentimiento_id: consentId } : {}),
    };

    const payload = mapFormValuesToQuotePayload(this.productId(), enrichedValues, contract);
    this.quotesService.cotizar(payload).subscribe({
      next: (response) => {
        this.quoteResult.set({
          ...response,
          degradada: response.degradada,
        });
        this.isCalculating.set(false);
      },
      error: (err) => {
        this.errorMessage.set(quoteErrorMessage(err?.error?.detail, this.locale.t('quote.error')));
        this.isCalculating.set(false);
      },
    });
  }
}
