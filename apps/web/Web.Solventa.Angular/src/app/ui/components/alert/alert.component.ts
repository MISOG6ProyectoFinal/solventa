import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AlertTone } from '../../constants/design-tokens.constants';

const TONE_CLASSES: Record<AlertTone, string> = {
  success: 'bg-success-surface text-success-text border-success-border',
  warning: 'bg-warning-surface text-warning-text border-warning-border',
  error: 'bg-error-surface text-error-text border-error-border',
  info: 'bg-info-surface text-info-text border-info-border',
};

/** Mensaje de retroalimentación en bloque. */
@Component({
  selector: 'slv-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()', role: 'alert' },
  templateUrl: './alert.component.html',
})
export class AlertComponent {
  readonly tone = input.required<AlertTone>();

  protected readonly classes = computed(
    () => `block rounded-xl px-4 py-3 text-sm border ${TONE_CLASSES[this.tone()]}`,
  );
}
