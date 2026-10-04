import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Tarjeta de métrica (Card / Stat): `dark` sobre azul primario o clara sobre blanco. */
@Component({
  selector: 'slv-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  templateUrl: './stat-card.component.html',
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly caption = input<string>('');
  readonly dark = input(false);

  protected readonly classes = computed(
    () => `block rounded-xl p-4 ${this.dark() ? 'bg-primary text-white' : 'bg-white border border-border'}`,
  );
}
