import { POLICY_DTO } from '../testing/policy.fixtures';
import { toPolicy, toRamoId } from './ops-policies-api.mapper';

describe('ops policies mapper', () => {
  it('maps the policy, its insured, payments and claims', () => {
    const policy = toPolicy(POLICY_DTO);

    expect(policy).toMatchObject({
      number: 'POL-ABC123',
      tipoDocumento: 'CC',
      identification: '1020304050',
      insuredName: 'Lina Díaz',
      ramo: 'VIDA_HIPOTECARIO',
      producto: 'Vida Hipotecario',
      socioOrigen: 'mobile',
      status: 'Activa',
      startDate: '2026-11-05',
      endDate: '2041-11-05',
      premium: 3927000,
      email: 'lina@solventa.test',
    });
    expect(policy.coverages).toEqual([
      { name: 'Fallecimiento (saldo del crédito)', sumaAsegurada: '-', deducible: '-', included: true },
    ]);
    expect(policy.payments).toEqual([
      { ref: 'cobro-1', date: '2026-11-05', tipo: 'Prima', medio: '-', amount: 3927000, status: 'Aprobado' },
    ]);
    expect(policy.claims).toEqual([
      { id: 'SIN-1001', tipo: 'Incapacidad', fechaOcurrencia: '2026-11-04', fechaAviso: '2026-11-05', status: 'En revisión' },
    ]);
  });

  it('shows a partner policy without insured data', () => {
    const policy = toPolicy({
      ...POLICY_DTO,
      estado: 'vencida',
      canal: 'socios',
      cliente: null,
      socio: { id: 's-1', nombre: 'Banco Aurora' },
      producto: null,
      ramo_id: null,
      pagos: [{ id: 'cobro-2', estado: 'procesando', monto: '10' }],
      siniestros: [{ id: 'aviso-2', estado: 'borrador', tipo: 'Robo', ocurrido_en: '2026-11-01T00:00:00Z' }],
    });

    expect(policy.insuredName).toBe('-');
    expect(policy.identification).toBe('');
    expect(policy.socioOrigen).toBe('Banco Aurora');
    expect(policy.producto).toBe('vida-hipotecario');
    expect(policy.ramo).toBe('');
    expect(policy.status).toBe('Vencida');
    expect(policy.payments[0].status).toBe('Pendiente');
    expect(policy.claims[0]).toMatchObject({ id: 'aviso-2', status: 'Reportado', fechaAviso: '' });
  });

  it('turns the backend line id into the portal key', () => {
    expect(toRamoId('ramo-proteccion-pagos')).toBe('PROTECCION_PAGOS');
    expect(toRamoId(null)).toBe('');
  });
});
