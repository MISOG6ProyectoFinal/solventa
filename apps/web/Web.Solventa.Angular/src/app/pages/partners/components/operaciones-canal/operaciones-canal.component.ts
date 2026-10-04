import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Partner } from '../../../../core/models/partner.model';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { TabsComponent } from '../../../../ui/components/tabs/tabs.component';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';

@Component({
  selector: 'slv-operaciones-canal',
  standalone: true,
  imports: [CommonModule, CardComponent, TabsComponent, AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './operaciones-canal.component.html'
})
export class OperacionesCanalComponent {
  readonly partner = input.required<Partner>();
}
