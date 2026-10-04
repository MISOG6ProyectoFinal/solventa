import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RamoId } from '../../../../core/models/ramo.model';
import { RAMOS } from '../../../../shared/constants/ramos.constants';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { PROVIDER_SCENARIOS } from '../../constants/ops.constants';
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quote-tab.component.html',
})
export class QuoteTabComponent {
  protected readonly scenarios = PROVIDER_SCENARIOS;
  protected readonly scenario = signal(PROVIDER_SCENARIOS[0].id);
  protected readonly ramo = signal<RamoId>('VIDA_HIPOTECARIO');

  private readonly ramoMeta = computed(() => RAMOS.find((ramo) => ramo.id === this.ramo()));
  protected readonly ramoLabel = computed(() => this.ramoMeta()?.label ?? '');
  protected readonly requiresConsent = computed(() => this.ramoMeta()?.requiresConsent ?? false);
}
