import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Partner } from '../../../core/models/partner.model';
import { LocaleService } from '../../../core/services/locale.service';
import { toPartner, toPartnerConfig } from '../services/partners-api.mapper';
import { PartnersService } from '../services/partners.service';
import { provideCatalogFixture } from '../../../core/testing/catalog.fixtures';
import { PARTNER_CONFIG_DTO, PARTNER_CREATED_DTO, PARTNER_DTO } from '../testing/partner.fixtures';
import { PartnersPageComponent } from './partners-page.component';
import { signInAs, signOut } from '../../../core/testing/auth.testing';

describe('PartnersPageComponent', () => {
  let fixture: ComponentFixture<PartnersPageComponent>;
  let el: HTMLElement;
  const partners = signal<Partner[]>([]);
  const loading = signal(false);
  const loadError = signal<string | null>(null);
  const load = vi.fn();
  const service = {
    partners,
    loading,
    loadError,
    load,
    findById: (id: string | null) => partners().find((p) => p.id === id) ?? null,
    create: vi.fn(() => {
      const partner = toPartner(PARTNER_CREATED_DTO);
      partners.update((current) => [partner, ...current]);
      return of({ partner, secret: PARTNER_CREATED_DTO.secreto });
    }),
    loadConfig: vi.fn(() => of(toPartnerConfig(PARTNER_CONFIG_DTO))),
  };

  const button = (text: string): HTMLButtonElement =>
    Array.from(el.querySelectorAll('button')).find((item) => item.textContent?.includes(text))!;

  beforeEach(async () => {
    signInAs();
    partners.set([]);
    loading.set(false);
    loadError.set(null);
    load.mockClear();
    await TestBed.configureTestingModule({
      imports: [PartnersPageComponent],
      providers: [{ provide: PartnersService, useValue: service }, provideCatalogFixture()],
    }).compileComponents();
    fixture = TestBed.createComponent(PartnersPageComponent);
    await fixture.whenStable();
    el = fixture.nativeElement;
  });

  afterEach(() => signOut());

  it('loads the partners when the page opens', () => {
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('shows the page in English when the language changes', async () => {
    const locale = TestBed.inject(LocaleService);
    partners.set([toPartner(PARTNER_DTO)]);
    locale.setLocale('en');
    await fixture.whenStable();

    expect(el.querySelector('h1')?.textContent).toContain('Partners & Integrations');
    expect(el.textContent).toContain('Provisioned partners');
    expect(el.textContent).toContain('Active · v2');
    expect(button('New partner')).toBeTruthy();
    locale.setLocale('es');
  });

  it('shows an empty state while there are no partners', () => {
    expect(el.textContent).toContain('Aún no hay socios aprovisionados.');
  });

  it('lists the provisioned partners with their contract', async () => {
    partners.set([toPartner(PARTNER_DTO)]);
    await fixture.whenStable();

    expect(el.textContent).toContain('Fintech Demo');
    expect(el.textContent).toContain('FINTECH-DEMO');
    expect(el.textContent).toContain('Activo · v2');
  });

  it('lists the enabled lines of each partner', async () => {
    partners.set([{ ...toPartner(PARTNER_DTO), enabledRamos: [{ id: 'ramo-viaje', name: 'Viaje' }, { id: 'ramo-parametrico', name: 'Paramétrico (clima / vuelo)' }] }]);
    await fixture.whenStable();

    expect(el.textContent).toContain('Viaje, Paramétrico (clima / vuelo)');
  });

  it('shows the configuration of lines and coverages in the partner detail', async () => {
    partners.set([toPartner(PARTNER_DTO)]);
    await fixture.whenStable();

    button('Abrir').click();
    await fixture.whenStable();

    expect(service.loadConfig).toHaveBeenCalledWith('s-1');
    expect(el.querySelector('[data-testid=config-summary]')?.textContent).toContain('Protección de pagos: Desempleo involuntario');
  });

  it('shows the loading state', async () => {
    loading.set(true);
    await fixture.whenStable();

    expect(el.textContent).toContain('Cargando socios…');
  });

  it('offers a retry when the partners cannot be loaded', async () => {
    loadError.set('Servicio interno no disponible');
    await fixture.whenStable();

    expect(el.textContent).toContain('No fue posible cargar los socios.');
    button('Reintentar').click();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('opens the detail with the audit data of the partner', async () => {
    partners.set([toPartner(PARTNER_DTO)]);
    await fixture.whenStable();

    button('Abrir').click();
    await fixture.whenStable();

    expect(el.textContent).toContain('Alta 2026-09-12 13:00 por Ana Gómez');
    expect(el.textContent).toContain('client_id: sv_live_fintechdemo_ab12');
    expect(el.textContent).toContain('secreto: sv_sec_••••••••ykwi');

    button('Volver a socios').click();
    await fixture.whenStable();
    expect(el.textContent).toContain('Socios aprovisionados');
  });

  it('goes to the detail of a partner right after creating it', async () => {
    button('Nuevo socio').click();
    await fixture.whenStable();
    const inputs = el.querySelectorAll<HTMLInputElement>('input[slvInput]');
    ['Fintech Demo', 'FINTECH-DEMO', 'ops@fintech.demo'].forEach((value, index) => {
      inputs[index].value = value;
      inputs[index].dispatchEvent(new Event('input'));
    });
    el.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    await fixture.whenStable();
    button('Crear y aprovisionar').click();
    await fixture.whenStable();

    button('Ir al detalle del socio').click();
    await fixture.whenStable();

    expect(el.querySelector('[role=dialog]')).toBeNull();
    expect(el.textContent).toContain('Contrato API: Activo · v2');
    expect(el.textContent).not.toContain('sv_sec_wp3wshvykwi');
  });

  it('offers the new partner button to an administrator', () => {
    expect(button('Nuevo socio')).toBeTruthy();
    expect(el.querySelector('[data-testid=partners-read-only]')).toBeNull();
  });
});

describe('PartnersPageComponent as a read-only operator', () => {
  afterEach(() => signOut());

  it('hides the new partner button and explains why', async () => {
    signInAs(['consulta']);
    await TestBed.configureTestingModule({
      imports: [PartnersPageComponent],
      providers: [{ provide: PartnersService, useValue: { partners: signal([]), loading: signal(false), loadError: signal(null), load: vi.fn(), findById: () => null } }],
    }).compileComponents();
    const fixture = TestBed.createComponent(PartnersPageComponent);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;

    expect(Array.from(el.querySelectorAll('button')).some((item) => item.textContent?.includes('Nuevo socio'))).toBe(false);
    expect(el.querySelector('[data-testid=partners-read-only]')?.textContent).toContain('Solo un administrador puede dar de alta socios.');
  });
});
