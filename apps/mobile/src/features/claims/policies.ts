import { useCallback, useEffect, useState } from 'react';

import { listPolicies } from '../policies/api/listPolicies';
import { getProducts } from '../quote/api/getProducts';
import { ProductoMovil } from '../quote/types';
import { ClaimChoice } from './types';

export function useClaimPolicies(): ClaimChoice[] | null {
  const [choices, setChoices] = useState<ClaimChoice[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listPolicies(), getProducts().catch(() => [] as ProductoMovil[])])
      .then(([policies, products]) => {
        if (!active) {
          return;
        }
        const names = Object.fromEntries(products.map((product) => [product.id, product.nombre]));
        setChoices(
          policies
            .filter((policy) => policy.estado === 'activa')
            .map((policy) => ({
              value: policy.id,
              label: `${names[policy.producto_id] ?? policy.producto_id} · ${policy.numero}`,
            })),
        );
      })
      .catch(() => {
        if (active) {
          setChoices([]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return choices;
}

export function usePolicyNumber(): (policyId: string) => string {
  const [numbers, setNumbers] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    listPolicies()
      .then((policies) => {
        if (active) {
          setNumbers(Object.fromEntries(policies.map((policy) => [policy.id, policy.numero])));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return useCallback((policyId: string) => numbers[policyId] ?? policyId, [numbers]);
}
