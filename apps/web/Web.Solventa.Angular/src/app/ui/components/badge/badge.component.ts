import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tone } from '../../constants/design-tokens.constants';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  success: 'bg-success-surface text-success-text border-success-border',
  warning: 'bg-warning-surface text-warning-text border-warning-border',
  error: 'bg-error-surface text-error-text border-error-border',
  info: 'bg-info-surface text-info-text border-info-border',
  primary: 'bg-primary text-white border-primary',
};

/** Etiqueta de estado (pill). */
@Component({
  selector: 'slv-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  templateUrl: './badge.component.html',
})
export class BadgeComponent {
  readonly tone = input<Tone>('neutral');

  protected readonly classes = computed(
    () => `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${TONE_CLASSES[this.tone()]}`,
  );
}
