import { ChangeDetectionStrategy, Component, computed, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RAMOS } from '../../../../shared/constants/ramos.constants';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { RamoId } from '../../../../core/models/ramo.model';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { QUOTE_CLIENT_FIELDS, QUOTE_RISK_FIELDS } from '../../constants/quote-fields.constants';
import { QuoteFieldComponent } from '../quote-field/quote-field.component';

type FormValues = Record<string, string>;

/** Formulario dinámico por ramo: selector de ramo, datos del cliente y datos del riesgo. */
@Component({
  selector: 'slv-quote-form',
  imports: [FormsModule, CardComponent, FieldComponent, InputDirective, QuoteFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-form.component.html',
})
export class QuoteFormComponent {
  readonly ramo = model.required<RamoId>();

  protected readonly ramos = RAMOS;
  protected readonly clientFields = QUOTE_CLIENT_FIELDS;

  private readonly values = signal<FormValues>({ tipoDocumento: 'CC' });

  protected readonly riskFields = computed(() => QUOTE_RISK_FIELDS[this.ramo()]);
  protected readonly ramoLabel = computed(() => RAMOS.find((ramo) => ramo.id === this.ramo())?.label ?? '');

  protected valueOf(key: string): string {
    return this.values()[key] ?? '';
  }

  protected setValue(key: string, value: string): void {
    this.values.update((current) => ({ ...current, [key]: value }));
  }

  /** Al cambiar de ramo se conservan solo los datos del cliente. */
  protected changeRamo(ramo: RamoId): void {
    const clientKeys = new Set(QUOTE_CLIENT_FIELDS.map((field) => field.key));
    this.values.update((current) => Object.fromEntries(Object.entries(current).filter(([key]) => clientKeys.has(key))));
    this.ramo.set(ramo);
  }
}
