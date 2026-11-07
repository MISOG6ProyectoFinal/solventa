/** yyyy-MM-dd, o el inicio de un ISO, sin reinterpretar la zona. */
export function policyDate(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1] ?? value;
}

/** Días de calendario desde hoy hasta la fecha, sin decidir si la póliza se puede renovar. */
export function daysUntil(value: string, today = new Date()): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return 0;
  }
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}
