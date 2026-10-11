type QualityGateProbeProps = {
  label: string;
};

export function QualityGateProbe({ label }: QualityGateProbeProps) {
  return <>{label}</>;
}