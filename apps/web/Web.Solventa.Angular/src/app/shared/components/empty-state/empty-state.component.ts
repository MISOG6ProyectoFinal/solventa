import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '../../../ui/components/icon/icon.component';
import { IconName } from '../../../ui/constants/icons.constants';

/** Estado vacío: ícono, título y descripción; las acciones se proyectan. */
@Component({
  selector: 'slv-empty-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col items-center text-center gap-3 py-10 text-muted-foreground' },
  templateUrl: './empty-state.component.html',
})
export class EmptyStateComponent {
  readonly icon = input<IconName>('buscar');
  readonly title = input.required<string>();
  readonly description = input<string>('');
}
