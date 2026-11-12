import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { CredentialEvent, Partner, RotatedCredential } from '../../../../core/models/partner.model';
import { signInAs, signOut } from '../../../../core/testing/auth.testing';
import { toPartner } from '../../services/partners-api.mapper';
import { PartnersService } from '../../services/partners.service';
import { PARTNER_DTO } from '../../testing/partner.fixtures';
import { DEFAULT_GRACE_MINUTES, PartnerCredentialComponent } from './partner-credential.component';

const PARTNER = toPartner(PARTNER_DTO);
const ROTATED: Partner = { ...PARTNER, previousSecretExpiresAt: '2026-11-12 10:00' };
const EVENTS: CredentialEvent[] = [
  { id: 'e-2', type: 'revocada', actor: 'Carlos Ruiz', date: '2026-11-11 11:00', graceUntil: null },
  { id: 'e-1', type: 'rotada', actor: 'Ana Gómez', date: '2026-11-11 10:00', graceUntil: '2026-11-12 10:00' },
];

describe('PartnerCredentialComponent', () => {
  let fixture: ComponentFixture<PartnerCredentialComponent>;
  let el: HTMLElement;
  let loadCredentialEvents: ReturnType<typeof vi.fn<(partnerId: string) => Observable<CredentialEvent[]>>>;
  let rotateCredential: ReturnType<typeof vi.fn<(partnerId: string, minutes: number) => Observable<RotatedCredential>>>;
  let revokeCredential: ReturnType<typeof vi.fn<(partnerId: string) => Observable<Partner>>>;

  const byTestId = <T extends HTMLElement>(id: string): T | null => el.querySelector<T>(`[data-testid=${id}]`);
  const click = async (id: string): Promise<void> => {
    byTestId<HTMLButtonElement>(id)!.click();
    await fixture.whenStable();
  };

  const setup = async (roles: Parameters<typeof signInAs>[0] = ['administrador'], partner = PARTNER): Promise<void> => {
    signInAs(roles);
    await TestBed.configureTestingModule({
      imports: [PartnerCredentialComponent],
      providers: [{ provide: PartnersService, useValue: { loadCredentialEvents, rotateCredential, revokeCredential } }],
    }).compileComponents();
    fixture = TestBed.createComponent(PartnerCredentialComponent);
    fixture.componentRef.setInput('partner', partner);
    await fixture.whenStable();
    el = fixture.nativeElement;
  };

  beforeEach(() => {
    loadCredentialEvents = vi.fn<(partnerId: string) => Observable<CredentialEvent[]>>(() => of(EVENTS));
    rotateCredential = vi.fn<(partnerId: string, minutes: number) => Observable<RotatedCredential>>(() =>
      of({ partner: ROTATED, secret: 'sv_sec_nuevo123' }),
    );
    revokeCredential = vi.fn<(partnerId: string) => Observable<Partner>>(() =>
      of({ ...PARTNER, credentialStatus: 'Revocada' }),
    );
  });

  afterEach(() => signOut());

  it('lists the rotations and revocations with date and actor', async () => {
    await setup();

    const history = byTestId('partner-credential-events')!.textContent;
    expect(loadCredentialEvents).toHaveBeenCalledWith('s-1');
    expect(history).toContain('Revocada por Carlos Ruiz el 2026-11-11 11:00');
    expect(history).toContain('Rotada por Ana Gómez el 2026-11-11 10:00');
    expect(history).toContain('La credencial anterior sigue válida hasta 2026-11-12 10:00.');
  });

  it('rotates with the default grace window and shows the new secret once', async () => {
    await setup();

    await click('partner-credential-rotate');

    expect(rotateCredential).toHaveBeenCalledWith('s-1', DEFAULT_GRACE_MINUTES);
    expect(byTestId('partner-credential-secret')!.textContent).toBe('sv_sec_nuevo123');
    expect(loadCredentialEvents).toHaveBeenCalledTimes(2);
  });

  it('shows until when the previous secret is still valid', async () => {
    await setup(['administrador'], ROTATED);

    expect(byTestId('partner-credential-grace')!.textContent).toContain('2026-11-12 10:00');
  });

  it('rejects a grace window out of range', async () => {
    await setup();
    const input = byTestId<HTMLInputElement>('partner-credential-grace-input')!;
    input.value = '-5';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(el.textContent).toContain('La ventana debe ser un número entero entre 0 y 10080 minutos.');
    expect(byTestId<HTMLButtonElement>('partner-credential-rotate')!.disabled).toBe(true);
  });

  it('asks for confirmation before revoking and can be cancelled', async () => {
    await setup();

    await click('partner-credential-revoke');
    expect(revokeCredential).not.toHaveBeenCalled();
    expect(el.textContent).toContain('toda llamada del socio con esta credencial se rechaza');

    await click('partner-credential-revoke-cancel');
    expect(byTestId('partner-credential-revoke-cancel')).toBeNull();
  });

  it('revokes after the confirmation', async () => {
    await setup();

    await click('partner-credential-revoke');
    await click('partner-credential-revoke');

    expect(revokeCredential).toHaveBeenCalledWith('s-1');
    expect(loadCredentialEvents).toHaveBeenCalledTimes(2);
  });

  it('shows the backend error', async () => {
    rotateCredential.mockReturnValue(throwError(() => ({ status: 404, message: 'El socio no existe.' })));
    await setup();

    await click('partner-credential-rotate');

    expect(el.textContent).toContain('No se pudo actualizar la credencial: El socio no existe.');
  });

  it('lets a viewer read the history without changing the credential', async () => {
    loadCredentialEvents.mockReturnValue(throwError(() => new Error('down')));
    await setup(['consulta']);

    expect(byTestId('partner-credential-rotate')).toBeNull();
    expect(el.textContent).toContain('La credencial no se ha rotado ni revocado.');
  });
});
