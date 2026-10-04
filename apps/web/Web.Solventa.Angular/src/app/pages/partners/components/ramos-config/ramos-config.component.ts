import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Partner } from '../../../../core/models/partner.model';
import { RamoId } from '../../../../core/models/ramo.model';
import { RAMOS, COVERAGE_CATALOG } from '../../../../shared/constants/ramos.constants';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { SwitchComponent } from '../../../../ui/components/switch/switch.component';

@Component({
  selector: 'slv-ramos-config',
  standalone: true,
  imports: [CommonModule, CardComponent, SwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ramos-config.component.html'
})
export class RamosConfigComponent {
  readonly partner = input.required<Partner>();
  readonly updateRequested = output<Partner>();

  readonly ramos = RAMOS;
  readonly coverageCatalog = COVERAGE_CATALOG;

  toggleRamo(ramo: RamoId) {
    const p = this.partner();
    const enabled = p.enabledRamos.includes(ramo);
    const enabledRamos = enabled 
      ? p.enabledRamos.filter(r => r !== ramo) 
      : [...p.enabledRamos, ramo];
    
    const coveragesByRamo = { ...p.coveragesByRamo };
    if (!enabled) coveragesByRamo[ramo] = []; // Reset coverages when enabling
    
    this.updateRequested.emit({ ...p, enabledRamos, coveragesByRamo });
  }

  toggleCoverage(ramo: RamoId, coverage: string) {
    const p = this.partner();
    const current = p.coveragesByRamo[ramo] || [];
    const next = current.includes(coverage)
      ? current.filter(c => c !== coverage)
      : [...current, coverage];

    this.updateRequested.emit({
      ...p,
      coveragesByRamo: { ...p.coveragesByRamo, [ramo]: next }
    });
  }

  isEnabled(ramo: RamoId): boolean {
    return this.partner().enabledRamos.includes(ramo);
  }

  hasCoverage(ramo: RamoId, coverage: string): boolean {
    return (this.partner().coveragesByRamo[ramo] || []).includes(coverage);
  }

  getRamoLabel(ramo: string): string {
    return RAMOS.find(r => r.id === ramo)?.label ?? ramo;
  }
}
