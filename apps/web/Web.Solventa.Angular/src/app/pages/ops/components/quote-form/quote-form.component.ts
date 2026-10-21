import { ChangeDetectionStrategy, Component, computed, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RAMOS } from '../../../../shared/constants/ramos.constants';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { Ramo, RamoId } from '../../../../core/models/ramo.model';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { QUOTE_CLIENT_FIELDS, QUOTE_RISK_FIELDS } from '../../constants/quote-fields.constants';
import { QuotesService } from '../../services/quotes.service';
import { QuoteFieldComponent } from '../quote-field/quote-field.component';

export type FormValues = Record<string, string>;

/** Los 4 ramos del alcance de la HU001 */
const HU_RAMOS_IDS: readonly RamoId[] = ['VIAJE', 'MICROSEGURO_VIDA', 'VIDA_HIPOTECARIO', 'PARAMETRICO'];

/** Formulario dinámico por ramo: selector de ramo, datos del cliente y datos del riesgo. */
@Component({
  selector: 'slv-quote-form',
  imports: [FormsModule, CardComponent, FieldComponent, InputDirective, QuoteFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-form.component.html',
})
export class QuoteFormComponent {
  private readonly quotesService = inject(QuotesService, { optional: true });

  readonly ramo = model.required<RamoId>();
  readonly quoteReady = output<FormValues>();
  readonly formChange = output<FormValues>();

  /** Ramos del formulario: acotados estrictamente a los 4 de la HU y sincronizados con la BD */
  protected readonly ramos = signal<readonly Ramo[]>(
    RAMOS.filter((r) => HU_RAMOS_IDS.includes(r.id))
  );

  protected readonly clientFields = QUOTE_CLIENT_FIELDS;

  private readonly values = signal<FormValues>({ tipoDocumento: 'CC' });
  private readonly submitted = signal(false);

  protected readonly riskFields = computed(() => QUOTE_RISK_FIELDS[this.ramo()] ?? []);
  protected readonly ramoLabel = computed(
    () => this.ramos().find((ramo) => ramo.id === this.ramo())?.label ?? ''
  );

  constructor() {
    this.cargarRamosDesdeBd();
  }

  private cargarRamosDesdeBd(): void {
    if (!this.quotesService) return;
    this.quotesService.getRamos().subscribe({
      next: (dbRamos) => {
        const dbMap = new Map(
          dbRamos.map((r) => [r.id.replace('ramo-', '').toUpperCase().replace(/-/g, '_'), r.nombre])
        );
        this.ramos.update((current) =>
          current.map((item) => ({
            ...item,
            label: dbMap.get(item.id) ?? item.label,
          }))
        );
      },
      error: () => {
        // En caso de fallo o modo offline, conserva los 4 ramos base
      },
    });
  }

  protected readonly errors = computed<Record<string, string>>(() => {
    if (!this.submitted()) return {};
    const allFields = [...QUOTE_CLIENT_FIELDS, ...(QUOTE_RISK_FIELDS[this.ramo()] ?? [])];
    const result: Record<string, string> = {};
    for (const field of allFields) {
      const val = (this.values()[field.key] ?? '').trim();
      if (field.required && !val) {
        result[field.key] = 'Campo obligatorio';
      }
    }
    return result;
  });

  protected readonly isValid = computed(() => Object.keys(this.errors()).length === 0);

  public valueOf(key: string): string {
    return this.values()[key] ?? '';
  }

  protected errorOf(key: string): string {
    return this.errors()[key] ?? '';
  }

  protected setValue(key: string, value: string): void {
    const updated = { ...this.values(), [key]: value };
    this.values.set(updated);
    this.formChange.emit(updated);
  }

  /** Al cambiar de ramo se conservan solo los datos del cliente y se resetea la validación. */
  protected changeRamo(ramo: RamoId): void {
    const clientKeys = new Set(QUOTE_CLIENT_FIELDS.map((field) => field.key));
    const filtered = Object.fromEntries(Object.entries(this.values()).filter(([key]) => clientKeys.has(key)));
    this.values.set(filtered);
    this.submitted.set(false);
    this.ramo.set(ramo);
    this.formChange.emit(filtered);
  }

  public submit(): boolean {
    this.submitted.set(true);
    if (this.isValid()) {
      this.quoteReady.emit({ ...this.values() });
      return true;
    }
    return false;
  }
}
