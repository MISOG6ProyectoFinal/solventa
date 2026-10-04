import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Interruptor ON/OFF: 48×24, ON `bg-accent`, OFF `bg-border`. */
@Component({
  selector: 'slv-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  templateUrl: './switch.component.html',
})
export class SwitchComponent {
  readonly checked = model(false);
  readonly label = input<string>('');
}
