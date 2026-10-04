import { Pipe, PipeTransform } from '@angular/core';
import { Locale } from '../../core/services/locale.service';

/** Formatea montos en COP sin decimales (equivalente a `money()` de los mockups). `{{ 154167 | copCurrency:'es' }}` */
@Pipe({ name: 'copCurrency' })
export class CopCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, locale: Locale = 'es'): string {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
