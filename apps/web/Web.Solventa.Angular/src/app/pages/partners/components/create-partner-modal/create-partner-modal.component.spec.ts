import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiError } from '../../../../core/interfaces/api-response.interface';
import { NewPartner, PartnerCreated } from '../../../../core/models/partner.model';
import { toPartner } from '../../services/partners-api.mapper';
import { PartnersService } from '../../services/partners.service';
import { PARTNER_CREATED_DTO } from '../../testing/partner.fixtures';
import { CreatePartnerModalComponent } from './create-partner-modal.component';

const CREATED: PartnerCreated = { partner: toPartner(PARTNER_CREATED_DTO), secret: PARTNER_CREATED_DTO.secreto };

describe('CreatePartnerModalComponent', () => {
  let fixture: ComponentFixture<CreatePartnerModalComponent>;
  let el: HTMLElement;
  let create: ReturnType<typeof vi.fn<(partner: NewPartner) => Observable<PartnerCreated>>>;

  const button = (text: string): HTMLButtonElement =>
    Array.from(el.querySelectorAll('button')).find((item) => item.textContent?.includes(text))!;

  const type = async (index: number, value: string): Promise<void> => {
    const input = el.querySelectorAll<HTMLInputElement>('input[slvInput]')[index];
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  const fillForm = async (): Promise<void> => {
    await type(0, 'Fintech Demo');
    await type(1, 'FINTECH-DEMO');
    await type(2, 'ops@fintech.demo');
  };

  const submit = async (): Promise<void> => {
    button('Crear y aprovisionar').click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    create = vi.fn<(partner: NewPartner) => Observable<PartnerCreated>>(() => of(CREATED));
    await TestBed.configureTestingModule({
      imports: [CreatePartnerModalComponent],
      providers: [{ provide: PartnersService, useValue: { create } }],
    }).compileComponents();
    fixture = TestBed.createComponent(CreatePartnerModalComponent);
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  it('requires name, identifier, email and at least one scope', async () => {
    el.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach((checkbox) => checkbox.checked && checkbox.click());
    await submit();

    expect(el.textContent).toContain('Requerido');
    expect(el.textContent).toContain('Seleccione al menos uno');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects malformed identifier and email before calling the backend', async () => {
    await type(0, 'Fintech Demo');
    await type(1, 'con espacios');
    await type(2, 'sin-arroba');
    await submit();

    expect(el.textContent).toContain('Use letras, números y guiones (mínimo 2)');
    expect(el.textContent).toContain('Correo inválido');
    expect(create).not.toHaveBeenCalled();
  });

  it('provisions the partner and shows credentials, contract and audit trail', async () => {
    await fillForm();
    await submit();

    expect(create).toHaveBeenCalledWith({
      name: 'Fintech Demo',
      identifier: 'FINTECH-DEMO',
      tipo: 'Retailer',
      pais: 'Colombia',
      contactEmail: 'ops@fintech.demo',
      alcances: ['cotizacion', 'emision'],
    });
    expect(el.textContent).toContain('Guarde el secreto: solo se muestra esta vez.');
    expect(el.querySelector('[data-testid=client-id]')?.textContent).toBe('sv_live_fintechdemo_ab12');
    expect(el.querySelector('[data-testid=secret]')?.textContent).toBe('sv_sec_wp3wshvykwi');
    expect(el.textContent).toContain('Activo · v2');
    const trail = el.querySelector('[data-testid=audit-trail]')!.textContent;
    expect(trail).toContain('2026-09-12 13:00');
    expect(trail).toContain('Ana Gómez');
    expect(trail).toContain('Cotización, Emisión, Consulta de pólizas y siniestros');
  });

  it('shows the reason on the identifier when it already exists', async () => {
    const duplicated: ApiError = {
      status: 409,
      code: 'identificador_duplicado',
      message: 'Ya existe un socio con este identificador. No es posible crearlo de nuevo.',
    };
    create.mockReturnValue(throwError(() => duplicated));
    await fillForm();
    await submit();

    expect(el.textContent).toContain('Ya existe un socio con este identificador. No es posible crearlo de nuevo.');
    expect(el.querySelector('[data-testid=secret]')).toBeNull();
    expect(button('Crear y aprovisionar').disabled).toBe(false);
  });

  it('shows a general error when the backend fails', async () => {
    create.mockReturnValue(throwError(() => ({ status: 503, message: 'Servicio interno no disponible' })));
    await fillForm();
    await submit();

    expect(el.textContent).toContain('No fue posible crear el socio. Intente de nuevo.');
    expect(el.querySelector('[data-testid=secret]')).toBeNull();
  });

  it('blocks a second submit while the partner is being created', async () => {
    const pending = new Subject<PartnerCreated>();
    create.mockReturnValue(pending);
    await fillForm();
    await submit();

    expect(button('Creando…').disabled).toBe(true);
    button('Creando…').click();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('emits the created partner and forgets the secret when leaving', async () => {
    const created = vi.fn();
    fixture.componentInstance.created.subscribe(created);
    await fillForm();
    await submit();

    button('Ir al detalle del socio').click();
    await fixture.whenStable();

    expect(created).toHaveBeenCalledWith(CREATED.partner);
    expect(fixture.componentInstance.createdResult()).toBeNull();
    expect(el.textContent).not.toContain('sv_sec_wp3wshvykwi');
  });

  it('closes without creating when cancelled', async () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    await type(0, 'Fintech Demo');

    button('Cancelar').click();

    expect(closed).toHaveBeenCalled();
    expect(fixture.componentInstance.name()).toBe('');
    expect(create).not.toHaveBeenCalled();
  });
});
