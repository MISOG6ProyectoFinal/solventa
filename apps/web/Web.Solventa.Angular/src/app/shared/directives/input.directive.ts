import { Directive, computed, input } from '@angular/core';

/**
 * Estilo de campo del DS para `input`, `select` y `textarea`.
 * `<input slvInput [invalid]="!!error" />`
 */
@Directive({
  selector: 'input[slvInput], select[slvInput], textarea[slvInput]',
  host: { '[class]': 'classes()' },
})
export class InputDirective {
  readonly invalid = input(false);

  protected readonly classes = computed(
    () =>
      'w-full bg-white rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors [&[readonly]]:bg-background disabled:bg-background disabled:cursor-not-allowed ' +
      (this.invalid() ? 'border border-error ring-1 ring-error' : 'border border-border focus:border-secondary'),
  );
}
