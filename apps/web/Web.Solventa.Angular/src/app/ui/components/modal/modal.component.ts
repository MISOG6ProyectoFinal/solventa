import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { LocaleService } from '../../../core/services/locale.service';

/**
 * Modal con overlay. Contenido proyectado; el pie se proyecta con `slot="footer"`:
 * `<slv-modal [open]="x()" title="…" (closed)="x.set(false)"> … <div slot="footer">…</div> </slv-modal>`
 */
@Component({
  selector: 'slv-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  templateUrl: './modal.component.html',
})
export class ModalComponent {
  protected readonly locale = inject(LocaleService);
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly wide = input(false);
  readonly closed = output<void>();
}
