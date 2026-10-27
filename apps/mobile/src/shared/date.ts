/** dd/MM/yyyy → yyyy-MM-dd por texto, sin pasar por UTC. */
export function toApiDate(value: string): string {
  const [day, month, year] = value.split('/');
  return `${year}-${month}-${day}`;
}

/** yyyy-MM-dd → dd/MM/yyyy por texto, sin pasar por UTC. */
export function fromApiDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

/** Fecha local como dd/MM/yyyy, sin pasar por UTC. */
export function toDisplayDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** True when the dd/MM/yyyy date is before today, in local time. */
export function isPastDate(value: string, today = new Date()): boolean {
  return toApiDate(value) < toApiDate(toDisplayDate(today));
}
