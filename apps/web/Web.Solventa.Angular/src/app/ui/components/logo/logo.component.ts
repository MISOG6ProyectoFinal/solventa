import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Logotipo Solventa (hexágono + cruz + wordmark Fraunces). */
@Component({
  selector: 'slv-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-2' },
  templateUrl: './logo.component.html',
})
export class LogoComponent {
  readonly inverted = input(false);
}
