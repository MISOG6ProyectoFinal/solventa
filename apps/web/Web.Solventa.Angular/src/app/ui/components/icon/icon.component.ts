import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, IconName, IconSize } from '../../constants/icons.constants';

/** Ícono lineal Solventa (24×24, trazo 1.5px, `currentColor`). */
@Component({
  selector: 'slv-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  templateUrl: './icon.component.html',
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<IconSize>(20);
  readonly title = input<string>('');

  protected readonly shapes = computed(() => ICONS[this.name()].shapes);
}
