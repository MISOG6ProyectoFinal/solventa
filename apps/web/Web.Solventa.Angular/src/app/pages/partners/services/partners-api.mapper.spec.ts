import { PARTNER_CONFIG_DTO, PARTNER_DTO } from '../testing/partner.fixtures';
import {
  formatTimestamp,
  toNewPartnerDto,
  toPartner,
  toPartnerConfig,
  toPartnerConfigUpdateDto,
} from './partners-api.mapper';

describe('partners API mapper', () => {
  it('maps the backend partner to the portal model', () => {
    const partner = toPartner(PARTNER_DTO);

    expect(partner).toMatchObject({
      id: 's-1',
      name: 'Fintech Demo',
      identifier: 'FINTECH-DEMO',
      contactEmail: 'ops@fintech.demo',
      clientId: 'sv_live_fintechdemo_ab12',
      secret: 'sv_sec_••••••••ykwi',
      apiContractStatus: 'Activo',
      versionContratoApi: 'v2',
      credentialStatus: 'Activa',
      altaFecha: '2026-09-12 13:00',
      altaUsuario: 'Ana Gómez',
      enabledRamos: [],
    });
  });

  it('builds the provisioning request with the authorizing user', () => {
    const dto = toNewPartnerDto(
      {
        name: '  Fintech Demo ',
        identifier: ' fintech-demo ',
        tipo: 'Fintech',
        pais: 'Colombia',
        contactEmail: ' ops@fintech.demo ',
        alcances: ['cotizacion'],
      },
      'Ana Gómez',
    );

    expect(dto).toEqual({
      nombre: 'Fintech Demo',
      identificador: 'fintech-demo',
      tipo: 'Fintech',
      pais: 'Colombia',
      correo_contacto: 'ops@fintech.demo',
      alcances: ['cotizacion'],
      autorizado_por: 'Ana Gómez',
    });
  });

  it('maps the enabled lines of the partner', () => {
    const partner = toPartner({ ...PARTNER_DTO, ramos_habilitados: [{ id: 'ramo-viaje', nombre: 'Viaje' }] });

    expect(partner.enabledRamos).toEqual([{ id: 'ramo-viaje', name: 'Viaje' }]);
  });

  it('maps the configuration with its audit trail', () => {
    const config = toPartnerConfig(PARTNER_CONFIG_DTO);

    expect(config.updatedAt).toBe('2026-10-01 09:00');
    expect(config.updatedBy).toBe('Carlos Ruiz');
    expect(config.ramos[1]).toEqual({
      id: 'ramo-proteccion-pagos',
      name: 'Protección de pagos',
      enabled: true,
      coverages: [
        { id: 'pagos-desempleo', name: 'Desempleo involuntario', enabled: true },
        { id: 'pagos-incapacidad-temporal', name: 'Incapacidad temporal', enabled: false },
      ],
    });
    expect(toPartnerConfig({ ...PARTNER_CONFIG_DTO, actualizado_en: null, actualizado_por: null }).updatedAt).toBeNull();
  });

  it('sends only the enabled lines with their selected coverages', () => {
    const update = toPartnerConfigUpdateDto(toPartnerConfig(PARTNER_CONFIG_DTO), 'Ana Gómez');

    expect(update).toEqual({
      ramos: [{ ramo_id: 'ramo-proteccion-pagos', coberturas: ['pagos-desempleo'] }],
      actualizado_por: 'Ana Gómez',
    });
  });

  it('keeps the original value when the timestamp cannot be parsed', () => {
    expect(formatTimestamp('sin fecha')).toBe('sin fecha');
  });
});
