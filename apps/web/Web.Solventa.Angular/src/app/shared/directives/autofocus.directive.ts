import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

/** Enfoca el elemento al renderizarse. `<input slvAutofocus />` */
@Directive({ selector: '[slvAutofocus]' })
export class AutofocusDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => this.el.nativeElement.focus());
  }
}
