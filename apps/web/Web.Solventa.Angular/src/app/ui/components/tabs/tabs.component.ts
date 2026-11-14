import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface TabItem {
  readonly id: string;
  readonly label: string;
}

/** Pestañas con indicador inferior. `active` es two-way: `[(active)]="tab"`. */
@Component({
  selector: 'slv-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-border)]', role: 'tablist' },
  templateUrl: './tabs.component.html',
})
export class TabsComponent {
  readonly items = input.required<readonly TabItem[]>();
  readonly active = model.required<string>();
  readonly testIdPrefix = input<string>('');
}
