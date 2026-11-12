import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { Partner, PartnerQuotaUsage } from '../../../../core/models/partner.model';
import { signInAs, signOut } from '../../../../core/testing/auth.testing';
import { toPartner } from '../../services/partners-api.mapper';
import { PartnersService } from '../../services/partners.service';
import { PARTNER_DTO } from '../../testing/partner.fixtures';
import { PartnerQuotaComponent } from './partner-quota.component';

const PARTNER = toPartner(PARTNER_DTO);
const USAGE: PartnerQuotaUsage = { quota: 1000, used: 120, resetInSeconds: 42, nearLimit: false };

describe('PartnerQuotaComponent', () => {
  let fixture: ComponentFixture<PartnerQuotaComponent>;
  let el: HTMLElement;
  let loadUsage: ReturnType<typeof vi.fn<(partnerId: string) => Observable<PartnerQuotaUsage>>>;
  let updateQuota: ReturnType<typeof vi.fn<(partnerId: string, quota: number) => Observable<Partner>>>;

  const byTestId = <T extends HTMLElement>(id: string): T | null => el.querySelector<T>(`[data-testid=${id}]`);

  const setup = async (roles: Parameters<typeof signInAs>[0] = ['administrador']): Promise<void> => {
    signInAs(roles);
    await TestBed.configureTestingModule({
      imports: [PartnerQuotaComponent],
      providers: [{ provide: PartnersService, useValue: { loadUsage, updateQuota } }],
    }).compileComponents();
    fixture = TestBed.createComponent(PartnerQuotaComponent);
    fixture.componentRef.setInput('partner', PARTNER);
    await fixture.whenStable();
    el = fixture.nativeElement;
  };

  const typeQuota = async (value: string): Promise<void> => {
    const input = byTestId<HTMLInputElement>('partner-quota-input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  beforeEach(() => {
    loadUsage = vi.fn<(partnerId: string) => Observable<PartnerQuotaUsage>>(() => of(USAGE));
    updateQuota = vi.fn<(partnerId: string, quota: number) => Observable<Partner>>((_id, quota) =>
      of({ ...PARTNER, cuotaConsumo: quota }),
    );
  });

  afterEach(() => signOut());

  it('shows the usage of the current minute against the quota', async () => {
    await setup();

    expect(loadUsage).toHaveBeenCalledWith('s-1');
    expect(byTestId('partner-quota-usage')!.textContent).toContain('Consumo del minuto actual: 120 de 1,000 solicitudes');
    expect(el.textContent).not.toContain('cerca de su cuota');
  });

  it('warns when the partner is close to its quota', async () => {
    loadUsage.mockReturnValue(of({ ...USAGE, used: 850, nearLimit: true }));

    await setup();

    expect(el.textContent).toContain('El socio está cerca de su cuota.');
  });

  it('tells when the usage cannot be loaded', async () => {
    loadUsage.mockReturnValue(throwError(() => new Error('down')));

    await setup();

    expect(el.textContent).toContain('No se pudo consultar el consumo del socio.');
    expect(byTestId('partner-quota-usage')).toBeNull();
  });

  it('saves a new quota and reloads the usage', async () => {
    await setup();
    await typeQuota('50');

    byTestId<HTMLButtonElement>('partner-quota-save')!.click();
    await fixture.whenStable();

    expect(updateQuota).toHaveBeenCalledWith('s-1', 50);
    expect(loadUsage).toHaveBeenCalledTimes(2);
  });

  it('does not save a quota that is not a positive whole number', async () => {
    await setup();
    await typeQuota('0');

    expect(el.textContent).toContain('La cuota debe ser un número entero mayor que cero.');
    expect(byTestId<HTMLButtonElement>('partner-quota-save')!.disabled).toBe(true);
    fixture.componentInstance.save();
    expect(updateQuota).not.toHaveBeenCalled();
  });

  it('shows the backend error when the quota cannot be saved', async () => {
    updateQuota.mockReturnValue(throwError(() => ({ status: 404, message: 'El socio no existe.' })));
    await setup();

    byTestId<HTMLButtonElement>('partner-quota-save')!.click();
    await fixture.whenStable();

    expect(el.textContent).toContain('No se pudo guardar la cuota: El socio no existe.');
  });

  it('lets a viewer see the usage but not change the quota', async () => {
    await setup(['consulta']);

    expect(byTestId('partner-quota-usage')).not.toBeNull();
    expect(byTestId('partner-quota-input')).toBeNull();
  });

  it('refreshes the usage on demand', async () => {
    await setup();

    byTestId<HTMLButtonElement>('partner-quota-refresh')!.click();

    expect(loadUsage).toHaveBeenCalledTimes(2);
  });
});
