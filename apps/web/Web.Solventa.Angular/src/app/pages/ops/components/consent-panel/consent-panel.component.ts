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
import { LocaleService } from '../../../../core/services/locale.service';
import { SessionService } from '../../../../core/services/session.service';

export type ConsentPanelState = 'idle' | 'enviando' | 'pending' | 'validando' | 'validated';

/** Texto del error del backend: `detail` como texto o `{ codigo, mensaje }`. */
function detailMessage(errorField: object): string | null {
  const detail = (errorField as Record<string, unknown>)['detail'];
  const text = typeof detail === 'string' ? detail : (detail as { mensaje?: unknown } | null)?.mensaje;
  return typeof text === 'string' && text.trim().length > 0 ? text : null;
}

/** Consentimiento digital Open Finance / Open Data (solo obligatorio en ramos que lo requieren). */
@Component({
  selector: 'slv-consent-panel',
  imports: [
    FormsModule,
    CardComponent,
    AlertComponent,
    FieldComponent,
    InputDirective,
    ButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consent-panel.component.html',
})
export class ConsentPanelComponent {
  protected readonly locale = inject(LocaleService);
  private readonly consentService = inject(ConsentService);
  private readonly session = inject(SessionService);

  readonly required = input.required<boolean>();
  readonly ramoLabel = input.required<string>();
  readonly ramoId = input<string>('');
  readonly celular = input<string>('');
  readonly correo = input<string>('');
  readonly documento = input<string>('');
  readonly tipoDocumento = input<string>('');
  readonly nombre = input<string>('');
  readonly apellido = input<string>('');
  readonly fechaNacimiento = input<string>('');
  readonly readOnly = input(false);
  readonly requested = output<void>();
  readonly consentValidated = output<string>();

  protected readonly channels = CONSENT_CHANNELS;
  protected readonly channel = signal<'sms' | 'email'>(CONSENT_CHANNELS[0].id);
  protected readonly openFinance = signal(true);
  protected readonly openData = signal(true);

  protected readonly estado = signal<ConsentPanelState>('idle');
  protected readonly codigoInput = signal('');
  protected readonly codigoDemo = signal('');
  private readonly contactoMaskBackend = signal('');
  protected readonly consentimientoId = signal('');
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly registro = signal<RespuestaConsultaConsentimiento | null>(null);
  protected readonly recordUnavailable = signal(false);

  protected readonly contactoDestino = computed(() => {
    if (this.channel() === 'sms') {
      return this.celular()?.trim() ?? '';
    } else {
      return this.correo()?.trim() ?? '';
    }
  });

  protected readonly demoHint = computed(() =>
    this.locale.t('consent.hint', {
      channel: this.locale.t(this.channel() === 'sms' ? 'consent.hint.sms' : 'consent.hint.email'),
      destination: this.contactoMaskBackend(),
      code: this.codigoDemo(),
    }),
  );

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const errorObj = err as Record<string, unknown>;
      const errorField = errorObj['error'];
      const detail = errorField && typeof errorField === 'object' ? detailMessage(errorField) : null;
      if (detail) {
        return detail;
      }
      const message = errorObj['message'];
      if (
        typeof message === 'string' &&
        !message.startsWith('Http failure') &&
        message.trim().length > 0
      ) {
        return message;
      }
    }
    return fallback;
  }

  private advisor(): string {
    return `${this.session.userName()} (asesor)`.trim();
  }

  private resolveEmail(destino: string): string {
    const rawCorreo = this.correo()?.trim();
    if (rawCorreo && rawCorreo.length > 0) {
      return rawCorreo;
    }
    return this.channel() === 'email' ? destino : '';
  }

  private resolveTelefono(destino: string): string {
    const rawCelular = this.celular()?.trim();
    if (rawCelular && rawCelular.length > 0) {
      return rawCelular;
    }
    return this.channel() === 'sms' ? destino : '';
  }

  private buildSolicitudPayload(destino: string): SolicitudConsentimiento {
    const doc = this.documento()?.trim();
    const rawTipoDoc = this.tipoDocumento()?.trim();
    const rawNombre = this.nombre()?.trim();
    const rawApellido = this.apellido()?.trim();
    const rawNacimiento = this.fechaNacimiento()?.trim();

    return {
      tipo_documento: rawTipoDoc || undefined,
      numero_documento: doc ?? '',
      nombre: rawNombre ?? '',
      apellido: rawApellido ?? '',
      email: this.resolveEmail(destino),
      telefono: this.resolveTelefono(destino),
      fecha_nacimiento: rawNacimiento && rawNacimiento.length > 0 ? rawNacimiento : undefined,
      ramo: this.ramoId(),
      canal: this.channel(),
      contacto: destino,
      open_finance: this.openFinance(),
      open_data: this.openData(),
      asesor: this.advisor(),
    };
  }

  solicitarConsentimiento(): void {
    const destino = this.contactoDestino();
    if (!destino) {
      const contact = this.locale.t(this.channel() === 'sms' ? 'consent.contact.sms' : 'consent.contact.email');
      this.errorMsg.set(this.locale.t('consent.error.contactMissing', { contact }));
      return;
    }

    this.estado.set('enviando');
    this.errorMsg.set(null);
    this.requested.emit();

    const payload = this.buildSolicitudPayload(destino);

    this.consentService.solicitar(payload).subscribe({
      next: (resp) => {
        this.consentimientoId.set(resp.consentimiento_id);
        this.codigoDemo.set(resp.codigo_demo);
        this.contactoMaskBackend.set(resp.contacto_mask);
        this.codigoInput.set(resp.codigo_demo);
        this.estado.set('pending');
      },
      error: (err) => {
        this.errorMsg.set(this.extractErrorMessage(err, this.locale.t('consent.error.request')));
        this.estado.set('idle');
      },
    });
  }

  validarCodigo(): void {
    if (!this.codigoInput().trim()) {
      this.errorMsg.set(this.locale.t('consent.error.codeMissing'));
      return;
    }

    this.estado.set('validando');
    this.errorMsg.set(null);
    this.recordUnavailable.set(false);

    this.consentService.validar(this.consentimientoId(), this.codigoInput().trim()).subscribe({
      next: () => {
        this.consentService.consultar(this.consentimientoId()).subscribe({
          next: (reg) => {
            this.registro.set(reg);
            this.estado.set('validated');
            this.consentValidated.emit(this.consentimientoId());
          },
          error: () => {
            this.registro.set(null);
            this.recordUnavailable.set(true);
            this.estado.set('validated');
            this.consentValidated.emit(this.consentimientoId());
          },
        });
      },
      error: (err) => {
        this.errorMsg.set(
          this.extractErrorMessage(err, this.locale.t('consent.error.codeInvalid')),
        );
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
    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }
}
