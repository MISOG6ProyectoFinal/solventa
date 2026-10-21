import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputDirective } from '../../../../shared/directives/input.directive';
import { AlertComponent } from '../../../../ui/components/alert/alert.component';
import { ButtonComponent } from '../../../../ui/components/button/button.component';
import { CardComponent } from '../../../../ui/components/card/card.component';
import { FieldComponent } from '../../../../ui/components/field/field.component';
import { CONSENT_CHANNELS } from '../../constants/ops.constants';
import {
  RespuestaConsultaConsentimiento,
  SolicitudConsentimiento,
} from '../../interfaces/consent.interface';
import { ConsentService } from '../../services/consent.service';

export type ConsentPanelState = 'idle' | 'enviando' | 'pending' | 'validando' | 'validated';

/** Consentimiento digital Open Finance / Open Data (solo obligatorio en ramos que lo requieren). */
@Component({
  selector: 'slv-consent-panel',
  imports: [FormsModule, CardComponent, AlertComponent, FieldComponent, InputDirective, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consent-panel.component.html',
})
export class ConsentPanelComponent {
  private readonly consentService = inject(ConsentService);

  readonly required = input.required<boolean>();
  readonly ramoLabel = input.required<string>();
  readonly ramoId = input<string>('VIDA_HIPOTECARIO');
  readonly celular = input<string>('');
  readonly correo = input<string>('');
  readonly documento = input<string>('');
  readonly tipoDocumento = input<string>('CC');
  readonly nombre = input<string>('');
  readonly fechaNacimiento = input<string>('');
  readonly requested = output<void>();
  readonly consentValidated = output<boolean>();

  protected readonly channels = CONSENT_CHANNELS;
  protected readonly channel = signal<'sms' | 'email'>(CONSENT_CHANNELS[0].id as 'sms' | 'email');
  protected readonly openFinance = signal(true);
  protected readonly openData = signal(true);

  protected readonly estado = signal<ConsentPanelState>('idle');
  protected readonly codigoInput = signal('');
  protected readonly codigoDemo = signal('');
  private readonly contactoMaskBackend = signal<string | null>(null);
  protected readonly consentimientoId = signal('');
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly registro = signal<RespuestaConsultaConsentimiento | null>(null);

  protected readonly contactoDestino = computed(() => {
    if (this.channel() === 'sms') {
      return this.celular()?.trim() || '';
    } else {
      return this.correo()?.trim() || '';
    }
  });

  protected readonly contactoMask = computed(() => {
    const destino = this.contactoDestino();
    if (this.channel() === 'sms') {
      const digits = destino.replace(/\D/g, '');
      if (digits.length >= 4) {
        return `***${digits.slice(-4)}`;
      }
      return destino || '***4567';
    } else {
      if (destino && destino.includes('@')) {
        const [user, domain] = destino.split('@');
        const visible = user.length > 2 ? user.slice(0, 2) : user.slice(0, 1);
        return `${visible}***@${domain}`;
      }
      return destino || 'cliente@ejemplo.com';
    }
  });

  protected readonly contactoMaskDisplay = computed(() => {
    return this.contactoMaskBackend() || this.contactoMask();
  });

  protected readonly demoHint = computed(() => {
    const mask = this.contactoMaskDisplay();
    const canalTxt = this.channel() === 'sms' ? 'al celular' : 'al correo';
    return `Código enviado ${canalTxt} ${mask}. Para la demo use ${this.codigoDemo() || '123456'}.`;
  });

  solicitarConsentimiento(): void {
    const destino = this.contactoDestino();
    if (!destino) {
      const canalTxt = this.channel() === 'sms' ? 'el celular' : 'el correo electrónico';
      this.errorMsg.set(`Por favor ingrese ${canalTxt} del cliente en el formulario antes de solicitar el código.`);
      return;
    }

    this.estado.set('enviando');
    this.errorMsg.set(null);
    this.requested.emit();

    const doc = this.documento()?.trim();
    const clienteId = doc ? `CLI-${doc}` : 'CLI-51502';

    const alcances: string[] = [];
    if (this.openFinance()) alcances.push('Open Finance');
    if (this.openData()) alcances.push('Open Data');

    const payload: SolicitudConsentimiento = {
      cliente_id: clienteId,
      tipo_documento: this.tipoDocumento() || 'CC',
      numero_documento: doc || '',
      nombre: this.nombre() || 'Cliente',
      email: this.correo() || (this.channel() === 'email' ? destino : ''),
      telefono: this.celular() || (this.channel() === 'sms' ? destino : ''),
      fecha_nacimiento: this.fechaNacimiento() || undefined,
      pais: 'Colombia',
      ramo: this.ramoId(),
      canal: this.channel(),
      contacto: destino,
      contacto_mask: this.contactoMask(),
      alcance: alcances,
      open_finance: this.openFinance(),
      open_data: this.openData(),
      asesor: 'Ana Gómez (asesor)',
    };

    this.consentService.solicitar(payload).subscribe({
      next: (resp) => {
        this.consentimientoId.set(resp.consentimiento_id);
        this.codigoDemo.set(resp.codigo_demo);
        if (resp.contacto_mask) {
          this.contactoMaskBackend.set(resp.contacto_mask);
        }
        this.codigoInput.set(resp.codigo_demo);
        this.estado.set('pending');
      },
      error: (err) => {
        const msg =
          err?.error?.detail ||
          (typeof err?.message === 'string' && !err.message.startsWith('Http failure') ? err.message : null) ||
          'Error al solicitar código OTP';
        this.errorMsg.set(msg);
        this.estado.set('idle');
      },
    });
  }

  validarCodigo(): void {
    if (!this.codigoInput().trim()) {
      this.errorMsg.set('Ingrese el código dictado por el cliente');
      return;
    }

    this.estado.set('validando');
    this.errorMsg.set(null);

    this.consentService.validar(this.consentimientoId(), this.codigoInput().trim()).subscribe({
      next: () => {
        this.consentService.consultar(this.consentimientoId()).subscribe({
          next: (reg) => {
            this.registro.set(reg);
            this.estado.set('validated');
            this.consentValidated.emit(true);
          },
          error: () => {
            this.registro.set({
              consentimiento_id: this.consentimientoId(),
              cliente_id: `CLI-${this.documento() || '51502'}`,
              cliente_nombre: this.nombre() || 'Cliente',
              cliente_documento: `${this.tipoDocumento()} ${this.documento()}`.trim(),
              estado: 'Otorgado',
              fuente: `${this.channel() === 'sms' ? 'SMS' : 'Correo'}: ${this.contactoDestino()}`,
              fecha_otorgamiento: new Date().toISOString().replace('T', ' ').substring(0, 16),
              fecha_hora: new Date().toISOString().replace('T', ' ').substring(0, 16),
              asesor: 'Ana Gómez (asesor)',
              canal: this.channel() === 'sms' ? 'Código por SMS' : 'Código por correo electrónico',
              contacto: this.contactoDestino(),
              alcance:
                [this.openFinance() ? 'Open Finance' : '', this.openData() ? 'Open Data' : '']
                  .filter(Boolean)
                  .join(', ') || 'Ninguno',
            });
            this.estado.set('validated');
            this.consentValidated.emit(true);
          },
        });
      },
      error: (err) => {
        const msg =
          err?.error?.detail ||
          (typeof err?.message === 'string' && !err.message.startsWith('Http failure') ? err.message : null) ||
          'Código OTP incorrecto. Vuelva a intentarlo.';
        this.errorMsg.set(msg);
        this.estado.set('pending');
      },
    });
  }

  reenviar(): void {
    this.solicitarConsentimiento();
  }

  blockNonNumeric(event: KeyboardEvent): void {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Enter'];
    if (allowed.includes(event.key) || event.ctrlKey || event.metaKey) return;
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }
}
