import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { Ramo, RamoId } from '../../../../core/models/ramo.model';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { QUOTE_CLIENT_FIELDS, QUOTE_RISK_FIELDS } from '../../constants/quote-fields.constants';
import { ProductContract } from '../../interfaces/product-contract.interface';
import { QuoteFieldDef } from '../../interfaces/quote-field.interface';
import { QuoteFieldComponent } from '../quote-field/quote-field.component';
import { LocaleService } from '../../../../core/services/locale.service';

export type FormValues = Record<string, string>;

/** Formulario dinámico por ramo: selector de ramo, datos del cliente y datos del riesgo. */
@Component({
  selector: 'slv-quote-form',
  imports: [FormsModule, CardComponent, FieldComponent, InputDirective, QuoteFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-form.component.html',
})
export class QuoteFormComponent {
  protected readonly locale = inject(LocaleService);

  readonly ramo = model.required<RamoId>();
  readonly ramos = input.required<readonly Ramo[]>();
  readonly contract = input<ProductContract | null>(null);
  readonly documentTypes = input<readonly string[]>([]);
  readonly quoteReady = output<FormValues>();
  readonly formChange = output<FormValues>();

  protected readonly clientFields = computed(() => QUOTE_CLIENT_FIELDS.map((field) => this.withOptions(field)));

  private readonly values = signal<FormValues>({});
  private readonly submitted = signal(false);

  protected readonly riskFields = computed(() =>
    (QUOTE_RISK_FIELDS[this.ramo()] ?? []).map((field) => this.withOptions(field)),
  );

  constructor() {
    effect(() => {
      const [first] = this.documentTypes();
      if (first && !untracked(() => this.values()['tipoDocumento'])) this.setValue('tipoDocumento', first);
    });
  }

  protected readonly errors = computed<Record<string, string>>(() => {
    if (!this.submitted()) return {};
    const allFields = [...QUOTE_CLIENT_FIELDS, ...(QUOTE_RISK_FIELDS[this.ramo()] ?? [])];
    const result: Record<string, string> = {};
    for (const field of allFields) {
      const val = (this.values()[field.key] ?? '').trim();
      if (field.required && !val) {
        result[field.key] = this.locale.t('common.required');
      }
    }
    return result;
  });

  protected readonly isValid = computed(() => Object.keys(this.errors()).length === 0);

  private withOptions(field: QuoteFieldDef): QuoteFieldDef {
    if (field.optionsSource === 'documentTypes') return { ...field, options: this.documentTypes() };
    if (field.optionsSource === 'contract') return { ...field, options: this.contract()?.properties[field.key]?.enum ?? [] };
    return field;
  }

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
