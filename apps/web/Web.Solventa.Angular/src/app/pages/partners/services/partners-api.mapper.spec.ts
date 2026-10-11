import { PARTNER_DTO } from '../testing/partner.fixtures';
import { formatTimestamp, toNewPartnerDto, toPartner } from './partners-api.mapper';

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

  it('keeps the original value when the timestamp cannot be parsed', () => {
    expect(formatTimestamp('sin fecha')).toBe('sin fecha');
  });
});
