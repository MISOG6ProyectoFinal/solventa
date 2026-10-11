import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { PartnerConfig } from '../../../../core/models/partner.model';
import { toPartner, toPartnerConfig } from '../../services/partners-api.mapper';
import { PartnersService } from '../../services/partners.service';
import { PARTNER_CONFIG_DTO, PARTNER_DTO } from '../../testing/partner.fixtures';
import { RamosConfigComponent } from './ramos-config.component';

const CONFIG = toPartnerConfig(PARTNER_CONFIG_DTO);

describe('RamosConfigComponent', () => {
  let fixture: ComponentFixture<RamosConfigComponent>;
  let el: HTMLElement;
  let loadConfig: ReturnType<typeof vi.fn<(partnerId: string) => Observable<PartnerConfig>>>;
  let saveConfig: ReturnType<typeof vi.fn<(partnerId: string, config: PartnerConfig) => Observable<PartnerConfig>>>;

  const card = (ramoId: string): HTMLElement => el.querySelector<HTMLElement>(`[data-ramo=${ramoId}]`)!;
  const toggle = (ramoId: string): HTMLButtonElement => card(ramoId).querySelector<HTMLButtonElement>('[role=switch]')!;
  const coverage = (ramoId: string, name: string): HTMLInputElement =>
    Array.from(card(ramoId).querySelectorAll('label'))
      .find((label) => label.textContent?.includes(name))!
      .querySelector('input')!;
  const summary = (): string => el.querySelector('[data-testid=config-summary]')!.textContent ?? '';
  const savedConfig = (call = 0): PartnerConfig => saveConfig.mock.calls[call][1];
  const enabledIn = (config: PartnerConfig): Record<string, string[]> =>
    Object.fromEntries(
      config.ramos.filter((r) => r.enabled).map((r) => [r.id, r.coverages.filter((c) => c.enabled).map((c) => c.id)]),
    );

  const create = async (partnerId = 's-1'): Promise<void> => {
    fixture = TestBed.createComponent(RamosConfigComponent);
    fixture.componentRef.setInput('partner', { ...toPartner(PARTNER_DTO), id: partnerId });
    await fixture.whenStable();
    el = fixture.nativeElement;
  };

  beforeEach(async () => {
    loadConfig = vi.fn<(partnerId: string) => Observable<PartnerConfig>>(() => of(CONFIG));
    saveConfig = vi.fn<(partnerId: string, config: PartnerConfig) => Observable<PartnerConfig>>((_id, config) => of(config));
    await TestBed.configureTestingModule({
      imports: [RamosConfigComponent],
      providers: [{ provide: PartnersService, useValue: { loadConfig, saveConfig } }],
    }).compileComponents();
  });

  it('shows the current lines of the partner with their state', async () => {
    await create();

    expect(loadConfig).toHaveBeenCalledWith('s-1');
    expect(card('ramo-viaje').textContent).toContain('Deshabilitado');
    expect(toggle('ramo-viaje').getAttribute('aria-checked')).toBe('false');
    expect(card('ramo-proteccion-pagos').textContent).toContain('Habilitado');
    expect(coverage('ramo-proteccion-pagos', 'Desempleo involuntario').checked).toBe(true);
    expect(coverage('ramo-proteccion-pagos', 'Incapacidad temporal').checked).toBe(false);
    expect(card('ramo-viaje').querySelector('input[type=checkbox]')).toBeNull();
  });

  it('summarizes the configuration in force and who changed it', async () => {
    await create();

    expect(summary()).toContain('Protección de pagos: Desempleo involuntario');
    expect(summary()).toContain('Actualizada 2026-10-01 09:00 por Carlos Ruiz');
    expect(el.textContent).toContain('Los cambios aplican a las siguientes solicitudes del socio.');
  });

  it('enables a line without coverages and saves it', async () => {
    await create();

    toggle('ramo-viaje').click();
    await fixture.whenStable();

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig.mock.calls[0][0]).toBe('s-1');
    expect(enabledIn(savedConfig())).toEqual({ 'ramo-viaje': [], 'ramo-proteccion-pagos': ['pagos-desempleo'] });
    expect(summary()).toContain('Viaje: Sin coberturas seleccionadas');
  });

  it('selects coverages of an enabled line', async () => {
    await create();

    coverage('ramo-proteccion-pagos', 'Incapacidad temporal').click();
    await fixture.whenStable();

    expect(enabledIn(savedConfig())).toEqual({ 'ramo-proteccion-pagos': ['pagos-desempleo', 'pagos-incapacidad-temporal'] });
    expect(summary()).toContain('Protección de pagos: Desempleo involuntario, Incapacidad temporal');
  });

  it('removes a line together with its coverages', async () => {
    await create();

    toggle('ramo-proteccion-pagos').click();
    await fixture.whenStable();

    expect(enabledIn(savedConfig())).toEqual({});
    expect(summary()).toContain('El socio no tiene ramos habilitados.');
    expect(card('ramo-proteccion-pagos').querySelector('input[type=checkbox]')).toBeNull();
  });

  it('restores the configuration in force when the change cannot be saved', async () => {
    saveConfig.mockReturnValue(throwError(() => ({ status: 503, message: 'Servicio interno no disponible' })));
    await create();

    toggle('ramo-viaje').click();
    await fixture.whenStable();

    expect(el.textContent).toContain('No fue posible guardar el cambio. Se conserva la configuración vigente.');
    expect(card('ramo-viaje').textContent).toContain('Deshabilitado');
    expect(summary()).not.toContain('Viaje');
  });

  it('keeps only the answer of the last change when several are made in a row', async () => {
    const first = new Subject<PartnerConfig>();
    const second = new Subject<PartnerConfig>();
    saveConfig.mockReturnValueOnce(first).mockReturnValueOnce(second);
    await create();

    toggle('ramo-viaje').click();
    await fixture.whenStable();
    expect(summary()).toContain('Guardando…');
    coverage('ramo-viaje', 'Cancelación de viaje').click();
    await fixture.whenStable();

    second.next(savedConfig(1));
    first.next(savedConfig(0));
    await fixture.whenStable();

    expect(enabledIn(savedConfig(1))['ramo-viaje']).toEqual(['viaje-cancelacion']);
    expect(summary()).toContain('Viaje: Cancelación de viaje');
    expect(summary()).not.toContain('Guardando…');
  });

  it('reports when the configuration cannot be loaded', async () => {
    loadConfig.mockReturnValue(throwError(() => ({ status: 503, message: 'Servicio interno no disponible' })));
    await create();

    expect(el.textContent).toContain('No fue posible cargar la configuración del socio.');
    expect(el.querySelector('[data-ramo]')).toBeNull();
  });

  it('loads the configuration of the other partner without mixing them', async () => {
    await create();
    loadConfig.mockReturnValue(of({ ...CONFIG, ramos: CONFIG.ramos.map((r) => ({ ...r, enabled: false })) }));

    fixture.componentRef.setInput('partner', { ...toPartner(PARTNER_DTO), id: 's-2' });
    await fixture.whenStable();

    expect(loadConfig).toHaveBeenLastCalledWith('s-2');
    expect(summary()).toContain('El socio no tiene ramos habilitados.');
  });

  it('does not reload when the same partner is refreshed after saving', async () => {
    await create();

    fixture.componentRef.setInput('partner', { ...toPartner(PARTNER_DTO), enabledRamos: [{ id: 'ramo-viaje', name: 'Viaje' }] });
    await fixture.whenStable();

    expect(loadConfig).toHaveBeenCalledTimes(1);
  });
});
