import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { CONSENT_CHANNELS } from '../../constants/ops.constants';

/** Consentimiento digital Open Finance / Open Data (solo obligatorio en ramos que lo requieren). */
@Component({
  selector: 'slv-consent-panel',
  imports: [FormsModule, CardComponent, AlertComponent, FieldComponent, InputDirective, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consent-panel.component.html',
})
export class ConsentPanelComponent {
  readonly required = input.required<boolean>();
  readonly ramoLabel = input.required<string>();
  readonly requested = output<void>();

  protected readonly channels = CONSENT_CHANNELS;
  protected readonly channel = signal(CONSENT_CHANNELS[0].id);
  protected readonly openFinance = signal(true);
  protected readonly openData = signal(true);
}
