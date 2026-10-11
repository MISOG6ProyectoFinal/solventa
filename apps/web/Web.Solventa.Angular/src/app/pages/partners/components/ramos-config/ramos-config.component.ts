import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Partner, PartnerConfig, PartnerRamoConfig } from '../../../../core/models/partner.model';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { SwitchComponent } from '../../../../ui/components/switch/switch.component';
import { PartnersService } from '../../services/partners.service';

@Component({
  selector: 'slv-ramos-config',
  standalone: true,
  imports: [CommonModule, AlertComponent, CardComponent, SwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ramos-config.component.html'
})
export class RamosConfigComponent {
  private readonly partnersService = inject(PartnersService);

  readonly partner = input.required<Partner>();

  readonly config = signal<PartnerConfig | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly enabledRamos = computed(() => this.config()?.ramos.filter(ramo => ramo.enabled) ?? []);

  private readonly partnerId = computed(() => this.partner().id);
  /** Última configuración confirmada por el backend; a ella se vuelve si un guardado falla. */
  private confirmed: PartnerConfig | null = null;
  private lastRequest = 0;

  constructor() {
    effect(() => {
      const partnerId = this.partnerId();
      untracked(() => this.load(partnerId));
    });
  }

  toggleRamo(ramo: PartnerRamoConfig) {
    // Un ramo recién habilitado o deshabilitado queda sin coberturas seleccionadas.
    this.save(current => current.id !== ramo.id ? current : {
      ...current,
      enabled: !current.enabled,
      coverages: current.coverages.map(c => ({ ...c, enabled: false })),
    });
  }

  toggleCoverage(ramo: PartnerRamoConfig, coverageId: string) {
    this.save(current => current.id !== ramo.id ? current : {
      ...current,
      coverages: current.coverages.map(c => c.id === coverageId ? { ...c, enabled: !c.enabled } : c),
    });
  }

  coveragesLabel(ramo: PartnerRamoConfig): string {
    return ramo.coverages.filter(c => c.enabled).map(c => c.name).join(', ') || 'Sin coberturas seleccionadas';
  }

  private load(partnerId: string) {
    const request = ++this.lastRequest;
    this.config.set(null);
    this.confirmed = null;
    this.error.set(null);
    this.saving.set(false);
    this.loading.set(true);
    this.partnersService.loadConfig(partnerId).subscribe({
      next: config => {
        if (request !== this.lastRequest) return;
        this.confirmed = config;
        this.config.set(config);
        this.loading.set(false);
      },
      error: () => {
        if (request !== this.lastRequest) return;
        this.loading.set(false);
        this.error.set('No fue posible cargar la configuración del socio.');
      },
    });
  }

  private save(change: (ramo: PartnerRamoConfig) => PartnerRamoConfig) {
    const current = this.config();
    if (!current) return;
    const next = { ...current, ramos: current.ramos.map(change) };
    const request = ++this.lastRequest;
    this.config.set(next);
    this.error.set(null);
    this.saving.set(true);
    this.partnersService.saveConfig(this.partnerId(), next).subscribe({
      next: saved => {
        // Con varios cambios seguidos solo cuenta la respuesta del último.
        if (request !== this.lastRequest) return;
        this.confirmed = saved;
        this.config.set(saved);
        this.saving.set(false);
      },
      error: () => {
        if (request !== this.lastRequest) return;
        this.config.set(this.confirmed);
        this.saving.set(false);
        this.error.set('No fue posible guardar el cambio. Se conserva la configuración vigente.');
      },
    });
  }
}
