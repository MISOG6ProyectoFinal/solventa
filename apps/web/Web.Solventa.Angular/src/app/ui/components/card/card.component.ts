import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Tarjeta base: `rounded-xl border bg-white` con padding opcional (`p-5`). */
@Component({
  selector: 'slv-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  templateUrl: './card.component.html',
})
export class CardComponent {
  readonly padding = input(true);

  protected readonly classes = computed(
    () => `block rounded-xl border border-border bg-white ${this.padding() ? 'p-5' : ''}`,
  );
}
