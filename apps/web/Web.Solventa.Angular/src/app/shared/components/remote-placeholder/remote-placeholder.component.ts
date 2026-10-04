import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LocaleService } from '../../../core/services/locale.service';
import { CardComponent } from '../../../ui/components/card/card.component';

/** Marcador temporal para los módulos que vendrán de los Micro Frontends remotos. */
@Component({
  selector: 'slv-remote-placeholder',
  imports: [CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './remote-placeholder.component.html',
})
export class RemotePlaceholderComponent {
  protected readonly locale = inject(LocaleService);
  protected readonly titleKey: string = inject(ActivatedRoute).snapshot.data['titleKey'] ?? '';
}
