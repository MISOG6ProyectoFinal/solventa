import { OperatorDto } from '../services/operators-api.mapper';

export const ADMIN_DTO: OperatorDto = {
  id: 'op-1',
  correo: 'ana@solventa.co',
  nombre: 'Ana Gómez',
  roles: ['administrador'],
  activo: true,
  creado_en: '2026-09-01T10:00:00Z',
};

export const ADVISOR_DTO: OperatorDto = {
  id: 'op-2',
  correo: 'luis@solventa.co',
  nombre: 'Luis Pérez',
  roles: ['asesor'],
  activo: true,
  creado_en: '2026-09-02T10:00:00Z',
};

export const INACTIVE_DTO: OperatorDto = {
  id: 'op-3',
  correo: 'marta@solventa.co',
  nombre: 'Marta Rojas',
  roles: ['consulta'],
  activo: false,
  creado_en: '2026-09-03T10:00:00Z',
};
