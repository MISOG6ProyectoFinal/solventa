import { of } from 'rxjs';
import { CancellationCause } from '../models/catalog.model';
import { CatalogService } from '../services/catalog.service';

export const CANCELLATION_CAUSES: readonly CancellationCause[] = [
  { id: 'retracto', name: 'Retracto', refundable: true },
  { id: 'venta-del-bien-asegurado', name: 'Venta del bien asegurado', refundable: true },
  { id: 'impago-de-prima', name: 'Impago de prima', refundable: false },
];

export const CATALOG_FIXTURE = {
  documentTypes$: of(['CC', 'CE', 'Pasaporte']),
  partnerTypes$: of(['Banco', 'Aerolínea', 'E-commerce', 'Fintech', 'Retailer']),
  partnerScopes$: of(['cotizacion', 'emision', 'consulta']),
  policyStatuses$: of(['activa', 'vencida', 'cancelada']),
  cancellationCauses$: of(CANCELLATION_CAUSES),
};

export const provideCatalogFixture = () => ({ provide: CatalogService, useValue: CATALOG_FIXTURE });
