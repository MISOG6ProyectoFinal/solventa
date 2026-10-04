import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Partner, PartnerType, Alcance } from '../../../../core/models/partner.model';
import { PARTNER_TYPES, ALCANCES } from '../../../../shared/constants/ramos.constants';
import { ModalComponent } from '../../../../ui/components/modal/modal.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';

@Component({
  selector: 'slv-create-partner-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ModalComponent,
    FieldComponent,
    InputDirective,
    ButtonComponent,
    AlertComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './create-partner-modal.component.html'
})
export class CreatePartnerModalComponent {
  readonly open = input.required<boolean>();
  readonly existingIdentifiers = input.required<string[]>();
  
  readonly closed = output<void>();
  readonly created = output<Partner>();

  name = signal('');
  identifier = signal('');
  tipo = signal<PartnerType>('Retailer');
  pais = signal('Colombia');
  email = signal('');
  alcances = signal<Alcance[]>(['cotizacion', 'emision']);
  
  errors = signal<Record<string, string>>({});
  createdResult = signal<{ secret: string; partner: Partner } | null>(null);

  readonly partnerTypes = PARTNER_TYPES;
  readonly alcancesOptions = ALCANCES;

  toggleAlcance(a: Alcance) {
    this.alcances.update(prev => 
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  }

  reset() {
    this.name.set('');
    this.identifier.set('');
    this.tipo.set('Retailer');
    this.pais.set('Colombia');
    this.email.set('');
    this.alcances.set(['cotizacion', 'emision']);
    this.errors.set({});
    this.createdResult.set(null);
  }

  handleClose() {
    this.reset();
    this.closed.emit();
  }

  submit() {
    const e: Record<string, string> = {};
    if (!this.name().trim()) e['name'] = 'Requerido';
    
    const idVal = this.identifier().trim();
    if (!idVal) e['identifier'] = 'Requerido';
    else if (this.existingIdentifiers().includes(idVal.toLowerCase())) {
      e['identifier'] = 'Identificador duplicado';
    }
    
    if (!this.email().trim()) e['email'] = 'Requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email())) e['email'] = 'Correo inválido';
    
    if (this.alcances().length === 0) e['alcances'] = 'Seleccione al menos uno';
    
    this.errors.set(e);
    if (Object.keys(e).length) return;

    const secret = `sv_sec_${Math.random().toString(36).slice(2, 14)}`;
    
    const partner: Partner = {
      id: `s_${Math.random().toString(36).slice(2, 8)}`,
      name: this.name().trim(),
      identifier: idVal.toUpperCase(),
      tipo: this.tipo(),
      pais: this.pais(),
      contactEmail: this.email().trim(),
      alcances: this.alcances(),
      clientId: `sv_live_${Math.random().toString(36).slice(2, 8)}`,
      secret: secret.substring(0, 10) + '••••••••' + secret.substring(secret.length - 4),
      credentialStatus: 'Activa',
      apiContractStatus: 'Activo',
      versionContratoApi: 'v2',
      cuotaConsumo: 1000,
      enabledRamos: [],
      coveragesByRamo: {
        VIAJE: [],
        DISPOSITIVOS: [],
        MICROSEGURO_VIDA: [],
        PARAMETRICO: [],
        PROTECCION_PAGOS: [],
        VIDA_HIPOTECARIO: []
      },
      altaFecha: new Date().toISOString().slice(0, 16).replace('T', ' '),
      altaUsuario: 'Ana Gómez',
    };

    this.createdResult.set({ secret, partner });
  }

  goDetail() {
    const res = this.createdResult();
    if (res) {
      this.created.emit(res.partner);
      this.reset();
    }
  }
}
