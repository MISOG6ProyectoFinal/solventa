import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Partner } from '../../../../core/models/partner.model';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { TabsComponent } from '../../../../ui/components/tabs/tabs.component';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { LocaleService } from '../../../../core/services/locale.service';

@Component({
  selector: 'slv-operaciones-canal',
  standalone: true,
  imports: [CommonModule, CardComponent, TabsComponent, AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operaciones-canal.component.html'
})
export class OperacionesCanalComponent {
  protected readonly locale = inject(LocaleService);
  readonly partner = input.required<Partner>();
}
