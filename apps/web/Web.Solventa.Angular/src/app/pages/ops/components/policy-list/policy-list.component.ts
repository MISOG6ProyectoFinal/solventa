import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Policy } from '../../../../core/models/policy.model';
import { RamoId } from '../../../../core/models/ramo.model';
import { RAMOS } from '../../../../shared/constants/ramos.constants';
import { POLICY_STATUS_TONE } from '../../../../shared/constants/status-tone.constants';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { BadgeComponent } from '../../../../ui/components/badge/badge.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { OPS_FILTER_ALL, POLICY_STATUS_OPTIONS } from '../../constants/ops.constants';

/** Consulta de pólizas: filtros (texto, estado, socio) y tabla de resultados. */
@Component({
  selector: 'slv-policy-list',
  imports: [FormsModule, CardComponent, FieldComponent, InputDirective, BadgeComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './policy-list.component.html',
})
export class PolicyListComponent {
  readonly policies = input.required<readonly Policy[]>();
  readonly partners = input.required<readonly string[]>();
  readonly opened = output<string>();

  protected readonly allFilter = OPS_FILTER_ALL;
  protected readonly statusOptions = POLICY_STATUS_OPTIONS;
  protected readonly statusTone = POLICY_STATUS_TONE;

  protected readonly query = signal('');
  protected readonly statusFilter = signal(OPS_FILTER_ALL);
  protected readonly partnerFilter = signal(OPS_FILTER_ALL);

  protected readonly filteredPolicies = computed(() => {
    const text = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    const partner = this.partnerFilter();

    return this.policies().filter(
      (policy) =>
        this.matchesText(policy, text) &&
        (!status || policy.status === status) &&
        (!partner || policy.socioOrigen === partner),
    );
  });

  protected ramoLabel(id: RamoId): string {
    return RAMOS.find((ramo) => ramo.id === id)?.label ?? id;
  }

  private matchesText(policy: Policy, text: string): boolean {
    return (
      !text ||
      [policy.number, policy.identification, policy.insuredName].some((value) => value.toLowerCase().includes(text))
    );
  }
}
