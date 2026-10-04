import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

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
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly wide = input(false);
  readonly closed = output<void>();
}
