import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Encabezado de página: barra turquesa, título Fraunces, subtítulo y slot de acciones. */
@Component({
  selector: 'slv-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6' },
  templateUrl: './page-header.component.html',
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}
