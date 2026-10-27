import { useEffect, useState } from 'react';

import { claimReport } from '../../claimReport';
import { listReports } from '../../offline/listReports';
import { useClaimsStore } from '../../store/useClaimsStore';
import { formatDate, fromIsoOccurredAt } from '../../utils';

// Form fields, restored from the report saved on the device. Leaving the screen clears the evidence.
export function useReportForm() {
  const [policy, setPolicy] = useState(claimReport.policy);
  const [claimType, setClaimType] = useState(claimReport.claimType);
  const [occurredAt, setOccurredAt] = useState(() => formatDate(new Date()));
  const [description, setDescription] = useState('');
  const [restoredAddress, setRestoredAddress] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listReports().then((reports) => {
      if (!active) {
        return;
      }
      const saved = reports[0];
      if (!saved) {
        return;
      }
      const policyMatch = claimReport.policies.find((option) => option.value.split(' · ').pop() === saved.poliza_id);
      setPolicy(policyMatch?.value ?? saved.poliza_id);
      setClaimType(saved.tipo);
      setOccurredAt(fromIsoOccurredAt(saved.ocurrido_en));
      setDescription(saved.descripcion);
      if (saved.ubicacion) {
        setRestoredAddress(saved.ubicacion);
      }
      useClaimsStore.getState().replaceEvidence(saved.files);
    });
    return () => {
      active = false;
      useClaimsStore.getState().clear();
    };
  }, []);

  return {
    policy,
    setPolicy,
    claimType,
    setClaimType,
    occurredAt,
    setOccurredAt,
    description,
    setDescription,
    restoredAddress,
    setRestoredAddress,
  };
}
