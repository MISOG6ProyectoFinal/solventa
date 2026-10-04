import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Chip / tag: `outline` (con ícono proyectado), `primary`, `accent` o `warning`. */
@Component({
  selector: 'slv-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  templateUrl: './chip.component.html',
})
export class ChipComponent {
  readonly variant = input<'outline' | 'primary' | 'accent' | 'warning'>('outline');

  protected readonly classes = computed(() => {
    const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm';
    switch (this.variant()) {
      case 'primary':
        return `${base} bg-primary text-white font-medium`;
      case 'accent':
        return `${base} bg-accent text-white font-medium`;
      case 'warning':
        return `${base} font-medium border border-warning-border bg-warning-surface text-warning-text`;
      default:
        return `${base} border border-border text-foreground`;
    }
  });
}
